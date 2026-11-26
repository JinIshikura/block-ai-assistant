// ブロックAIアシスタント - page bridge（Scratchページ側で動く）
// Scratchのエディタ内部（VM・ブロック画面）にアクセスして、
// 作品の読み取り・ブロックの追加/修正・印つけ・元にもどす を行う。
// 拡張機能のUI（content.js）とは window.postMessage でやり取りする。
// 拡張機能に入っている版は、まずサーバーの最新版（/bridge/page-bridge.js）を読みこんで動かす。
// 読みこめないときだけ、手元（拡張機能の中）の版で動く。→ この部分の更新に、拡張機能の入れ直しがいらない
(function () {
  'use strict';
  const REMOTE = 'https://block-ai-assistant.pages.dev/bridge/page-bridge.js';

  function start() {
  if (window.__blockAiBridge) return;
  window.__blockAiBridge = true;

  const CS = 'block-ai-cs';
  const PAGE = 'block-ai-page';

  // ---------------------------------------------------------------
  // VM / ワークスペースを探す
  // ---------------------------------------------------------------
  let cachedVM = null;

  function fiberOf(el) {
    if (!el) return null;
    const key = Object.keys(el).find((k) => k.startsWith('__reactInternalInstance$') || k.startsWith('__reactFiber$'));
    return key ? el[key] : null;
  }

  function isVM(v) {
    return v && v.runtime && typeof v.toJSON === 'function' && Array.isArray(v.runtime.targets);
  }

  function findVM() {
    if (isVM(cachedVM)) return cachedVM;
    const selectors = [
      '[class*="stage-wrapper_stage-wrapper"]',
      '[class*="gui_body-wrapper"]',
      '[class*="blocks_blocks"]',
      '[class*="gui_page-wrapper"]',
      '.blocklyWorkspace'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      let f = fiberOf(el);
      let guard = 0;
      while (f && guard++ < 400) {
        const p = f.memoizedProps || f.pendingProps;
        if (p && isVM(p.vm)) { cachedVM = p.vm; return cachedVM; }
        if (f.stateNode && f.stateNode.props && isVM(f.stateNode.props.vm)) { cachedVM = f.stateNode.props.vm; return cachedVM; }
        if (p && p.store && typeof p.store.getState === 'function') {
          try {
            const s = p.store.getState();
            if (s && s.scratchGui && isVM(s.scratchGui.vm)) { cachedVM = s.scratchGui.vm; return cachedVM; }
          } catch (e) { /* noop */ }
        }
        f = f.return;
      }
    }
    return null;
  }

  function findWorkspace() {
    const el = document.querySelector('[class*="blocks_blocks"]') || document.querySelector('.blocklyWorkspace');
    let f = fiberOf(el);
    let guard = 0;
    while (f && guard++ < 400) {
      const sn = f.stateNode;
      if (sn && sn.workspace && typeof sn.workspace.getBlockById === 'function') return sn.workspace;
      f = f.return;
    }
    return null;
  }

  function vmOrThrow() {
    const vm = findVM();
    if (!vm) throw new Error('Scratchのエディタが見つかりません');
    return vm;
  }

  // ---------------------------------------------------------------
  // スプライトさがし
  // ---------------------------------------------------------------
  function targetByName(vm, name) {
    const n = String(name || '').trim();
    const originals = vm.runtime.targets.filter((t) => t.isOriginal);
    if (/^(stage|ステージ|背景)$/i.test(n) || /ステージ/.test(n)) return originals.find((t) => t.isStage);
    return originals.find((t) => t.getName() === n) || null;
  }

  function targetOrThrow(vm, name) {
    const t = targetByName(vm, name);
    if (!t) {
      const names = vm.runtime.targets.filter((x) => x.isOriginal).map((x) => x.isStage ? 'Stage' : x.getName());
      throw new Error('スプライト「' + name + '」が見つかりません。ある名前: ' + names.join(', '));
    }
    return t;
  }

  // ---------------------------------------------------------------
  // 作品をAI向けのテキストにする
  // ---------------------------------------------------------------
  function shortVal(v) {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.length > 60 ? s.slice(0, 57) + '...' : s;
  }

  function fieldsText(b) {
    const parts = [];
    for (const k in b.fields) {
      const f = b.fields[k];
      parts.push(k + '=' + JSON.stringify(shortVal(f.value)));
    }
    return parts;
  }

  function reporterText(blocks, id, depth) {
    const b = blocks.getBlock(id);
    if (!b) return '?';
    if (depth > 8) return '(...)';
    if (b.shadow) {
      const f = Object.values(b.fields)[0];
      if (!f) return '""';
      const v = JSON.stringify(shortVal(f.value));
      return /[０-９]/.test(String(f.value)) ? v + '【全角数字あり】' : v;
    }
    const parts = [b.opcode].concat(fieldsText(b), inputsText(blocks, b, depth + 1));
    return '(' + parts.join(' ') + ' #' + b.id + ')';
  }

  function inputsText(blocks, b, depth) {
    const parts = [];
    for (const k in b.inputs) {
      if (/^SUBSTACK/.test(k)) continue;
      const inp = b.inputs[k];
      if (inp.block) parts.push(k + '=' + reporterText(blocks, inp.block, depth));
      else parts.push(k + '=(空)');
    }
    return parts;
  }

  function stackText(blocks, id, indent, out, depth) {
    let cur = id;
    let guard = 0;
    while (cur && guard++ < 500) {
      const b = blocks.getBlock(cur);
      if (!b) break;
      const parts = [b.opcode].concat(fieldsText(b), inputsText(blocks, b, depth));
      out.push(indent + parts.join(' ') + '  #' + b.id);
      const subs = Object.keys(b.inputs).filter((k) => /^SUBSTACK/.test(k)).sort();
      subs.forEach((k) => {
        out.push(indent + '  ' + (k === 'SUBSTACK2' ? 'でなければ(SUBSTACK2):' : k + ':'));
        if (b.inputs[k].block) stackText(blocks, b.inputs[k].block, indent + '    ', out, depth + 1);
        else out.push(indent + '    (空)');
      });
      cur = b.next;
    }
  }

  function monitorText(vm, id) {
    const rec = vm.runtime._monitorState && vm.runtime._monitorState.get(id);
    if (!rec || !rec.get('visible')) return '';
    const mode = { default: 'ふつう', large: '大きい', slider: 'スライダー', list: 'リスト' }[rec.get('mode')] || rec.get('mode');
    return '（ステージに表示中・' + mode + '）';
  }

  function varsText(vm, t) {
    const vs = Object.values(t.variables || {});
    const v = vs.filter((x) => x.type === '').map((x) => x.name + '=' + JSON.stringify(shortVal(x.value)) + monitorText(vm, x.id));
    const l = vs.filter((x) => x.type === 'list').map((x) => x.name + '[' + (Array.isArray(x.value) ? x.value.length : 0) + '件]' + (x.name === MEMO_NAME ? '（AIアシスタントの記録用。さわらない）' : '') + monitorText(vm, x.id));
    const m = vs.filter((x) => x.type === 'broadcast_msg').map((x) => x.name);
    const out = [];
    if (v.length) out.push('  変数: ' + v.join(', '));
    if (l.length) out.push('  リスト: ' + l.join(', '));
    if (m.length) out.push('  メッセージ: ' + m.join(', '));
    return out;
  }

  function getProjectDump() {
    const vm = vmOrThrow();
    const editing = vm.editingTarget;
    const lines = [];
    const running = vm.runtime.threads ? vm.runtime.threads.length : 0;
    lines.push('いま選ばれているスプライト: ' + (editing ? (editing.isStage ? 'Stage' : editing.getName()) : '不明'));
    lines.push('実行中のスクリプト数: ' + running);
    const originals = vm.runtime.targets.filter((t) => t.isOriginal);
    originals.forEach((t) => {
      lines.push('');
      if (t.isStage) {
        lines.push('=== Stage（ステージ）※ここの変数・リストは「すべてのスプライト用」 ===');
        lines.push('  背景: ' + t.getCostumes().map((c) => c.name).join(', ') + '（いま: ' + (t.getCostumes()[t.currentCostume] || {}).name + '）');
      } else {
        lines.push('=== スプライト「' + t.getName() + '」 ===');
        lines.push('  状態: x=' + Math.round(t.x) + ' y=' + Math.round(t.y) + ' 向き=' + Math.round(t.direction) +
          ' 大きさ=' + Math.round(t.size) + '% 表示=' + (t.visible ? 'する' : 'しない') +
          ' コスチューム=' + (t.getCostumes()[t.currentCostume] || {}).name);
        lines.push('  コスチューム: ' + t.getCostumes().map((c) => c.name).join(', '));
        const clones = vm.runtime.targets.filter((x) => !x.isOriginal && x.sprite === t.sprite).length;
        if (clones) lines.push('  クローンの数: ' + clones);
      }
      const sounds = (t.getSounds ? t.getSounds() : []).map((s) => s.name);
      if (sounds.length) lines.push('  音: ' + sounds.join(', '));
      varsText(vm, t).forEach((x) => lines.push(x));
      const blocks = t.blocks;
      const tops = blocks.getScripts();
      if (!tops.length) {
        lines.push('  スクリプト: なし');
      } else {
        tops.forEach((topId, i) => {
          const tb = blocks.getBlock(topId);
          if (!tb || tb.shadow) return;
          lines.push('  --- スクリプト' + (i + 1) + ' (top #' + topId + ') ---');
          const out = [];
          stackText(blocks, topId, '    ', out, 0);
          out.forEach((x) => lines.push(x));
        });
      }
    });
    let text = lines.join('\n');
    if (text.length > 40000) text = text.slice(0, 40000) + '\n...（長いので省略）';
    return { text };
  }

  // ---------------------------------------------------------------
  // スナップショット（元にもどす用）
  // ---------------------------------------------------------------
  const snapshots = {};
  let snapSeq = 0;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  let currentSnap = null;

  function snapshot() {
    const vm = vmOrThrow();
    const token = 's' + (++snapSeq);
    snapshots[token] = {
      editingId: vm.editingTarget ? vm.editingTarget.id : null,
      targets: vm.runtime.targets.filter((t) => t.isOriginal).map((t) => ({
        id: t.id,
        name: t.getName(),
        blocks: clone(t.blocks._blocks),
        // 変数は「入れもの（クラス）」ごと残し、名前と値は別に覚えておく
        variables: Object.assign({}, t.variables),
        varInfo: Object.fromEntries(Object.values(t.variables).map((v) => [v.id, { name: v.name, value: clone(v.value) }])),
        costumes: t.getCostumes().slice(),
        sounds: t.sprite ? t.sprite.sounds.slice() : [],
        currentCostume: t.currentCostume
      })),
      monitorState: vm.runtime._monitorState,
      restoreFns: [] // スプライトの削除など、別の方法でもどすもの
    };
    currentSnap = token;
    return { token };
  }

  function addRestore(fn) {
    if (currentSnap && snapshots[currentSnap]) snapshots[currentSnap].restoreFns.push(fn);
  }

  function restoreBlocks(t, saved) {
    t.blocks._blocks = saved;
    t.blocks._scripts = Object.keys(saved).filter((id) => saved[id].topLevel);
    if (typeof t.blocks.resetCache === 'function') t.blocks.resetCache();
  }

  async function undo(params) {
    const vm = vmOrThrow();
    const snap = snapshots[params.token];
    if (!snap) throw new Error('もどせる記録がありません');
    vm.stopAll();
    // AIが作った（複製した）スプライトを消す
    const keep = new Set(snap.targets.map((x) => x.id));
    vm.runtime.targets.filter((t) => t.isOriginal && !t.isStage && !keep.has(t.id)).forEach((t) => {
      try { vm.deleteSprite(t.id); } catch (e) { /* noop */ }
    });
    const mb = vm.runtime.monitorBlocks;
    const memoVar = findMemoVar(vm); // AIメモは元にもどしの対象外
    snap.targets.forEach((s) => {
      const t = vm.runtime.getTargetById(s.id);
      if (!t) return;
      restoreBlocks(t, clone(s.blocks));
      // 元にもどしで消える変数は、表示（モニター）も消す（残すと変数がまた作られてしまう）
      Object.keys(t.variables).forEach((id) => {
        if (!s.variables[id] && !(memoVar && memoVar.id === id)) {
          try { mb.deleteBlock(id); } catch (e) { /* noop */ }
        }
      });
      t.variables = Object.assign({}, s.variables);
      if (t.isStage && memoVar) t.variables[memoVar.id] = memoVar;
      Object.keys(s.varInfo || {}).forEach((id) => {
        const v = t.variables[id];
        const info = s.varInfo[id];
        if (!v || (memoVar && memoVar.id === id)) return;
        if (v.name !== info.name) renameVarEverywhere(vm, t, id, info.name);
        v.value = clone(info.value);
      });
      // コスチューム（背景）と音を元の並びにもどす
      t.sprite.costumes = s.costumes;
      if (s.currentCostume < t.getCostumes().length) t.setCostume(s.currentCostume);
      t.sprite.sounds = s.sounds.slice();
      if (!t.isStage && t.getName() !== s.name) {
        try { vm.renameSprite(t.id, s.name); } catch (e) { /* noop */ }
      }
    });
    if (snap.monitorState) {
      vm.runtime._monitorState = snap.monitorState;
      // モニター用ブロックの「表示中」かどうかも、元の状態にそろえる
      Object.values(mb._blocks || {}).forEach((blk) => {
        const rec = snap.monitorState.get(blk.id);
        blk.isMonitored = !!(rec && rec.get('visible'));
      });
    }
    // 消したスプライトをもどす
    for (const fn of snap.restoreFns.slice().reverse()) {
      try { await fn(); } catch (e) { /* noop */ }
    }
    if (snap.editingId && vm.runtime.getTargetById(snap.editingId)) vm.setEditingTarget(snap.editingId);
    refresh(vm);
    delete snapshots[params.token];
    return { ok: true };
  }

  // 変数・リスト・メッセージの欄に種類（variableType）がないと、Scratchの画面が
  // ブロックを途中までしか読みこまない（残りのスクリプトが見えなくなる）ので、かならずそろえる
  const VAR_TYPES = { VARIABLE: '', LIST: 'list', BROADCAST_OPTION: 'broadcast_msg' };
  function healFields(vm) {
    vm.runtime.targets.forEach((t) => {
      if (!t.isOriginal || !t.blocks) return;
      Object.values(t.blocks._blocks).forEach((b) => {
        Object.values(b.fields || {}).forEach((f) => {
          if (f && f.id && Object.prototype.hasOwnProperty.call(VAR_TYPES, f.name) && f.variableType !== VAR_TYPES[f.name]) f.variableType = VAR_TYPES[f.name];
        });
      });
    });
  }

  // 新しく置いたスクリプトが、ほかのスクリプトと重なっていたら、いちばん下の空いている所へ動かす
  let recentTops = [];
  function untangle(ids) {
    setTimeout(() => {
      try {
        const ws = findWorkspace();
        if (!ws || typeof ws.getTopBlocks !== 'function') return;
        const box = (b) => {
          const r = b.getBoundingRectangle();
          return r.topLeft ? { l: r.topLeft.x, t: r.topLeft.y, r: r.bottomRight.x, b: r.bottomRight.y } : { l: r.left, t: r.top, r: r.right, b: r.bottom };
        };
        const hit = (a, c) => a.l < c.r + 16 && c.l < a.r + 16 && a.t < c.b + 16 && c.t < a.b + 16;
        ids.forEach((id) => {
          const blk = ws.getBlockById(id);
          if (!blk || typeof blk.moveBy !== 'function') return;
          const me = box(blk);
          const others = ws.getTopBlocks(false).filter((b) => b.id !== id).map(box);
          if (!others.some((o) => hit(me, o))) return;
          const left = Math.min(me.l, ...others.map((o) => o.l));
          const bottom = Math.max(...others.map((o) => o.b));
          blk.moveBy(left - me.l, bottom + 48 - me.t);
        });
      } catch (e) { /* noop */ }
    }, 150);
  }

  function refresh(vm) {
    try { healFields(vm); } catch (e) { /* noop */ }
    try { vm.runtime.emitProjectChanged(); } catch (e) { /* noop */ }
    try { vm.emitTargetsUpdate(); } catch (e) { /* noop */ }
    try { vm.emitWorkspaceUpdate(); } catch (e) { /* noop */ }
    const ids = recentTops.splice(0);
    if (ids.length) untangle(ids);
  }

  // ---------------------------------------------------------------
  // AIが書いたブロック（かんたんな形）→ Scratchのブロック
  // ---------------------------------------------------------------
  const EXTENSIONS = ['pen', 'music', 'videoSensing', 'text2speech', 'translate', 'makeymakey'];

  function uid() {
    return 'ai' + Math.random().toString(36).slice(2, 10) + (Date.now() % 100000).toString(36);
  }

  async function ensureExtension(vm, opcode) {
    const ext = opcode.split('_')[0];
    if (EXTENSIONS.includes(ext) && vm.extensionManager && !vm.extensionManager.isExtensionLoaded(ext)) {
      await vm.extensionManager.loadExtensionURL(ext);
    }
  }

  function checkOpcode(vm, opcode, isShadow) {
    if (typeof opcode !== 'string' || !/^[a-zA-Z0-9]+_[a-zA-Z0-9_]+$|^text$/.test(opcode)) {
      throw new Error('opcodeの形がおかしい: ' + opcode);
    }
    if (/^(procedures_|argument_)/.test(opcode) && opcode !== 'procedures_call' && opcode !== 'argument_reporter_string_number') {
      throw new Error('自作ブロック（' + opcode + '）は使えません');
    }
    if (isShadow) return;
    const prim = vm.runtime._primitives || {};
    const hats = vm.runtime._hats || {};
    if (!prim[opcode] && !hats[opcode]) throw new Error('知らないブロック: ' + opcode + '（Scratch 3.0のopcodeを使ってください）');
  }

  function findVariable(vm, target, name, type) {
    const stage = vm.runtime.getTargetForStage();
    const pools = [target, stage];
    for (const t of pools) {
      if (!t) continue;
      for (const id in t.variables) {
        const v = t.variables[id];
        if (v.name === name && v.type === type) return v;
      }
    }
    return null;
  }

  function ensureVariable(vm, target, name, type, ctx) {
    let v = findVariable(vm, target, name, type);
    if (!v) {
      const stage = vm.runtime.getTargetForStage();
      const id = uid();
      stage.createVariable(id, name, type);
      v = stage.variables[id];
      ctx.created.push((type === 'broadcast_msg' ? 'メッセージ' : type === 'list' ? 'リスト' : '変数') + '「' + name + '」');
    }
    return v;
  }

  function makeField(vm, target, name, val, ctx) {
    if (val && typeof val === 'object') {
      if ('variable' in val) {
        const v = ensureVariable(vm, target, String(val.variable), '', ctx);
        return { name, value: v.name, id: v.id, variableType: '' };
      }
      if ('list' in val) {
        const v = ensureVariable(vm, target, String(val.list), 'list', ctx);
        return { name, value: v.name, id: v.id, variableType: 'list' };
      }
      if ('broadcast' in val) {
        const v = ensureVariable(vm, target, String(val.broadcast), 'broadcast_msg', ctx);
        return { name, value: v.name, id: v.id, variableType: 'broadcast_msg' };
      }
      if ('value' in val) return { name, value: String(val.value) };
    }
    return { name, value: String(val) };
  }

  function makeShadow(vm, target, spec, parentId, ctx) {
    const id = uid();
    let opcode, fieldName, fieldVal;
    if (typeof spec === 'number') spec = { num: spec };
    else if (typeof spec === 'string') spec = { text: spec };
    if ('num' in spec) { opcode = spec.type || 'math_number'; fieldName = 'NUM'; fieldVal = spec.num; }
    else if ('text' in spec) { opcode = 'text'; fieldName = 'TEXT'; fieldVal = spec.text; }
    else if ('color' in spec) { opcode = 'colour_picker'; fieldName = 'COLOUR'; fieldVal = spec.color; }
    else if (spec.menu) {
      opcode = spec.menu.opcode; fieldName = spec.menu.field;
      fieldVal = spec.menu.broadcast !== undefined ? { broadcast: spec.menu.broadcast } : spec.menu.value;
      if (!fieldName) throw new Error('menu には field（フィールド名）が必要です: ' + opcode);
    } else {
      throw new Error('入力の書き方がおかしい: ' + JSON.stringify(spec));
    }
    checkOpcode(vm, opcode, true);
    const b = {
      id, opcode, next: null, parent: parentId, inputs: {}, fields: {},
      shadow: true, topLevel: false
    };
    b.fields[fieldName] = makeField(vm, target, fieldName, fieldVal, ctx);
    ctx.list.push(b);
    return id;
  }

  function findPrototype(target, proccode) {
    const B = target.blocks._blocks;
    return Object.values(B).find((b) => b.opcode === 'procedures_prototype' && b.mutation && b.mutation.proccode === proccode) || null;
  }

  // 定義ブロック（関数）を呼ぶブロック
  async function makeProcCall(vm, target, spec, parentId, ctx) {
    const proto = findPrototype(target, spec.proccode);
    if (!proto) throw new Error('定義ブロック「' + String(spec.proccode).replace(/ %s/g, '') + '」がこのスプライトにありません');
    const ids = JSON.parse(proto.mutation.argumentids || '[]');
    const id = uid();
    const b = {
      id, opcode: 'procedures_call', next: null, parent: parentId, inputs: {}, fields: {}, shadow: false, topLevel: false,
      mutation: { tagName: 'mutation', children: [], proccode: spec.proccode, argumentids: proto.mutation.argumentids, warp: proto.mutation.warp || 'false' }
    };
    ctx.list.push(b);
    ctx.count++;
    const args = spec.args || [];
    for (let i = 0; i < ids.length; i++) {
      const val = args[i] || { text: '' };
      if (val && val.block) {
        const rid = await makeBlock(vm, target, val.block, id, ctx);
        const sid = makeShadow(vm, target, { text: '' }, id, ctx);
        b.inputs[ids[i]] = { name: ids[i], block: rid, shadow: sid };
      } else {
        const lit = val && 'num' in val ? { text: String(val.num) } : val;
        const sid = makeShadow(vm, target, lit, id, ctx);
        b.inputs[ids[i]] = { name: ids[i], block: sid, shadow: sid };
      }
    }
    return id;
  }

  async function makeBlock(vm, target, spec, parentId, ctx) {
    if (!spec || typeof spec !== 'object') throw new Error('ブロックの書き方がおかしい: ' + JSON.stringify(spec));
    if (spec.opcode === 'procedures_call') return makeProcCall(vm, target, spec, parentId, ctx);
    await ensureExtension(vm, String(spec.opcode || ''));
    checkOpcode(vm, spec.opcode, false);
    const id = uid();
    const b = {
      id, opcode: spec.opcode, next: null, parent: parentId, inputs: {}, fields: {},
      shadow: false, topLevel: false
    };
    ctx.list.push(b);
    ctx.count++;
    const fields = spec.fields || {};
    for (const name in fields) b.fields[name] = makeField(vm, target, name, fields[name], ctx);

    const inputs = spec.inputs || {};
    for (const name in inputs) {
      const val = inputs[name];
      if (val && typeof val === 'object' && Array.isArray(val.stack)) {
        const first = await makeStack(vm, target, val.stack, id, ctx);
        b.inputs[name] = { name, block: first, shadow: null };
      } else if (val && typeof val === 'object' && val.block) {
        const rid = await makeBlock(vm, target, val.block, id, ctx);
        const sid = val.shadow ? makeShadow(vm, target, val.shadow, id, ctx) : null;
        b.inputs[name] = { name, block: rid, shadow: sid };
      } else {
        const sid = makeShadow(vm, target, val, id, ctx);
        b.inputs[name] = { name, block: sid, shadow: sid };
      }
    }
    if (spec.opcode === 'control_stop') {
      const opt = b.fields.STOP_OPTION ? b.fields.STOP_OPTION.value : 'all';
      const hasNext = /other scripts/.test(opt);
      b.mutation = { tagName: 'mutation', children: [], hasnext: String(hasNext) };
    }
    return id;
  }

  async function makeStack(vm, target, items, parentId, ctx) {
    if (!Array.isArray(items) || !items.length) return null;
    let first = null;
    let prev = null;
    for (const item of items) {
      const id = await makeBlock(vm, target, item, prev ? prev.id : parentId, ctx);
      const b = ctx.list.find((x) => x.id === id);
      if (prev) prev.next = id; else first = id;
      prev = b;
    }
    return first;
  }

  function freeSpot(target) {
    let maxX = 0;
    let found = false;
    target.blocks.getScripts().forEach((id) => {
      const b = target.blocks.getBlock(id);
      if (b && typeof b.x === 'number') { maxX = Math.max(maxX, b.x); found = true; }
    });
    return { x: found ? maxX + 420 : 40, y: 40 };
  }

  async function insertScript(vm, target, blocksSpec, x, y) {
    const ctx = { list: [], count: 0, created: [] };
    const first = await makeStack(vm, target, blocksSpec, null, ctx);
    if (!first) throw new Error('blocks が空です');
    const top = ctx.list.find((b) => b.id === first);
    top.topLevel = true;
    top.x = x;
    top.y = y;
    ctx.list.forEach((b) => target.blocks.createBlock(b));
    recentTops.push(first);
    return { topId: first, count: ctx.count, created: ctx.created };
  }

  function collectScript(blocks, id, out) {
    if (!id || out.has(id)) return;
    const b = blocks.getBlock(id);
    if (!b) return;
    out.add(id);
    for (const k in b.inputs) {
      collectScript(blocks, b.inputs[k].block, out);
      collectScript(blocks, b.inputs[k].shadow, out);
    }
    collectScript(blocks, b.next, out);
  }

  function removeScript(target, topId) {
    const blocks = target.blocks;
    const top = blocks.getBlock(topId);
    if (!top) throw new Error('ブロック #' + topId + ' が見つかりません');
    if (!top.topLevel) {
      let t = top;
      let guard = 0;
      while (t && t.parent && guard++ < 500) t = blocks.getBlock(t.parent);
      throw new Error('#' + topId + ' はスクリプトの先頭ではありません。先頭は #' + (t ? t.id : '?') + ' です');
    }
    const ids = new Set();
    collectScript(blocks, topId, ids);
    ids.forEach((id) => { delete blocks._blocks[id]; });
    blocks._scripts = blocks._scripts.filter((s) => !ids.has(s));
    if (typeof blocks.resetCache === 'function') blocks.resetCache();
    return { count: ids.size, x: top.x, y: top.y };
  }

  async function addScript(p) {
    const vm = vmOrThrow();
    const t = targetOrThrow(vm, p.sprite);
    const spot = freeSpot(t);
    const r = await insertScript(vm, t, p.blocks, typeof p.x === 'number' ? p.x : spot.x, typeof p.y === 'number' ? p.y : spot.y);
    if (vm.editingTarget !== t) vm.setEditingTarget(t.id);
    refresh(vm);
    setTimeout(() => focusBlock(r.topId), 300);
    return { ok: true, added: r.count, created: r.created, topId: r.topId };
  }

  async function replaceScript(p) {
    const vm = vmOrThrow();
    const t = targetOrThrow(vm, p.sprite);
    // 先に新しいブロックを作れるか確かめる（失敗したら古いのは消さない）
    const test = { list: [], count: 0, created: [] };
    await makeStack(vm, t, p.blocks, null, test);
    const old = t.blocks.getBlock(p.top_block_id);
    if (!old) throw new Error('ブロック #' + p.top_block_id + ' が見つかりません');
    const removed = removeScript(t, p.top_block_id);
    const r = await insertScript(vm, t, p.blocks, removed.x || 40, removed.y || 40);
    if (vm.editingTarget !== t) vm.setEditingTarget(t.id);
    refresh(vm);
    setTimeout(() => focusBlock(r.topId), 300);
    return { ok: true, removed: removed.count, added: r.count, created: test.created.concat(r.created), topId: r.topId };
  }

  function deleteScript(p) {
    const vm = vmOrThrow();
    const t = targetOrThrow(vm, p.sprite);
    const removed = removeScript(t, p.top_block_id);
    refresh(vm);
    return { ok: true, removed: removed.count };
  }


  // ---------------------------------------------------------------
  // スプライト・コスチューム（AIがSVGで絵をかく）
  // ---------------------------------------------------------------
  function cleanSvg(svg) {
    let s = String(svg || '').trim();
    if (s.length > 150000) throw new Error('SVGが大きすぎます（15万文字まで）');
    s = s.replace(/^<\?xml[^>]*>\s*/i, '');
    if (!/^<svg[\s>]/i.test(s)) throw new Error('SVGは <svg で始めてください');
    s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
      .replace(/<image[\s\S]*?(\/>|<\/image>)/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
      .replace(/(xlink:)?href\s*=\s*("|')\s*(https?:|javascript:|data:)[^"']*\2/gi, '');
    if (!/xmlns=/.test(s)) s = s.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    // 大きさ（width/height）が無ければ viewBox から付ける
    const open = /^<svg[^>]*>/i.exec(s)[0];
    const vb = /viewBox\s*=\s*["']\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(open);
    let w = (/\swidth\s*=\s*["']([\d.]+)/i.exec(open) || [])[1];
    let h = (/\sheight\s*=\s*["']([\d.]+)/i.exec(open) || [])[1];
    if ((!w || !h) && vb) {
      w = w || vb[3];
      h = h || vb[4];
      s = s.replace(/^<svg/i, '<svg width="' + w + '" height="' + h + '"');
    }
    w = Number(w) || 100;
    h = Number(h) || 100;
    if (w > 960 || h > 720) throw new Error('絵が大きすぎます（ステージは480×360です）');
    return { svg: s, w, h };
  }

  function makeAsset(vm, svgText) {
    const storage = vm.runtime.storage;
    if (!storage) throw new Error('Scratchの保存機能が見つかりません');
    const data = new TextEncoder().encode(svgText);
    const asset = storage.createAsset(storage.AssetType.ImageVector, storage.DataFormat.SVG, data, null, true);
    return { asset, data, storage };
  }

  function costumeObj(name, made, svgInfo) {
    return {
      name: String(name || 'コスチューム'),
      dataFormat: 'svg',
      asset: made.asset,
      assetId: made.asset.assetId,
      md5: made.asset.assetId + '.svg',
      rotationCenterX: svgInfo.w / 2,
      rotationCenterY: svgInfo.h / 2
    };
  }

  async function createSprite(p) {
    const vm = vmOrThrow();
    const info = cleanSvg(p.svg);
    const made = makeAsset(vm, info.svg);
    const id = made.asset.assetId;
    // スプライトの読み込みで見つかるように、絵をScratchの中に置いておく
    if (made.storage.builtinHelper && typeof made.storage.builtinHelper._store === 'function') {
      made.storage.builtinHelper._store(made.storage.AssetType.ImageVector, made.storage.DataFormat.SVG, made.data, id);
    } else if (typeof made.storage.cache === 'function') {
      made.storage.cache(made.storage.AssetType.ImageVector, made.storage.DataFormat.SVG, made.data, id);
    }
    const before = new Set(vm.runtime.targets.map((t) => t.id));
    const sprite = {
      isStage: false,
      name: String(p.name || 'スプライト'),
      variables: {}, lists: {}, broadcasts: {}, blocks: {}, comments: {},
      currentCostume: 0,
      costumes: [{
        name: String(p.costume_name || 'コスチューム1'),
        assetId: id, md5ext: id + '.svg', dataFormat: 'svg',
        rotationCenterX: info.w / 2, rotationCenterY: info.h / 2
      }],
      sounds: [],
      volume: 100,
      visible: true,
      x: typeof p.x === 'number' ? p.x : 0,
      y: typeof p.y === 'number' ? p.y : 0,
      size: typeof p.size === 'number' ? p.size : 100,
      direction: 90,
      draggable: false,
      rotationStyle: 'all around'
    };
    await vm.addSprite(JSON.stringify(sprite));
    const t = vm.runtime.targets.find((x) => x.isOriginal && !before.has(x.id));
    if (!t) throw new Error('スプライトを作れませんでした');
    if (vm.editingTarget !== t) vm.setEditingTarget(t.id);
    refresh(vm);
    return { ok: true, name: t.getName(), size: info.w + '×' + info.h };
  }

  async function addCostume(p) {
    const vm = vmOrThrow();
    const t = targetOrThrow(vm, p.sprite);
    const info = cleanSvg(p.svg);
    const made = makeAsset(vm, info.svg);
    const c = costumeObj(p.name, made, info);
    const keepIndex = t.currentCostume;
    if (t.isStage) await vm.addBackdrop(c.md5, c);
    else await vm.addCostume(c.md5, c, t.id);
    if (p.switch_to === false) t.setCostume(keepIndex);
    refresh(vm);
    return { ok: true, sprite: t.isStage ? 'Stage' : t.getName(), name: c.name, count: t.getCostumes().length };
  }


  // ---------------------------------------------------------------
  // 変数・リストと、ステージへの表示（モニター）
  // ---------------------------------------------------------------
  function typeOf(kind) { return kind === 'list' ? 'list' : ''; }
  function kindName(kind) { return kind === 'list' ? 'リスト' : '変数'; }

  // 変数をさがす。sprite を指定したらそのスプライトのもの→すべてのスプライト用 の順
  function findVar(vm, name, kind, spriteName) {
    const type = typeOf(kind);
    const stage = vm.runtime.getTargetForStage();
    const pools = [];
    if (spriteName) {
      const t = targetByName(vm, spriteName);
      if (t) pools.push(t);
    }
    pools.push(stage);
    if (!spriteName) vm.runtime.targets.filter((t) => t.isOriginal && !t.isStage).forEach((t) => pools.push(t));
    for (const t of pools) {
      for (const id in t.variables) {
        const v = t.variables[id];
        if (v.name === name && v.type === type) return { v, owner: t };
      }
    }
    return null;
  }

  function findVarOrThrow(vm, name, kind, spriteName) {
    const r = findVar(vm, name, kind, spriteName);
    if (!r) throw new Error(kindName(kind) + '「' + name + '」が見つかりません');
    return r;
  }

  function renameVarEverywhere(vm, owner, id, newName) {
    owner.renameVariable(id, newName);
    vm.runtime.targets.forEach((t) => {
      if (t.blocks && typeof t.blocks.updateBlocksAfterVarRename === 'function') t.blocks.updateBlocksAfterVarRename(id, newName);
    });
  }

  function usageCount(vm, id) {
    let n = 0;
    vm.runtime.targets.filter((t) => t.isOriginal).forEach((t) => {
      Object.values(t.blocks._blocks).forEach((b) => {
        Object.values(b.fields || {}).forEach((f) => { if (f.id === id) n++; });
      });
    });
    return n;
  }

  function toValue(kind, value) {
    if (kind === 'list') {
      const arr = Array.isArray(value) ? value : String(value === undefined ? '' : value).split('\n').filter((x) => x !== '');
      return arr.map((x) => (typeof x === 'number' ? x : String(x)));
    }
    if (typeof value === 'number') return value;
    const str = String(value === undefined ? 0 : value);
    return /^-?\d+(\.\d+)?$/.test(str) ? Number(str) : str;
  }

  function manageVariable(p) {
    const vm = vmOrThrow();
    const kind = p.kind === 'list' ? 'list' : 'variable';
    const name = String(p.name || '').trim();
    if (!name) throw new Error('name が必要です');
    if (name === MEMO_NAME || String(p.new_name || '').trim() === MEMO_NAME) throw new Error('「' + MEMO_NAME + '」はAIアシスタントの記録用なので変えられません');
    let result;
    if (p.action === 'create') {
      const owner = p.sprite && !/^(stage|ステージ)$/i.test(p.sprite) ? targetOrThrow(vm, p.sprite) : vm.runtime.getTargetForStage();
      const clash = findVar(vm, name, kind, owner.isStage ? null : owner.getName());
      if (clash && (clash.owner === owner || clash.owner.isStage || owner.isStage)) {
        throw new Error('同じ名前の' + kindName(kind) + '「' + name + '」がもうあります');
      }
      const id = uid();
      owner.createVariable(id, name, typeOf(kind));
      if (p.value !== undefined) owner.variables[id].value = toValue(kind, p.value);
      result = { ok: true, msg: kindName(kind) + '「' + name + '」を作りました（' + (owner.isStage ? 'すべてのスプライト用' : '「' + owner.getName() + '」のみ') + '）' };
    } else if (p.action === 'rename') {
      const newName = String(p.new_name || '').trim();
      if (!newName) throw new Error('new_name が必要です');
      const r = findVarOrThrow(vm, name, kind, p.sprite);
      if (findVar(vm, newName, kind, r.owner.isStage ? null : r.owner.getName())) throw new Error('「' + newName + '」という' + kindName(kind) + 'がもうあります');
      renameVarEverywhere(vm, r.owner, r.v.id, newName);
      result = { ok: true, msg: '「' + name + '」を「' + newName + '」に名前を変えました' };
    } else if (p.action === 'delete') {
      const r = findVarOrThrow(vm, name, kind, p.sprite);
      const used = usageCount(vm, r.v.id);
      if (used) throw new Error('「' + name + '」は ' + used + ' か所のブロックで使われているので消せません。先にそのブロックを直してください');
      r.owner.deleteVariable(r.v.id);
      result = { ok: true, msg: '「' + name + '」を消しました' };
    } else if (p.action === 'set_value') {
      const r = findVarOrThrow(vm, name, kind, p.sprite);
      r.v.value = toValue(kind, p.value);
      result = { ok: true, msg: '「' + name + '」の値を ' + JSON.stringify(r.v.value).slice(0, 80) + ' にしました' };
    } else {
      throw new Error('action は create / rename / delete / set_value のどれかです');
    }
    refresh(vm);
    return result;
  }

  function setMonitor(p) {
    const vm = vmOrThrow();
    const kind = p.kind === 'list' ? 'list' : 'variable';
    const r = findVarOrThrow(vm, String(p.name || '').trim(), kind, p.sprite);
    const id = r.v.id;
    const mb = vm.runtime.monitorBlocks;
    let block = mb.getBlock(id);
    if (!block) {
      const fieldName = kind === 'list' ? 'LIST' : 'VARIABLE';
      block = {
        id, opcode: kind === 'list' ? 'data_listcontents' : 'data_variable',
        inputs: {}, fields: {}, next: null, parent: null, shadow: false, topLevel: true, isMonitored: false,
        targetId: r.owner.isStage ? null : r.owner.id
      };
      block.fields[fieldName] = { name: fieldName, value: r.v.name, id, variableType: typeOf(kind) };
      mb.createBlock(block);
    }
    const visible = p.visible !== false;
    // いまの状態に関係なく、かならず切りかえが起きるようにする
    block.isMonitored = !visible;
    if (!r.owner.isStage) block.targetId = r.owner.id;
    mb.changeBlock({ id, element: 'checkbox', value: visible }, vm.runtime);

    if (visible) {
      const rec = vm.runtime._monitorState.get(id);
      if (rec) {
        const upd = {};
        if (kind === 'variable' && ['default', 'large', 'slider'].includes(p.mode)) upd.mode = p.mode;
        if (typeof p.x === 'number') upd.x = Math.round(p.x);
        if (typeof p.y === 'number') upd.y = Math.round(p.y);
        if (typeof p.slider_min === 'number') upd.sliderMin = p.slider_min;
        if (typeof p.slider_max === 'number') upd.sliderMax = p.slider_max;
        if (typeof p.slider_min === 'number' || typeof p.slider_max === 'number') {
          upd.isDiscrete = [p.slider_min, p.slider_max].every((x) => x === undefined || Number.isInteger(x));
        }
        if (kind === 'list' && typeof p.width === 'number') upd.width = Math.round(p.width);
        if (kind === 'list' && typeof p.height === 'number') upd.height = Math.round(p.height);
        vm.runtime._monitorState = vm.runtime._monitorState.set(id, rec.merge(upd));
      }
    }
    try { vm.runtime.emitProjectChanged(); } catch (e) { /* noop */ }
    return { ok: true, msg: '「' + r.v.name + '」をステージに' + (visible ? '表示しました' + (p.mode ? '（' + p.mode + '）' : '') : '表示しないようにしました') };
  }


  // ---------------------------------------------------------------
  // スプライトの名前変更・削除・複製、コスチューム・音の削除
  // ---------------------------------------------------------------
  function spriteOnly(vm, name) {
    const t = targetOrThrow(vm, name);
    if (t.isStage) throw new Error('ステージにはこの操作はできません');
    return t;
  }

  function renameSprite(p) {
    const vm = vmOrThrow();
    const t = spriteOnly(vm, p.sprite);
    const newName = String(p.new_name || '').trim();
    if (!newName) throw new Error('new_name が必要です');
    const old = t.getName();
    vm.renameSprite(t.id, newName);
    refresh(vm);
    return { ok: true, msg: 'スプライト「' + old + '」の名前を「' + t.getName() + '」に変えました', name: t.getName() };
  }

  function deleteSprite(p) {
    const vm = vmOrThrow();
    const t = spriteOnly(vm, p.sprite);
    const name = t.getName();
    const snap = currentSnap && snapshots[currentSnap];
    const saved = snap && snap.targets.find((x) => x.id === t.id);
    const origName = saved ? saved.name : name;
    const restore = vm.deleteSprite(t.id);
    if (typeof restore === 'function') {
      addRestore(async () => {
        const before = new Set(vm.runtime.targets.map((x) => x.id));
        await restore();
        const nt = vm.runtime.targets.find((x) => x.isOriginal && !before.has(x.id));
        if (nt && nt.getName() !== origName) vm.renameSprite(nt.id, origName);
      });
    }
    refresh(vm);
    return { ok: true, msg: 'スプライト「' + name + '」を消しました' };
  }

  async function duplicateSprite(p) {
    const vm = vmOrThrow();
    const t = spriteOnly(vm, p.sprite);
    const before = new Set(vm.runtime.targets.map((x) => x.id));
    await vm.duplicateSprite(t.id);
    const nt = vm.runtime.targets.find((x) => x.isOriginal && !before.has(x.id));
    if (!nt) throw new Error('複製できませんでした');
    if (typeof p.new_name === 'string' && p.new_name.trim()) vm.renameSprite(nt.id, p.new_name.trim());
    if (typeof p.x === 'number' || typeof p.y === 'number') nt.setXY(typeof p.x === 'number' ? p.x : nt.x, typeof p.y === 'number' ? p.y : nt.y);
    refresh(vm);
    return { ok: true, msg: '「' + t.getName() + '」を複製して「' + nt.getName() + '」を作りました', name: nt.getName() };
  }

  function deleteCostume(p) {
    const vm = vmOrThrow();
    const t = targetOrThrow(vm, p.sprite);
    const list = t.getCostumes();
    const i = list.findIndex((c) => c.name === p.name);
    if (i < 0) throw new Error('「' + p.name + '」というコスチューム（背景）がありません。ある名前: ' + list.map((c) => c.name).join(', '));
    if (list.length <= 1) throw new Error('コスチューム（背景）が1つしかないので消せません');
    t.deleteCostume(i);
    refresh(vm);
    return { ok: true, msg: (t.isStage ? '背景' : 'コスチューム') + '「' + p.name + '」を消しました' };
  }

  function deleteSound(p) {
    const vm = vmOrThrow();
    const t = targetOrThrow(vm, p.sprite);
    const i = t.sprite.sounds.findIndex((x) => x.name === p.name);
    if (i < 0) throw new Error('「' + p.name + '」という音がありません');
    t.deleteSound(i);
    refresh(vm);
    return { ok: true, msg: '音「' + p.name + '」を消しました' };
  }

  // ---------------------------------------------------------------
  // 音を作る（効果音・メロディをその場で合成してWAVにする）
  // ---------------------------------------------------------------
  const RATE = 22050;
  const NOTE_INDEX = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };

  function noteFreq(n) {
    if (typeof n === 'number') return n;
    const m = /^([A-Ga-g])([#b]?)(\d)$/.exec(String(n || '').trim());
    if (!m) return null;
    let semi = NOTE_INDEX[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12;
    return 440 * Math.pow(2, semi / 12);
  }

  function osc(wave, phase) {
    const x = phase - Math.floor(phase);
    if (wave === 'square') return x < 0.5 ? 1 : -1;
    if (wave === 'triangle') return 1 - 4 * Math.abs(x - 0.5);
    if (wave === 'sawtooth') return 2 * x - 1;
    if (wave === 'noise') return Math.random() * 2 - 1;
    return Math.sin(2 * Math.PI * x);
  }

  // 1つの音（tone）を out に足す：周波数 f0→f1 へ変化、音量 v、長さ dur秒
  function tone(out, start, dur, f0, f1, wave, v, decay) {
    const n = Math.floor(dur * RATE);
    let phase = 0;
    let last = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const f = f0 + (f1 - f0) * t;
      phase += f / RATE;
      let s = osc(wave, phase);
      if (wave === 'noise') { last = last * 0.6 + s * 0.4; s = last; }
      const attack = Math.min(1, i / (RATE * 0.005));
      const release = Math.min(1, (n - i) / (RATE * 0.02));
      const env = decay ? Math.pow(1 - t, 2) : 1;
      const idx = start + i;
      if (idx < out.length) out[idx] += s * v * attack * release * env;
    }
  }

  const PRESETS = {
    jump: (o) => tone(o, 0, 0.25, 300, 750, 'square', 0.35, true),
    coin: (o) => { tone(o, 0, 0.08, 988, 988, 'square', 0.3, false); tone(o, Math.floor(0.08 * RATE), 0.35, 1319, 1319, 'square', 0.3, true); },
    laser: (o) => tone(o, 0, 0.25, 1400, 200, 'sawtooth', 0.3, true),
    explosion: (o) => tone(o, 0, 0.7, 100, 40, 'noise', 0.9, true),
    powerup: (o) => ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => tone(o, Math.floor(i * 0.07 * RATE), 0.08, noteFreq(n), noteFreq(n), 'square', 0.25, false)),
    hit: (o) => { tone(o, 0, 0.12, 200, 80, 'noise', 0.8, true); tone(o, 0, 0.1, 160, 90, 'square', 0.25, true); },
    beep: (o) => tone(o, 0, 0.2, 880, 880, 'sine', 0.5, false),
    click: (o) => tone(o, 0, 0.03, 2000, 1000, 'noise', 0.6, true),
    win: (o) => [['C5', 0.12], ['E5', 0.12], ['G5', 0.12], ['C6', 0.45]].reduce((t, [n, d]) => { tone(o, Math.floor(t * RATE), d, noteFreq(n), noteFreq(n), 'triangle', 0.5, false); return t + d; }, 0),
    lose: (o) => [['G4', 0.2], ['F#4', 0.2], ['F4', 0.2], ['E4', 0.6]].reduce((t, [n, d]) => { tone(o, Math.floor(t * RATE), d, noteFreq(n), noteFreq(n), 'square', 0.25, d > 0.3); return t + d; }, 0)
  };
  const PRESET_LEN = { jump: 0.3, coin: 0.5, laser: 0.3, explosion: 0.8, powerup: 0.5, hit: 0.2, beep: 0.25, click: 0.05, win: 0.85, lose: 1.25 };

  function synth(p) {
    let len;
    let draw;
    if (Array.isArray(p.notes) && p.notes.length) {
      const tempo = Math.max(40, Math.min(240, Number(p.tempo) || 120));
      const beat = 60 / tempo;
      const items = p.notes.slice(0, 200).map((n) => {
        const d = typeof n.seconds === 'number' ? n.seconds : (typeof n.beats === 'number' ? n.beats : 1) * beat;
        return { f: n.rest ? null : noteFreq(n.note !== undefined ? n.note : n.freq), d: Math.max(0.02, Math.min(4, d)), w: n.wave || p.wave || 'square', v: typeof n.volume === 'number' ? n.volume : 0.3 };
      });
      len = items.reduce((a, x) => a + x.d, 0) + 0.05;
      draw = (o) => items.reduce((t, x) => { if (x.f) tone(o, Math.floor(t * RATE), x.d * 0.95, x.f, x.f, x.w, x.v, false); return t + x.d; }, 0);
    } else if (PRESETS[p.preset]) {
      len = PRESET_LEN[p.preset];
      draw = PRESETS[p.preset];
    } else {
      throw new Error('preset（' + Object.keys(PRESETS).join(' / ') + '）か notes を指定してください');
    }
    if (len > 10) throw new Error('音が長すぎます（10秒まで）');
    const out = new Float32Array(Math.ceil(len * RATE));
    draw(out);
    return out;
  }

  function toWav(samples) {
    const buf = new ArrayBuffer(44 + samples.length * 2);
    const dv = new DataView(buf);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) dv.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVE');
    w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, RATE, true); dv.setUint32(28, RATE * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    w(36, 'data'); dv.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
      const v = Math.max(-1, Math.min(1, samples[i]));
      dv.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    }
    return new Uint8Array(buf);
  }

  async function addSound(p) {
    const vm = vmOrThrow();
    const t = targetOrThrow(vm, p.sprite);
    const samples = synth(p);
    const data = toWav(samples);
    const storage = vm.runtime.storage;
    const asset = storage.createAsset(storage.AssetType.Sound, storage.DataFormat.WAV, data, null, true);
    const sound = {
      name: String(p.name || p.preset || '音'),
      asset, assetId: asset.assetId, dataFormat: 'wav', format: '',
      md5: asset.assetId + '.wav', rate: RATE, sampleCount: samples.length
    };
    await vm.addSound(sound, t.id);
    refresh(vm);
    return { ok: true, msg: (t.isStage ? 'ステージ' : '「' + t.getName() + '」') + 'に音「' + sound.name + '」（' + (samples.length / RATE).toFixed(1) + '秒）を追加しました' };
  }

  // ---------------------------------------------------------------
  // ステージの絵を撮る（AIが見るため）
  // ---------------------------------------------------------------
  function snapshotDataURL(vm) {
    return new Promise((resolve, reject) => {
      const r = vm.renderer;
      if (!r || typeof r.requestSnapshot !== 'function') return reject(new Error('ステージの絵を撮れません'));
      let done = false;
      r.requestSnapshot((url) => { done = true; resolve(url); });
      // 止まっているときは絵が更新されないので、自分で描く
      setTimeout(() => { if (!done) { try { r.draw(); } catch (e) { /* noop */ } } }, 300);
      setTimeout(() => { if (!done) reject(new Error('ステージの絵を撮れませんでした')); }, 3000);
    });
  }

  function shrink(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 480; c.height = 360;
        const g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, 480, 360);
        g.drawImage(img, 0, 0, 480, 360);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(url);
      img.src = url;
    });
  }

  async function lookStage(p) {
    const vm = vmOrThrow();
    const sec = Math.max(0, Math.min(10, Number(p.run_seconds) || 0));
    if (sec > 0) {
      vm.greenFlag();
      await new Promise((r) => setTimeout(r, sec * 1000));
    }
    const url = await shrink(await snapshotDataURL(vm));
    if (sec > 0 && p.stop_after !== false) vm.stopAll();
    const m = /^data:(image\/\w+);base64,(.*)$/.exec(url);
    if (!m) throw new Error('絵のデータがおかしいです');
    const pos = vm.runtime.targets.filter((t) => t.isOriginal && !t.isStage)
      .map((t) => t.getName() + '(x=' + Math.round(t.x) + ', y=' + Math.round(t.y) + (t.visible ? '' : ', 非表示') + ')').join(' ');
    return { mediaType: m[1], data: m[2], note: (sec ? '緑の旗を押して' + sec + '秒後の' : 'いまの') + 'ステージ。スプライトの位置: ' + pos };
  }


  // ---------------------------------------------------------------
  // ブロックを一部だけ直す（挿入・移動・削除・入力や項目の変更）
  // ---------------------------------------------------------------
  const C_BLOCKS = ['control_forever', 'control_repeat', 'control_repeat_until', 'control_while', 'control_if',
    'control_if_else', 'control_for_each', 'control_all_at_once'];
  const CAP_BLOCKS = ['control_forever', 'control_delete_this_clone'];

  function linkOf(B, b) {
    if (!b.parent || !B[b.parent]) return { type: 'top' };
    const P = B[b.parent];
    if (P.next === b.id) return { type: 'next', P };
    for (const k in P.inputs) if (P.inputs[k] && P.inputs[k].block === b.id) return { type: 'input', P, input: k };
    return { type: 'top' };
  }

  function lastOfChain(B, id) {
    let cur = B[id];
    let guard = 0;
    while (cur.next && B[cur.next] && guard++ < 1000) cur = B[cur.next];
    return cur;
  }

  function isReporter(B, b) {
    const l = linkOf(B, b);
    return l.type === 'input' && !/^SUBSTACK/.test(l.input);
  }

  function setTop(t, b, x, y) {
    b.parent = null;
    b.topLevel = true;
    b.x = typeof x === 'number' ? x : 40;
    b.y = typeof y === 'number' ? y : 40;
    if (!t.blocks._scripts.includes(b.id)) t.blocks._scripts.push(b.id);
  }

  function unsetTop(t, b) {
    b.topLevel = false;
    t.blocks._scripts = t.blocks._scripts.filter((s) => s !== b.id);
  }

  // b を今の場所から外す。withFollowing=false のときは、うしろのブロックを前につなぎ直す
  function detach(t, b, withFollowing) {
    const B = t.blocks._blocks;
    const link = linkOf(B, b);
    const nextId = withFollowing ? null : b.next;
    const pos = { x: b.x, y: b.y };
    if (link.type === 'next') {
      link.P.next = nextId;
      if (nextId) B[nextId].parent = link.P.id;
    } else if (link.type === 'input') {
      link.P.inputs[link.input].block = nextId;
      if (nextId) B[nextId].parent = link.P.id;
    } else {
      unsetTop(t, b);
      if (nextId) setTop(t, B[nextId], pos.x, pos.y);
    }
    if (!withFollowing) b.next = null;
    b.parent = null;
    return pos;
  }

  function subtreeIds(B, id, withNext, out) {
    out = out || new Set();
    if (!id || out.has(id) || !B[id]) return out;
    out.add(id);
    const b = B[id];
    for (const k in b.inputs) {
      subtreeIds(B, b.inputs[k].block, true, out);
      subtreeIds(B, b.inputs[k].shadow, true, out);
    }
    if (withNext) subtreeIds(B, b.next, true, out);
    return out;
  }

  function attach(vm, t, firstId, dest, moving) {
    const B = t.blocks._blocks;
    const first = B[firstId];
    const last = lastOfChain(B, firstId);
    const isHat = !!(vm.runtime._hats || {})[first.opcode];
    const check = (id, label) => {
      if (!B[id]) throw new Error(label + ' のブロック #' + id + ' が見つかりません');
      if (moving && moving.has(id)) throw new Error('動かすブロックの中には入れられません');
      return B[id];
    };
    if (dest.after) {
      const T = check(dest.after, 'after');
      if (isHat) throw new Error('「〜とき」のブロックはスクリプトの先頭にしか置けません');
      if (isReporter(B, T)) throw new Error('#' + dest.after + ' は入力の中のブロックなので、うしろにつなげません');
      if (CAP_BLOCKS.includes(T.opcode) || (T.opcode === 'control_stop' && !(T.mutation && T.mutation.hasnext === 'true'))) {
        throw new Error('「' + T.opcode + '」のうしろにはつなげません');
      }
      const old = T.next;
      T.next = first.id;
      first.parent = T.id;
      unsetTop(t, first);
      last.next = old || null;
      if (old) B[old].parent = last.id;
    } else if (dest.before) {
      const T = check(dest.before, 'before');
      if (isHat) throw new Error('「〜とき」のブロックはスクリプトの先頭にしか置けません');
      if ((vm.runtime._hats || {})[T.opcode]) throw new Error('「〜とき」のブロックの前には入れられません');
      if (isReporter(B, T)) throw new Error('#' + dest.before + ' は入力の中のブロックです');
      const link = linkOf(B, T);
      if (link.type === 'top') {
        setTop(t, first, T.x, T.y);
        unsetTop(t, T);
      } else if (link.type === 'next') {
        link.P.next = first.id;
        first.parent = link.P.id;
        unsetTop(t, first);
      } else {
        link.P.inputs[link.input].block = first.id;
        first.parent = link.P.id;
        unsetTop(t, first);
      }
      last.next = T.id;
      T.parent = last.id;
    } else if (dest.into) {
      const P = check(dest.into.block, 'into');
      const input = dest.into.input || 'SUBSTACK';
      if (!/^SUBSTACK2?$/.test(input) || !(P.inputs[input] || C_BLOCKS.includes(P.opcode))) {
        throw new Error('#' + P.id + '（' + P.opcode + '）には ' + input + ' がありません');
      }
      if (input === 'SUBSTACK2' && P.opcode !== 'control_if_else') throw new Error('SUBSTACK2 は「もし〜なら、でなければ」だけです');
      if (isHat) throw new Error('「〜とき」のブロックは中に入れられません');
      const old = P.inputs[input] && P.inputs[input].block;
      P.inputs[input] = { name: input, block: first.id, shadow: null };
      first.parent = P.id;
      unsetTop(t, first);
      last.next = old || null;
      if (old) B[old].parent = last.id;
    } else {
      const spot = freeSpot(t);
      setTop(t, first, typeof dest.x === 'number' ? dest.x : spot.x, typeof dest.y === 'number' ? dest.y : spot.y);
    }
  }

  function removeIds(t, ids) {
    ids.forEach((id) => { delete t.blocks._blocks[id]; });
    t.blocks._scripts = t.blocks._scripts.filter((s) => !ids.has(s));
  }

  async function applyEdit(vm, t, op, ctx) {
    const B = t.blocks._blocks;
    const need = (id) => { if (!B[id]) throw new Error('ブロック #' + id + ' が見つかりません'); return B[id]; };
    const dest = { after: op.after, before: op.before, into: op.into, x: op.x, y: op.y };
    if (op.op === 'insert') {
      const local = { list: [], count: 0, created: [] };
      const first = await makeStack(vm, t, op.blocks, null, local);
      if (!first) throw new Error('blocks が空です');
      local.list.forEach((b) => t.blocks.createBlock(b));
      attach(vm, t, first, dest, null);
      ctx.added += local.count;
      ctx.created = ctx.created.concat(local.created);
      ctx.focus = ctx.focus || first;
      return '挿入（' + local.count + 'ブロック、先頭 #' + first + '）';
    }
    if (op.op === 'move') {
      const b = need(op.block);
      if (isReporter(B, b)) throw new Error('入力の中のブロックは set_input で入れかえてください');
      const moving = subtreeIds(B, b.id, !!op.with_following);
      detach(t, b, !!op.with_following);
      attach(vm, t, b.id, dest, moving);
      ctx.focus = ctx.focus || b.id;
      return '移動（#' + b.id + (op.with_following ? ' とうしろのブロック' : '') + '）';
    }
    if (op.op === 'delete') {
      const b = need(op.block);
      if (isReporter(B, b)) {
        const link = linkOf(B, b);
        const inp = link.P.inputs[link.input];
        inp.block = inp.shadow || null;
        const ids = subtreeIds(B, b.id, false);
        removeIds(t, ids);
        ctx.removed += ids.size;
        return '入力の中のブロックを削除（#' + b.id + '）';
      }
      detach(t, b, false);
      const ids = subtreeIds(B, b.id, false);
      removeIds(t, ids);
      ctx.removed += ids.size;
      return '削除（#' + b.id + '）';
    }
    if (op.op === 'set_input') {
      const b = need(op.block);
      const name = String(op.input || '');
      if (!name || /^SUBSTACK/.test(name)) throw new Error('input（入力の名前）がおかしいです');
      const local = { list: [], count: 0, created: [] };
      const cur = b.inputs[name];
      const oldBlock = cur && cur.block && cur.block !== cur.shadow ? cur.block : null;
      const v = op.value;
      if (v && typeof v === 'object' && v.block) {
        const rid = await makeBlock(vm, t, v.block, b.id, local);
        local.list.forEach((x) => t.blocks.createBlock(x));
        b.inputs[name] = { name, block: rid, shadow: cur ? cur.shadow : null };
        ctx.added += local.count;
      } else {
        // 今の入力欄（シャドウ）が同じ種類なら、値だけ変える
        const sh = cur && cur.shadow && B[cur.shadow];
        const want = typeof v === 'number' || (v && 'num' in v) ? 'NUM' : (typeof v === 'string' || (v && 'text' in v)) ? 'TEXT' : (v && 'color' in v) ? 'COLOUR' : null;
        const raw = typeof v === 'object' && v ? (v.num !== undefined ? v.num : v.text !== undefined ? v.text : v.color) : v;
        if (sh && want && sh.fields[want]) {
          sh.fields[want].value = String(raw);
          b.inputs[name].block = sh.id;
        } else if (sh && v && v.menu && sh.opcode === v.menu.opcode) {
          sh.fields[v.menu.field] = makeField(vm, t, v.menu.field, v.menu.broadcast !== undefined ? { broadcast: v.menu.broadcast } : v.menu.value, local);
          b.inputs[name].block = sh.id;
        } else {
          const sid = makeShadow(vm, t, v, b.id, local);
          local.list.forEach((x) => t.blocks.createBlock(x));
          if (cur && cur.shadow && cur.shadow !== sid) removeIds(t, subtreeIds(B, cur.shadow, false));
          b.inputs[name] = { name, block: sid, shadow: sid };
        }
      }
      if (oldBlock) {
        const ids = subtreeIds(B, oldBlock, false);
        removeIds(t, ids);
        ctx.removed += ids.size;
      }
      ctx.created = ctx.created.concat(local.created);
      ctx.focus = ctx.focus || b.id;
      return '入力 ' + name + ' を変更（#' + b.id + '）';
    }
    if (op.op === 'set_field') {
      const b = need(op.block);
      const field = String(op.field || '');
      if (!b.fields[field]) throw new Error('#' + b.id + ' には ' + field + ' という項目がありません（ある項目: ' + Object.keys(b.fields).join(', ') + '）');
      const local = { list: [], count: 0, created: [] };
      b.fields[field] = makeField(vm, t, field, op.value, local);
      ctx.created = ctx.created.concat(local.created);
      ctx.focus = ctx.focus || b.id;
      return '項目 ' + field + ' を変更（#' + b.id + '）';
    }
    throw new Error('op は insert / move / delete / set_input / set_field のどれかです');
  }

  function checkIntegrity(t) {
    const B = t.blocks._blocks;
    for (const id in B) {
      const b = B[id];
      if (b.next && !B[b.next]) throw new Error('つながりがこわれました（#' + id + '）');
      if (b.parent && !B[b.parent]) throw new Error('つながりがこわれました（#' + id + '）');
      let cur = b;
      let guard = 0;
      while (cur && cur.parent) {
        cur = B[cur.parent];
        if (++guard > 2000) throw new Error('ブロックが輪になってしまいました');
      }
    }
  }

  async function editBlocks(p) {
    const vm = vmOrThrow();
    const t = targetOrThrow(vm, p.sprite);
    const ops = Array.isArray(p.operations) ? p.operations : [];
    if (!ops.length) throw new Error('operations が空です');
    const backup = { blocks: clone(t.blocks._blocks), scripts: t.blocks._scripts.slice() };
    const ctx = { added: 0, removed: 0, created: [], focus: null };
    const done = [];
    try {
      for (let i = 0; i < ops.length; i++) {
        try {
          done.push(await applyEdit(vm, t, ops[i], ctx));
        } catch (e) {
          throw new Error((i + 1) + '番目の操作（' + (ops[i] && ops[i].op) + '）: ' + e.message);
        }
      }
      checkIntegrity(t);
    } catch (e) {
      t.blocks._blocks = backup.blocks;
      t.blocks._scripts = backup.scripts;
      if (typeof t.blocks.resetCache === 'function') t.blocks.resetCache();
      throw new Error(e.message + '（何も変えていません）');
    }
    if (typeof t.blocks.resetCache === 'function') t.blocks.resetCache();
    if (vm.editingTarget !== t) vm.setEditingTarget(t.id);
    refresh(vm);
    if (ctx.focus) setTimeout(() => focusBlock(ctx.focus), 300);
    return { ok: true, added: ctx.added, removed: ctx.removed, created: ctx.created, msg: done.join('、') };
  }

  // ---------------------------------------------------------------
  // 動かして確かめる（緑の旗＋キー操作、状態を記録）
  // ---------------------------------------------------------------
  const KEY_ALIAS = {
    space: ' ', スペース: ' ', right: 'ArrowRight', left: 'ArrowLeft', up: 'ArrowUp', down: 'ArrowDown',
    右: 'ArrowRight', 左: 'ArrowLeft', 上: 'ArrowUp', 下: 'ArrowDown', '右向き矢印': 'ArrowRight', '左向き矢印': 'ArrowLeft',
    '上向き矢印': 'ArrowUp', '下向き矢印': 'ArrowDown', enter: 'Enter'
  };

  function keyName(k) {
    const s = String(k || '');
    return KEY_ALIAS[s] || KEY_ALIAS[s.toLowerCase()] || s;
  }

  function sayText(t) {
    try {
      const st = t.getCustomState && t.getCustomState('Scratch.looks');
      return st && st.text ? String(st.text).slice(0, 30) : '';
    } catch (e) { return ''; }
  }

  function stateLine(vm, spriteNames, varNames) {
    const parts = [];
    vm.runtime.targets.filter((t) => t.isOriginal && !t.isStage && (!spriteNames || spriteNames.includes(t.getName()))).slice(0, 6).forEach((t) => {
      const clones = vm.runtime.targets.filter((x) => !x.isOriginal && x.sprite === t.sprite).length;
      const say = sayText(t);
      parts.push(t.getName() + '(x=' + Math.round(t.x) + ' y=' + Math.round(t.y) + ' 向き=' + Math.round(t.direction) +
        ' ' + ((t.getCostumes()[t.currentCostume] || {}).name || '') + (t.visible ? '' : ' 非表示') +
        (clones ? ' クローン' + clones : '') + (say ? ' 「' + say + '」' : '') + ')');
    });
    const vars = [];
    vm.runtime.targets.filter((t) => t.isOriginal).forEach((t) => {
      Object.values(t.variables).filter((v) => v.type === '' && (!varNames || varNames.includes(v.name))).forEach((v) => {
        vars.push(v.name + '=' + shortVal(v.value));
      });
    });
    return parts.join(' ') + (vars.length ? ' | ' + vars.slice(0, 12).join(' ') : '');
  }

  async function runAndWatch(p) {
    const vm = vmOrThrow();
    const sec = Math.max(0.5, Math.min(10, Number(p.seconds) || 3));
    const step = Math.max(0.2, Math.min(2, Number(p.interval) || 0.5));
    const sprites = Array.isArray(p.sprites) && p.sprites.length ? p.sprites : null;
    const vars = Array.isArray(p.variables) && p.variables.length ? p.variables : null;
    const keys = Array.isArray(p.keys) ? p.keys.slice(0, 20) : [];
    const lines = ['t=0.0秒（スタート前） ' + stateLine(vm, sprites, vars)];
    const timers = [];
    vm.greenFlag();
    keys.forEach((k) => {
      const key = keyName(k.key);
      const at = Math.max(0, Number(k.at) || 0) * 1000;
      const hold = Math.max(0.05, Math.min(5, Number(k.hold) || 0.2)) * 1000;
      timers.push(setTimeout(() => { vm.postIOData('keyboard', { key, isDown: true }); lines.push('（' + (at / 1000).toFixed(1) + '秒: キー「' + k.key + '」を押す）'); }, at));
      timers.push(setTimeout(() => vm.postIOData('keyboard', { key, isDown: false }), at + hold));
    });
    const start = Date.now();
    await new Promise((resolve) => {
      const tick = () => {
        const el = (Date.now() - start) / 1000;
        const running = vm.runtime.threads ? vm.runtime.threads.length : 0;
        lines.push('t=' + el.toFixed(1) + '秒 ' + stateLine(vm, sprites, vars) + (running ? '' : ' 【実行中のスクリプトなし】'));
        if (el >= sec - 0.01) return resolve();
        setTimeout(tick, step * 1000);
      };
      setTimeout(tick, step * 1000);
    });
    timers.forEach(clearTimeout);
    keys.forEach((k) => vm.postIOData('keyboard', { key: keyName(k.key), isDown: false }));
    let image = null;
    if (p.take_picture) {
      try {
        const url = await shrink(await snapshotDataURL(vm));
        const m = /^data:(image\/\w+);base64,(.*)$/.exec(url);
        if (m) image = { mediaType: m[1], data: m[2] };
      } catch (e) { /* noop */ }
    }
    if (p.stop_after !== false) vm.stopAll();
    let text = lines.join('\n');
    if (text.length > 9000) text = text.slice(0, 9000) + '\n…（長いので省略）';
    return { text, image };
  }

  // ---------------------------------------------------------------
  // ブロックの右クリックメニューに「AIに聞く」を足す
  // ---------------------------------------------------------------
  function findScratchBlocks() {
    const el = document.querySelector('[class*="blocks_blocks"]') || document.querySelector('.blocklyWorkspace');
    let f = fiberOf(el);
    let guard = 0;
    while (f && guard++ < 400) {
      const sn = f.stateNode;
      if (sn && sn.ScratchBlocks && sn.ScratchBlocks.ContextMenu) return sn.ScratchBlocks;
      f = f.return;
    }
    return window.ScratchBlocks && window.ScratchBlocks.ContextMenu ? window.ScratchBlocks : null;
  }

  function installContextMenu() {
    const SB = findScratchBlocks();
    if (!SB || SB.__blockAiMenu) return !!SB;
    SB.__blockAiMenu = true;
    const askItem = (b) => ({
      text: 'AIに聞く',
      enabled: true,
      callback: () => {
        const vm = findVM();
        const root = b.getRootBlock ? b.getRootBlock() : b;
        window.postMessage({
          source: PAGE,
          event: 'askBlock',
          data: {
            blockId: b.id,
            topId: root.id,
            opcode: b.type,
            inFlyout: !!b.isInFlyout,
            sprite: vm && vm.editingTarget ? (vm.editingTarget.isStage ? 'Stage' : vm.editingTarget.getName()) : ''
          }
        }, location.origin);
      }
    });
    const proto = SB.BlockSvg && SB.BlockSvg.prototype;
    // 新しいScratch（いまの scratch.mit.edu）：メニューの中身を作る関数に、いちばん上へ足す
    if (proto && typeof proto.generateContextMenu === 'function') {
      const origGen = proto.generateContextMenu;
      proto.generateContextMenu = function (...args) {
        const opts = origGen.apply(this, args);
        try { if (Array.isArray(opts)) opts.unshift(askItem(this)); } catch (e) { /* noop */ }
        return opts;
      };
      return true;
    }
    // 古いScratch
    let lastBlock = null;
    if (proto && typeof proto.showContextMenu_ === 'function') {
      const orig = proto.showContextMenu_;
      proto.showContextMenu_ = function (e) {
        lastBlock = this;
        try { return orig.call(this, e); } finally { lastBlock = null; }
      };
    }
    const origShow = SB.ContextMenu.show;
    SB.ContextMenu.show = function (e, options, rtl) {
      let block = lastBlock;
      if (!block) {
        try {
          const ws = SB.getMainWorkspace && SB.getMainWorkspace();
          const g = ws && ws.currentGesture_;
          block = g && g.targetBlock_;
        } catch (err) { /* noop */ }
      }
      if (block && Array.isArray(options)) options.unshift(askItem(block));
      return origShow.apply(this, arguments);
    };
    return true;
  }
  const menuTimer = setInterval(() => { try { if (installContextMenu()) clearInterval(menuTimer); } catch (e) { /* noop */ } }, 1000);


  // ---------------------------------------------------------------
  // 作品の中の「AIメモ」リスト（会話の記録・メモを作品といっしょに保存する）
  // ---------------------------------------------------------------
  const MEMO_NAME = 'AIメモ';

  function findMemoVar(vm) {
    const stage = vm.runtime.getTargetForStage();
    if (!stage) return null;
    return Object.values(stage.variables).find((v) => v.type === 'list' && v.name === MEMO_NAME) || null;
  }

  function readMemoList() {
    const vm = vmOrThrow();
    const v = findMemoVar(vm);
    return { exists: !!v, items: v && Array.isArray(v.value) ? v.value.map(String) : [] };
  }

  function writeMemoList(p) {
    const vm = vmOrThrow();
    const items = (Array.isArray(p.items) ? p.items : []).map((x) => String(x).slice(0, 2000)).slice(0, 400);
    let v = findMemoVar(vm);
    let created = false;
    if (!v) {
      const stage = vm.runtime.getTargetForStage();
      const id = uid();
      stage.createVariable(id, MEMO_NAME, 'list');
      v = stage.variables[id];
      created = true;
    }
    v.value = items;
    v._monitorUpToDate = false;
    try { vm.runtime.emitProjectChanged(); } catch (e) { /* noop */ }
    // 新しく作ったときだけ、ブロックの一覧を更新する（作業中の画面をなるべく動かさない）
    if (created) { try { vm.emitWorkspaceUpdate(); } catch (e) { /* noop */ } }
    return { ok: true, created, count: items.length };
  }


  // ---------------------------------------------------------------
  // コード表示用：スクリプトを読み出す・置きかえる
  // ---------------------------------------------------------------
  const VAR_FIELDS = { VARIABLE: 'variable', LIST: 'list', BROADCAST_OPTION: 'broadcast' };

  function shadowSpec(blk) {
    const fname = Object.keys(blk.fields)[0];
    const fv = fname ? blk.fields[fname].value : '';
    if (/^math_/.test(blk.opcode)) return { num: String(fv) };
    if (blk.opcode === 'text') return { text: String(fv) };
    if (blk.opcode === 'colour_picker') return { color: String(fv) };
    if (fname === 'BROADCAST_OPTION') return { menu: { opcode: blk.opcode, field: fname, broadcast: String(fv) } };
    return { menu: { opcode: blk.opcode, field: fname, value: String(fv) } };
  }

  function specOf(B, id, depth) {
    const b = B[id];
    if (!b || depth > 200) return null;
    const spec = { opcode: b.opcode };
    if (b.opcode === 'procedures_call') {
      spec.proccode = b.mutation ? b.mutation.proccode : '';
      let ids = [];
      try { ids = JSON.parse((b.mutation && b.mutation.argumentids) || '[]'); } catch (e) { ids = []; }
      spec.args = ids.map((aid) => {
        const inp = b.inputs[aid];
        if (!inp || !inp.block || !B[inp.block]) return { text: '' };
        const blk = B[inp.block];
        return blk.shadow ? shadowSpec(blk) : { block: specOf(B, inp.block, depth + 1) };
      });
      return spec;
    }
    const fields = {};
    Object.keys(b.fields || {}).forEach((k) => {
      const f = b.fields[k];
      fields[k] = VAR_FIELDS[k] ? { [VAR_FIELDS[k]]: f.value } : f.value;
    });
    if (Object.keys(fields).length) spec.fields = fields;
    const inputs = {};
    Object.keys(b.inputs || {}).forEach((k) => {
      const inp = b.inputs[k];
      if (/^SUBSTACK/.test(k)) { inputs[k] = { stack: stackSpecOf(B, inp.block, depth + 1) }; return; }
      if (!inp.block || !B[inp.block]) return;
      const blk = B[inp.block];
      inputs[k] = blk.shadow ? shadowSpec(blk) : { block: specOf(B, inp.block, depth + 1) };
    });
    if (Object.keys(inputs).length) spec.inputs = inputs;
    return spec;
  }

  function stackSpecOf(B, id, depth) {
    const out = [];
    let cur = id;
    let guard = 0;
    while (cur && B[cur] && guard++ < 2000) {
      out.push(specOf(B, cur, depth || 0));
      cur = B[cur].next;
    }
    return out;
  }

  function getScripts(p) {
    const vm = vmOrThrow();
    const t = p.sprite ? targetOrThrow(vm, p.sprite) : vm.editingTarget;
    if (!t) throw new Error('スプライトが選ばれていません');
    const B = t.blocks._blocks;
    const tops = t.blocks.getScripts().filter((id) => B[id] && !B[id].shadow);
    // 上から順（同じ高さなら左から）に並べる
    tops.sort((a, b) => ((B[a].y || 0) - (B[b].y || 0)) || ((B[a].x || 0) - (B[b].x || 0)));
    return {
      sprite: t.isStage ? 'Stage' : t.getName(),
      scripts: tops.map((id) => ({ topId: id, x: B[id].x || 0, y: B[id].y || 0, blocks: stackSpecOf(B, id, 0) })),
      functions: listFunctions(t),
      targetId: t.id,
      lists: (function () {
        const names = [];
        const add = (tt) => Object.values(tt.variables || {}).forEach((v) => { if (v.type === 'list' && v.name !== MEMO_NAME && !names.includes(v.name)) names.push(v.name); });
        add(t);
        const st = vm.runtime.getTargetForStage();
        if (st && st !== t) add(st);
        return names;
      })(),
      sprites: vm.runtime.targets.filter((x) => x.isOriginal).map((x) => ({ id: x.id, name: x.isStage ? 'Stage' : x.getName() }))
    };
  }

  async function replaceScripts(p) {
    const vm = vmOrThrow();
    const t = targetOrThrow(vm, p.sprite);
    const remove = Array.isArray(p.removeTopIds) ? p.removeTopIds : [];
    const scripts = Array.isArray(p.scripts) ? p.scripts : [];
    // 先に全部作れるか確かめる（失敗したら何も変えない）
    const created = [];
    for (const sc of scripts) {
      const test = { list: [], count: 0, created: [] };
      await makeStack(vm, t, sc.blocks, null, test);
      test.created.forEach((c) => created.push(c));
    }
    const spots = [];
    let removed = 0;
    remove.forEach((id) => {
      if (!t.blocks.getBlock(id)) return;
      const r = removeScript(t, id);
      spots.push({ x: r.x || 40, y: r.y || 40 });
      removed += r.count;
    });
    let added = 0;
    let lastY = spots.length ? Math.max(...spots.map((s) => s.y)) : 40;
    for (let i = 0; i < scripts.length; i++) {
      let spot = spots[i];
      if (!spot) {
        lastY += 260;
        spot = { x: spots[0] ? spots[0].x : 40, y: lastY };
      }
      const r = await insertScript(vm, t, scripts[i].blocks, spot.x, spot.y);
      added += r.count;
      r.created.forEach((c) => created.push(c));
    }
    if (vm.editingTarget !== t) vm.setEditingTarget(t.id);
    refresh(vm);
    return { ok: true, removed, added, created };
  }


  // このスプライトの定義ブロックのうち、「名前 %s %s」の形のもの（関数として使える）
  function listFunctions(t) {
    const B = t.blocks._blocks;
    const out = {};
    Object.values(B).forEach((b) => {
      if (b.opcode !== 'procedures_prototype' || !b.mutation) return;
      const parent = B[b.parent];
      if (!parent || parent.opcode !== 'procedures_definition') return;
      const m = /^([^\s%]+)((?: %s)*)$/.exec(b.mutation.proccode || '');
      if (!m) return;
      let names = [];
      try { names = JSON.parse(b.mutation.argumentnames || '[]'); } catch (e) { names = []; }
      out[m[1]] = { params: names };
    });
    return out;
  }

  // 定義ブロック（関数）を作る。同じ名前のものがあれば作り直す
  async function defineFunction(p) {
    const vm = vmOrThrow();
    const t = targetOrThrow(vm, p.sprite);
    const name = String(p.name || '');
    const params = Array.isArray(p.params) ? p.params.map(String) : [];
    if (!/^[^\s%]+$/.test(name)) throw new Error('関数の名前がおかしいです');
    const proccode = name + ' %s'.repeat(params.length);
    const B = t.blocks._blocks;
    let spot = null;
    const old = findPrototype(t, proccode);
    if (old && B[old.parent] && B[old.parent].opcode === 'procedures_definition') {
      const r = removeScript(t, old.parent);
      spot = { x: r.x, y: r.y };
    }
    if (!spot) {
      const fs = freeSpot(t);
      const defs = Object.values(t.blocks._blocks).filter((b) => b.opcode === 'procedures_definition' && b.topLevel);
      spot = { x: fs.x, y: 40 + defs.length * 320 };
    }
    // 先に中身が作れるか確かめる
    const test = { list: [], count: 0, created: [] };
    const ids = params.map(() => uid());
    const defId = uid();
    const protoId = uid();
    const proto = {
      id: protoId, opcode: 'procedures_prototype', next: null, parent: defId, inputs: {}, fields: {}, shadow: true, topLevel: false,
      mutation: {
        tagName: 'mutation', children: [], proccode,
        argumentids: JSON.stringify(ids), argumentnames: JSON.stringify(params),
        argumentdefaults: JSON.stringify(params.map(() => '')), warp: p.warp === false ? 'false' : 'true'
      }
    };
    const argBlocks = params.map((pn, i) => {
      const aid = uid();
      proto.inputs[ids[i]] = { name: ids[i], block: aid, shadow: aid };
      return { id: aid, opcode: 'argument_reporter_string_number', next: null, parent: protoId, inputs: {}, fields: { VALUE: { name: 'VALUE', value: pn } }, shadow: true, topLevel: false };
    });
    const def = {
      id: defId, opcode: 'procedures_definition', next: null, parent: null, shadow: false, topLevel: true, x: spot.x, y: spot.y,
      inputs: { custom_block: { name: 'custom_block', block: protoId, shadow: protoId } }, fields: {}
    };
    // 自分を呼ぶ関数でも作れるように、先に定義の外側を置く
    [def, proto].concat(argBlocks).forEach((b) => t.blocks.createBlock(b));
    const ctx = { list: [], count: 0, created: [] };
    try {
      const first = await makeStack(vm, t, p.body || [], defId, ctx);
      def.next = first;
      ctx.list.forEach((b) => t.blocks.createBlock(b));
    } catch (e) {
      const ids2 = new Set([defId, protoId].concat(argBlocks.map((b) => b.id)));
      ids2.forEach((id) => { delete t.blocks._blocks[id]; });
      t.blocks._scripts = t.blocks._scripts.filter((sid) => !ids2.has(sid));
      if (typeof t.blocks.resetCache === 'function') t.blocks.resetCache();
      throw e;
    }
    if (typeof t.blocks.resetCache === 'function') t.blocks.resetCache();
    recentTops.push(defId);
    refresh(vm);
    void test;
    return { ok: true, name, created: ctx.created, count: ctx.count + 1 };
  }

  // 全画面のステージ表示用：小さいJPEGにして軽くする（描いた直後に写すので、絵が消える前に取れる）
  let frameCanvas = null;
  function stageFrame() {
    const vm = vmOrThrow();
    watchVm(vm);
    const r = vm.renderer;
    if (!r || !r.canvas) throw new Error('ステージがありません');
    if (!frameCanvas) { frameCanvas = document.createElement('canvas'); frameCanvas.width = 360; frameCanvas.height = 270; }
    const g = frameCanvas.getContext('2d');
    try { r.draw(); } catch (e) { /* noop */ }
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 360, 270);
    g.drawImage(r.canvas, 0, 0, 360, 270);
    return {
      url: frameCanvas.toDataURL('image/jpeg', 0.8),
      running: !!(vm.runtime.threads && vm.runtime.threads.some((t) => !t.updateMonitor)),
      question: lastQuestion
    };
  }

  // 「質問して待つ」を全画面でも答えられるように、質問を知らせる
  let lastQuestion = null;
  function watchVm(vm) {
    if (vm.__blockAiWatch) return;
    vm.__blockAiWatch = true;
    // スプライトが見えているときは、質問はふきだし（SAY）で出て、QUESTION は空になるので、ふきだしの文を使う
    let lastSay = '';
    vm.runtime.on('SAY', (t, type, text) => { lastSay = text ? String(text) : lastSay; });
    vm.runtime.on('QUESTION', (q) => {
      lastQuestion = q === null || q === undefined ? null : (String(q) || lastSay);
      window.postMessage({ source: PAGE, event: 'question', data: { q: lastQuestion } }, location.origin);
    });
  }
  function answerQuestion(p) {
    const vm = vmOrThrow();
    watchVm(vm);
    const before = lastQuestion;
    lastQuestion = null;
    vm.runtime.emit('ANSWER', String(p.text === undefined ? '' : p.text));
    // 次の質問がなければ、Scratchの画面の質問の欄も閉じる
    setTimeout(() => { if (lastQuestion === null && before !== null) { try { vm.runtime.emit('QUESTION', null); } catch (e) { /* noop */ } } }, 30);
    return { ok: true };
  }

  // 全画面のステージをクリック・キーで動かす
  function stageMouse(p) {
    const vm = vmOrThrow();
    const c = vm.renderer && vm.renderer.canvas;
    const w = (c && c.clientWidth) || 480;
    const h = (c && c.clientHeight) || 360;
    const fx = Math.max(0, Math.min(1, Number(p.fx) || 0));
    const fy = Math.max(0, Math.min(1, Number(p.fy) || 0));
    const data = { x: Math.max(1, Math.min(w - 1, fx * w)), y: Math.max(1, Math.min(h - 1, fy * h)), canvasWidth: w, canvasHeight: h };
    if (p.isDown !== undefined) data.isDown = !!p.isDown;
    vm.postIOData('mouse', data);
    return { ok: true };
  }
  function stageKey(p) {
    const vm = vmOrThrow();
    vm.postIOData('keyboard', { key: keyName(p.key), isDown: !!p.isDown });
    return { ok: true };
  }

  // スプライトの一覧と、えらぶ
  function listSprites() {
    const vm = vmOrThrow();
    const list = vm.runtime.targets.filter((t) => t.isOriginal).map((t) => ({ id: t.id, name: t.isStage ? 'Stage' : t.getName(), isStage: !!t.isStage }));
    return { sprites: list, current: vm.editingTarget ? vm.editingTarget.id : '' };
  }
  function selectSprite(p) {
    const vm = vmOrThrow();
    const t = vm.runtime.getTargetById(p.id);
    if (!t) throw new Error('スプライトが見つかりません');
    vm.setEditingTarget(t.id);
    return { ok: true };
  }

  // ためしに動かす用
  function greenFlag() { const vm = vmOrThrow(); vm.greenFlag(); return { ok: true }; }
  function threadCount() { const vm = vmOrThrow(); return { n: vm.runtime.threads ? vm.runtime.threads.filter((t) => !t.updateMonitor).length : 0 }; }
  function stopAll() { const vm = vmOrThrow(); vm.stopAll(); return { ok: true }; }

  // ---------------------------------------------------------------
  // 印をつける
  // ---------------------------------------------------------------
  let glowing = [];

  function focusBlock(id) {
    const ws = findWorkspace();
    if (ws && typeof ws.centerOnBlock === 'function' && ws.getBlockById(id)) {
      try { ws.centerOnBlock(id); } catch (e) { /* noop */ }
    }
  }

  async function highlight(p) {
    const vm = vmOrThrow();
    const t = targetOrThrow(vm, p.sprite);
    const ids = (p.block_ids || []).filter((id) => t.blocks.getBlock(id));
    if (!ids.length) throw new Error('そのスプライトに指定のブロックがありません');
    clearHighlight();
    if (vm.editingTarget !== t) {
      vm.setEditingTarget(t.id);
      await new Promise((r) => setTimeout(r, 400));
    }
    const ws = findWorkspace();
    ids.forEach((id) => { try { glowOne(ws, id, true); } catch (e) { /* noop */ } });
    glowing = ids.slice();
    focusBlock(ids[0]);
    return { ok: true, ids };
  }

  // 古いScratchは glowBlock、新しいScratch（いまの scratch.mit.edu）は glowStack で、そのスクリプトを光らせる
  function glowOne(ws, id, on) {
    if (!ws) return;
    if (typeof ws.glowBlock === 'function') { ws.glowBlock(id, on); return; }
    const b = ws.getBlockById && ws.getBlockById(id);
    if (!b) return;
    const SB = findScratchBlocks();
    const root = b.getRootBlock ? b.getRootBlock() : b;
    if (SB && typeof SB.glowStack === 'function') SB.glowStack(root.id, on);
    else if (typeof b.setGlowBlock === 'function') b.setGlowBlock(on);
  }

  function clearHighlight() {
    const ws = findWorkspace();
    glowing.forEach((id) => { try { glowOne(ws, id, false); } catch (e) { /* noop */ } });
    glowing = [];
    return { ok: true };
  }

  function getBlockRects(p) {
    const ws = findWorkspace();
    const rects = {};
    (p.ids || []).forEach((id) => {
      let el = null;
      if (ws) {
        const b = ws.getBlockById(id);
        if (b && b.getSvgRoot) el = b.getSvgRoot();
      }
      if (!el) el = document.querySelector('[data-id="' + CSS.escape(id) + '"]');
      if (el) {
        // ブロック本体（path）の大きさを使う
        const path = el.querySelector(':scope > path') || el;
        const r = path.getBoundingClientRect();
        rects[id] = { left: r.left, top: r.top, width: r.width, height: r.height };
      }
    });
    return { rects };
  }

  function status() {
    const vm = findVM();
    const ws = document.querySelector('.blocklyWorkspace');
    const wrapper = document.querySelector('[class*="gui_blocks-wrapper"]') || document.querySelector('.injectionDiv');
    let rect = null;
    if (wrapper) {
      const r = wrapper.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) rect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    }
    return { vm: !!vm, editor: !!ws && !!rect, rect };
  }

  // ---------------------------------------------------------------
  // メッセージ受付
  // ---------------------------------------------------------------
  // ---------------------------------------------------------------
  // 学習モード用：作品の読みこみ・状態を調べる・採点用に動かす
  // ---------------------------------------------------------------
  const sayMap = new Map();
  let sayWatched = null;
  function ensureSayWatch(vm) {
    if (sayWatched === vm) return;
    sayWatched = vm;
    vm.runtime.on('SAY', (t, type, text) => { if (t && t.id) sayMap.set(t.id, text ? String(text) : ''); });
  }
  const round1 = (n) => Math.round(Number(n) * 10) / 10;
  function stateOf(vm) {
    const sprites = {};
    const vars = {};
    const lists = {};
    vm.runtime.targets.filter((t) => t.isOriginal).forEach((t) => {
      Object.values(t.variables || {}).forEach((v) => {
        if (v.type === '') vars[v.name] = v.value;
        else if (v.type === 'list' && v.name !== MEMO_NAME) lists[v.name] = Array.isArray(v.value) ? v.value.slice(0, 200) : [];
      });
      if (t.isStage) return;
      const costumes = t.getCostumes ? t.getCostumes() : [];
      sprites[t.getName()] = {
        x: round1(t.x), y: round1(t.y), dir: round1(t.direction), size: Math.round(t.size),
        visible: !!t.visible, costume: costumes[t.currentCostume] ? costumes[t.currentCostume].name : '',
        say: (() => { try { const st = t.getCustomState && t.getCustomState('Scratch.looks'); return st && st.text ? String(st.text) : ''; } catch (e) { return sayMap.get(t.id) || ''; } })()
      };
    });
    return { sprites, vars, lists };
  }
  function getState() {
    const vm = vmOrThrow();
    ensureSayWatch(vm);
    return stateOf(vm);
  }
  function applyOp(vm, op) {
    if (!op || typeof op !== 'object') return;
    if (op.sprite) {
      const t = vm.runtime.targets.find((x) => x.isOriginal && !x.isStage && x.getName() === op.sprite);
      if (!t) return;
      if (typeof op.x === 'number' || typeof op.y === 'number') t.setXY(typeof op.x === 'number' ? op.x : t.x, typeof op.y === 'number' ? op.y : t.y);
      if (typeof op.visible === 'boolean') t.setVisible(op.visible);
      if (op.follow) {
        const o = vm.runtime.targets.find((x) => x.isOriginal && !x.isStage && x.getName() === op.follow);
        if (o) t.setXY(o.x + (Number(op.dx) || 0), o.y + (Number(op.dy) || 0));
      }
    }
    if (op.variable) {
      vm.runtime.targets.filter((x) => x.isOriginal).forEach((x) => {
        Object.values(x.variables || {}).forEach((v) => { if (v.type === '' && v.name === op.variable) v.value = op.value; });
      });
    }
  }
  async function runTest(p) {
    const vm = vmOrThrow();
    ensureSayWatch(vm);
    const ms = Math.max(200, Math.min(15000, Number(p.ms) || 3000));
    const sampleMs = Math.max(50, Math.min(1000, Number(p.sampleMs) || 100));
    vm.stopAll();
    sayMap.clear();
    const timers = [];
    const pressed = new Set();
    if (p.flag !== false) vm.greenFlag();
    (Array.isArray(p.setup) ? p.setup.slice(0, 30) : []).forEach((op) => {
      const at = Math.max(0, Number(op.at) || 0);
      if (op.every) timers.push(setTimeout(() => { timers.push(setInterval(() => applyOp(vm, op), Math.max(30, Number(op.every)))); }, at));
      else timers.push(setTimeout(() => applyOp(vm, op), at));
    });
    (Array.isArray(p.keys) ? p.keys.slice(0, 30) : []).forEach((k) => {
      const key = keyName(k.key);
      const at = Math.max(0, Number(k.at) || 0);
      const hold = Math.max(30, Math.min(5000, Number(k.hold) || 200));
      timers.push(setTimeout(() => { pressed.add(key); vm.postIOData('keyboard', { key, isDown: true }); }, at));
      timers.push(setTimeout(() => { pressed.delete(key); vm.postIOData('keyboard', { key, isDown: false }); }, at + hold));
    });
    const samples = [];
    const start = Date.now();
    await new Promise((resolve) => {
      const tick = () => {
        const t = Date.now() - start;
        samples.push(Object.assign({ t }, stateOf(vm)));
        if (t >= ms || samples.length >= 400) return resolve();
        setTimeout(tick, sampleMs);
      };
      tick();
    });
    timers.forEach((id) => { clearTimeout(id); clearInterval(id); });
    pressed.forEach((key) => vm.postIOData('keyboard', { key, isDown: false }));
    if (p.stop !== false) vm.stopAll();
    return { samples };
  }
  async function loadProject(p) {
    const vm = vmOrThrow();
    let input = null;
    if (p.sb3 instanceof ArrayBuffer) input = p.sb3;
    else if (p.sb3 && p.sb3.buffer instanceof ArrayBuffer) input = p.sb3.buffer;
    else if (typeof p.json === 'string') input = p.json;
    else if (p.json && typeof p.json === 'object') input = JSON.stringify(p.json);
    if (!input) throw new Error('読みこむ作品がありません');
    vm.stopAll();
    await vm.loadProject(input);
    const first = vm.runtime.targets.find((t) => t.isOriginal && !t.isStage);
    if (first) vm.setEditingTarget(first.id);
    try { vm.emitWorkspaceUpdate(); } catch (e) { /* noop */ }
    sayMap.clear();
    return { ok: true, sprites: vm.runtime.targets.filter((t) => t.isOriginal && !t.isStage).map((t) => t.getName()) };
  }

  // 窓口の自己チェック：どの機能が使えるか（Scratchが更新されたときの確認用）
  function capabilities() {
    const SB = findScratchBlocks();
    let vm = null;
    try { vm = findVM(); } catch (e) { vm = null; }
    const proto = SB && SB.BlockSvg && SB.BlockSvg.prototype;
    return {
      bridge: '0.12.0',
      learn: true,
      vm: !!vm,
      blocks: !!SB,
      contextMenu: !!(proto && (typeof proto.generateContextMenu === 'function' || typeof proto.showContextMenu_ === 'function')),
      glow: !!(SB && (typeof SB.glowStack === 'function' || (SB.getMainWorkspace && SB.getMainWorkspace() && typeof SB.getMainWorkspace().glowBlock === 'function'))),
      stage: !!(vm && vm.renderer)
    };
  }

  const METHODS = {
    capabilities,
    getState,
    runTest,
    loadProject,
    status,
    getProjectDump,
    snapshot,
    undo,
    addScript,
    replaceScript,
    deleteScript,
    createSprite,
    addCostume,
    manageVariable,
    setMonitor,
    renameSprite,
    deleteSprite,
    duplicateSprite,
    deleteCostume,
    deleteSound,
    addSound,
    lookStage,
    editBlocks,
    runAndWatch,
    readMemoList,
    writeMemoList,
    getScripts,
    replaceScripts,
    defineFunction,
    greenFlag,
    stageFrame,
    answerQuestion,
    stageMouse,
    stageKey,
    listSprites,
    selectSprite,
    threadCount,
    stopAll,
    highlight,
    clearHighlight,
    getBlockRects
  };

  window.addEventListener('message', async (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.source !== CS || !d.id || !METHODS[d.method]) return;
    let reply;
    try {
      const result = await METHODS[d.method](d.params || {});
      reply = { source: PAGE, id: d.id, result };
    } catch (e) {
      reply = { source: PAGE, id: d.id, error: String((e && e.message) || e) };
    }
    window.postMessage(reply, location.origin);
  });
  }

  const me = typeof document !== 'undefined' ? document.currentScript : null;
  if ((me && me.src && me.src.indexOf(REMOTE) === 0) || typeof document === 'undefined' || typeof document.createElement !== 'function') { start(); return; }
  let done = false;
  const local = () => { if (done) return; done = true; start(); };
  try {
    const s = document.createElement('script');
    s.src = REMOTE + '?h=' + Math.floor(Date.now() / 600000);
    s.onload = () => { if (window.__blockAiBridge) done = true; else local(); };
    s.onerror = local;
    setTimeout(local, 5000);
    (document.head || document.documentElement).appendChild(s);
  } catch (e) { local(); }
})();
