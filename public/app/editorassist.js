/* コード欄の入力サポート（学習モードと、普段のモードのコード欄で使う）
 *  - 入力候補（Ctrl+Space でも出る）：命令・変数を説明つきで出す
 *  - かっこ・引用符を自動で閉じる／閉じかっこは上書き／ペアごと消す
 *  - 自動の字下げ（: のあと）、Tab / Shift+Tab（複数行も）、字下げの Backspace
 *  - 全角の記号・数字を半角に直す（文字列とコメントの中はそのまま）
 *  - いまの行と、対応するかっこの強調
 *  - 下の案内バー：命令の使い方（引数）、書きまちがいのお知らせ
 *  - Ctrl+/ でコメントにする・もどす
 *  編集は execCommand('insertText') で行い、Ctrl+Z で元にもどせるようにする。
 */
(function (root) {
  'use strict';
  const BC = root.BlockCode;

  // 子ども向けの説明（ないものは、変換表の日本語名を使う）
  const DESC = {
    move: '〇歩動かす', turn_right: '右に〇度回す', turn_left: '左に〇度回す',
    go_to: 'x座標を〇、y座標を〇にする', glide_to: '〇秒でx座標〇、y座標〇へ行く',
    change_x: 'x座標を〇ずつ変える（右へ＋、左へ−）', set_x: 'x座標を〇にする',
    change_y: 'y座標を〇ずつ変える（上へ＋、下へ−）', set_y: 'y座標を〇にする',
    point_in_direction: '〇度に向ける', bounce_on_edge: 'もし端に着いたら、跳ね返る',
    say_for: '〇と〇秒言う', print: '〇と言う（ずっとふきだしが出る）', think_for: '〇と〇秒考える',
    switch_costume: 'コスチュームを〇にする', next_costume: '次のコスチュームにする',
    show: '表示する', hide: '隠す', set_size: '大きさを〇%にする', change_size: '大きさを〇ずつ変える',
    play_sound: '〇の音を鳴らす', wait: '〇秒待つ', stop: '止める（"すべて" など）',
    broadcast: '〇を送る（メッセージ）', broadcast_and_wait: '〇を送って待つ',
    create_clone: '〇のクローンを作る', delete_this_clone: 'このクローンを削除する',
    input: '質問して待つ → 答えが入る', int: '数にする（"12" → 12）', str: '文字にする（12 → "12"）',
    len: 'リストの長さ・文字の数', random: '〇から〇までの乱数', append: 'リストに追加する',
    key_pressed: '〇キーが押されたか（True / False）', touching: '〇に触れたか（True / False）',
    x_position: 'x座標', y_position: 'y座標', direction: '向き', answer: '答え',
    'while True:': 'ずっと（くり返す）', while: '〇のあいだ、くり返す', if: 'もし〇なら', elif: 'そうではなく、もし〇なら',
    'else:': 'でなければ', for: '〇回くり返す（for i in range(回数):）', True: 'ほんとう', False: 'うそ',
    and: 'かつ', or: 'または', not: 'ではない',
    go_to_target: '〇（「ランダムな場所」やスプライト）へ行く', point_towards: '〇の方へ向ける', set_rotation_style: '回転方法を〇にする',
    think: '〇と考える（ずっと出る）', switch_backdrop: '背景を〇にする', change_effect: '〇の効果を〇ずつ変える', set_effect: '〇の効果を〇にする',
    go_to_layer: '最前面・最背面へ移動する', play_sound_until_done: '終わるまで〇の音を鳴らす', change_volume: '音量を〇ずつ変える', set_volume: '音量を〇%にする',
    ask: '〇と聞いて待つ（ふつうは input() を使う）', reset_timer: 'タイマーを0にもどす', show_variable: '変数〇を表示する', hide_variable: '変数〇を隠す',
    list_add: 'リスト〇に〇を追加する', list_delete: 'リスト〇の〇番目を削除する', list_clear: 'リスト〇のすべてを削除する',
    list_insert: 'リスト〇の〇番目に〇を挿入する', list_replace: 'リスト〇の〇番目を〇で置きかえる',
    pen_down: 'ペンを下ろす（動くと線がかける）', pen_up: 'ペンを上げる', pen_clear: 'ペンでかいた線を全部消す', stamp: 'スタンプする',
    set_pen_size: 'ペンの太さを〇にする', change_pen_size: 'ペンの太さを〇ずつ変える', set_pen_color: 'ペンの色を〇にする',
    size: '大きさ（%）', touching_color: '〇色に触れたか（True / False）', distance_to: '〇までの距離',
    mouse_down: 'マウスが押されたか（True / False）', mouse_x: 'マウスのx座標', mouse_y: 'マウスのy座標', timer: 'タイマー（秒）', volume: '音量',
    join: '〇と〇（文字をつなぐ）', letter_of: '〇の〇文字目', contains: '〇に〇が含まれるか（True / False）', round: '〇を四捨五入した数',
    list_item: 'リスト〇の〇番目', list_length: 'リスト〇の長さ', list_contains: 'リスト〇に〇が含まれるか（True / False）',
    when_flag_clicked: '緑の旗が押されたとき', when_key_pressed: '〇キーが押されたとき（"スペース" "右向き矢印" など）',
    when_this_sprite_clicked: 'このスプライトが押されたとき', when_stage_clicked: 'ステージが押されたとき',
    when_broadcast_received: 'メッセージ〇を受け取ったとき', when_i_start_as_clone: 'クローンされたとき', when_backdrop_switches_to: '背景が〇になったとき'
  };
  // 引数ごとの説明（案内バーで、いま書いている引数を説明する）
  const ARG_HELP = {
    歩数: '何歩動くか（数）', 角度: '何度回すか（数）', x: 'x座標（左右：-240〜240）', y: 'y座標（上下：-180〜180）', 行き先: '"ランダムな場所" や スプライトの名前',
    秒: '何秒か（数。0.5 なども書ける）', xの変化: 'x座標をいくつ変えるか（右へ＋、左へ−）', yの変化: 'y座標をいくつ変えるか（上へ＋、下へ−）',
    向き: '向き（90 が右、-90 が左、0 が上、180 が下）', 向く先: '"マウスのポインター" や スプライトの名前', 回転方法: '"左右のみ" "回転しない" "自由に回転"',
    ことば: '言うこと（文字は "" でかこむ。変数や数も書ける）', コスチューム: 'コスチュームの名前（"" でかこむ）か番号', 背景: '背景の名前（"" でかこむ）',
    変える量: 'いくつ変えるか（数）', 大きさ: '大きさ（数）', 効果: '"色" "幽霊" など', 値: '効果の大きさ（数）', '前／後ろ': '"最前面" か "最背面"',
    音: '音の名前（"" でかこむ）', 音量: '音量（0〜100）', メッセージ: 'メッセージの名前（"" でかこむ）', 止めるもの: '"すべて" "このスクリプト" など',
    もと: '"自分自身" や スプライトの名前', 質問: '質問の文（"" でかこむ）', 変数: '変数の名前', リスト: 'リストの名前', 項目: '入れるもの（文字や数）',
    番号: '何番目か（1から数える）', 色: '色', 最小: 'いちばん小さい数', 最大: 'いちばん大きい数', 相手: '"マウスのポインター" "端" や スプライトの名前',
    キー: 'キーの名前（"スペース" "右向き矢印" "a" など）', 文字1: '1つめの文字', 文字2: '2つめの文字', 文字: '文字', 何文字目: '何文字目か（数）', 数: '数',
    回数: 'くり返す回数（数）', 条件: '正しいかどうか（例：y_position() < -170、答え == "12"）', 追加するもの: 'リストの最後に入れるもの'
  };
  const KEYWORDS = [
    { name: 'while True:', ins: 'while True:', kind: 'kw' },
    { name: 'while', ins: 'while ', caretBack: 0, kind: 'kw', sig: 'while 条件:' },
    { name: 'if', ins: 'if :', caretBack: 1, kind: 'kw', sig: 'if 条件:' },
    { name: 'elif', ins: 'elif :', caretBack: 1, kind: 'kw', sig: 'elif 条件:' },
    { name: 'else:', ins: 'else:', kind: 'kw' },
    { name: 'for', ins: 'for i in range():', caretBack: 2, kind: 'kw', sig: 'for i in range(回数):' },
    { name: 'True', ins: 'True', kind: 'kw' }, { name: 'False', ins: 'False', kind: 'kw' },
    { name: 'and', ins: 'and ', kind: 'kw' }, { name: 'or', ins: 'or ', kind: 'kw' }, { name: 'not', ins: 'not ', kind: 'kw' },
    { name: 'input', ins: 'input()', caretBack: 1, kind: 'fn', sig: 'input(質問)' },
    { name: 'int', ins: 'int()', caretBack: 1, kind: 'fn', sig: 'int(文字)' },
    { name: 'str', ins: 'str()', caretBack: 1, kind: 'fn', sig: 'str(数)' },
    { name: 'len', ins: 'len()', caretBack: 1, kind: 'fn', sig: 'len(リスト)' },
    { name: 'append', ins: 'append()', caretBack: 1, kind: 'fn', sig: 'リスト.append(追加するもの)' }
  ];
  // 引数の名前を日本語に（候補と案内バーで見せる）
  const ARG_JP = {
    steps: '歩数', degrees: '角度', x: 'x', y: 'y', to: '行き先', secs: '秒', dx: 'xの変化', dy: 'yの変化', direction: '向き', towards: '向く先',
    style: '回転方法', message: 'ことば', costume: 'コスチューム', backdrop: '背景', change: '変える量', size: '大きさ', effect: '効果', value: '値',
    front_back: '前／後ろ', sound_menu: '音', volume: '音量', broadcast_input: 'メッセージ', duration: '秒', stop_option: '止めるもの', clone_option: 'もと',
    question: '質問', variable: '変数', list: 'リスト', item: '項目', index: '番号', color: '色', from: '最小', touchingobjectmenu: '相手',
    distancetomenu: '相手', key_option: 'キー', string1: '文字1', string2: '文字2', string: '文字', letter: '何文字目', num: '数'
  };
  const jpArgs0 = (a) => a.split(',').map((t) => t.trim()).filter(Boolean).map((t) => ARG_JP[t] || t).join(', ');
  const jpArgs = (a) => (a.replace(/\s/g, '') === 'from,to' ? '最小, 最大' : jpArgs0(a));
  const HAT_ARG = { KEY_OPTION: '"スペース"', BROADCAST_OPTION: '"メッセージ1"', BACKDROP: '"背景1"' };

  let baseItems = null;
  function buildBase() {
    if (baseItems) return baseItems;
    const list = KEYWORDS.slice();
    const jp = {};
    try { (BC.COMMANDS || []).concat(BC.REPORTERS || []).forEach((r) => { if (Array.isArray(r) && r[1]) jp[r[1]] = r[0]; }); } catch (e) { /* noop */ }
    const seen = new Set(list.map((x) => x.name));
    try {
      const ref = BC.reference('py') || {};
      Object.keys(ref).forEach((k) => (Array.isArray(ref[k]) ? ref[k] : []).forEach((s) => {
        const m = /^([A-Za-z_][A-Za-z0-9_]*)\(([^)]*)\)/.exec(String(s));
        if (!m || seen.has(m[1]) || /^when_/.test(m[1])) return;
        seen.add(m[1]);
        list.push({ name: m[1], ins: m[1] + '()', caretBack: m[2].trim() ? 1 : 0, kind: 'fn', sig: m[1] + '(' + jpArgs(m[2]) + ')', jp: jp[m[1]] });
      }));
    } catch (e) { /* noop */ }
    try {
      (BC.HATS || []).forEach((h) => {
        if (!h.py) return;
        const arg = h.field ? '(' + (HAT_ARG[h.field] || '""') + ')' : '';
        const an = { KEY_OPTION: 'キー', BROADCAST_OPTION: 'メッセージ', BACKDROP: '背景' }[h.field];
        list.push({ name: '@' + h.py, ins: '@' + h.py + arg, kind: 'hat', jp: h.dncl, hat: true, sig: '@' + h.py + (an ? '(' + an + ')' : '') });
      });
    } catch (e) { /* noop */ }
    baseItems = list;
    return list;
  }
  const descOf = (it) => DESC[it.name] || DESC[it.name.replace(/^@/, '')] || it.jp || '';

  const CSS = `
  .ea-layer { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .ea-cur { position: absolute; left: 0; right: 0; background: rgba(127,127,160,.13); }
  .ea-br { position: absolute; border: 1.5px solid #7FD18A; border-radius: 3px; box-sizing: border-box; }
  .ea-br.bad { border-color: #FF6B6F; background: rgba(255,107,111,.18); }
  .ea-pop { position: absolute; z-index: 20; min-width: 260px; max-width: 460px; max-height: 236px; overflow: auto; background: #fff; color: #1F2328; border: 1px solid #C5CCD6; border-radius: 8px; box-shadow: 0 6px 18px rgba(0,0,0,.25); font: 14px/1.4 system-ui, "Hiragino Sans", "Yu Gothic UI", sans-serif; padding: 4px; }
  .ea-item { display: flex; align-items: baseline; gap: 10px; padding: 6px 8px; border-radius: 6px; cursor: pointer; white-space: nowrap; }
  .ea-item.on { background: #EDE6FB; }
  .ea-item b { font-family: "BIZ UDGothic", Consolas, Menlo, monospace; font-weight: 700; color: #3B2C82; }
  .ea-item .k { flex: none; font-size: 11px; color: #fff; border-radius: 4px; padding: 1px 5px; background: #8A93A3; }
  .ea-item .k.fn { background: #4C97FF; } .ea-item .k.kw { background: #E6A21A; } .ea-item .k.var { background: #FF8C1A; } .ea-item .k.hat { background: #C7A700; } .ea-item .k.list { background: #FF661A; }
  .ea-item .d { color: #555B63; font-size: 13px; overflow: hidden; text-overflow: ellipsis; }
  .ea-foot { font-size: 11px; color: #6B7280; padding: 4px 8px 2px; border-top: 1px solid #EEF0F3; margin-top: 2px; }
  .ea-bar { flex: none; min-height: 30px; display: flex; align-items: center; gap: 8px; padding: 4px 12px; font: 13px/1.4 system-ui, "Hiragino Sans", "Yu Gothic UI", sans-serif; color: #AEB4BE; background: rgba(127,127,160,.08); border-top: 1px solid rgba(127,127,160,.2); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .ea-bar code u { text-decoration: none; background: rgba(156,196,255,.25); border-radius: 3px; padding: 0 2px; }
  .ea-bar .ah { color: #F5D88A; }
  .ea-bar.light .ah { color: #8A5A00; }
  .ea-bar code { font-family: "BIZ UDGothic", Consolas, Menlo, monospace; color: #9CC4FF; font-weight: 700; }
  .ea-bar.light { color: #4A5163; background: #F6F7F9; border-top-color: #E3E7EE; }
  .ea-bar.light code { color: #2F5FB3; }
  .ea-bar.warn { color: #5C3B00; background: #FFF1CC; }
  .ea-bar.fix { color: #1F5A32; background: #E3F3E8; }
  `;

  function attach(opt) {
    const ta = opt.ta;
    const wrap = opt.wrap || ta.parentNode;
    const lang = opt.lang || (() => 'py');
    const unit = opt.indentUnit || (() => '    ');
    const rootNode = ta.getRootNode ? ta.getRootNode() : document;
    const doc = ta.ownerDocument || document;
    if (!(rootNode.querySelector && rootNode.querySelector('style[data-ea]'))) {
      const st = doc.createElement('style');
      st.setAttribute('data-ea', '1');
      st.textContent = CSS;
      (rootNode.nodeType === 11 ? rootNode : doc.head || doc.documentElement).appendChild(st);
    }
    const layer = doc.createElement('div');
    layer.className = 'ea-layer';
    wrap.insertBefore(layer, wrap.firstChild);
    const pop = doc.createElement('div');
    pop.className = 'ea-pop';
    pop.hidden = true;
    wrap.appendChild(pop);
    const bar = doc.createElement('div');
    bar.className = 'ea-bar' + (opt.light ? ' light' : '');
    if (opt.barAfter && opt.barAfter.parentNode) opt.barAfter.parentNode.insertBefore(bar, opt.barAfter.nextSibling);
    const TIP = opt.tip || 'Ctrl+Space：入力候補　Ctrl+/：コメントにする　Tab：字下げ';

    let applying = false;
    let items = [];
    let sel = 0;
    let popFrom = -1;
    let flash = null;
    let lintMsg = null;
    let lintTimer = null;

    // ---- 編集（元にもどせるように） ----
    function edit(a, b, text, caretA, caretB) {
      applying = true;
      try {
        ta.focus();
        ta.setSelectionRange(a, b);
        let ok = false;
        try { ok = text === '' ? doc.execCommand('delete', false) : doc.execCommand('insertText', false, text); } catch (e) { ok = false; }
        if (!ok || ta.value.slice(a, a + text.length) !== text) {
          ta.setRangeText(text, a, b, 'end');
          ta.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (typeof caretA === 'number') ta.setSelectionRange(caretA, typeof caretB === 'number' ? caretB : caretA);
      } finally { applying = false; }
      refresh();
    }

    // ---- 文字の位置（いまの行・列） ----
    let measureCtx = null;
    function metrics() {
      const cs = getComputedStyle(ta);
      if (!measureCtx) {
        let c2 = null;
        try { c2 = doc.createElement('canvas').getContext('2d'); } catch (e) { c2 = null; }
        const fsz = parseFloat(cs.fontSize) || 16;
        measureCtx = c2 || { font: '', measureText: (t) => ({ width: [...t].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2E80 ? fsz : fsz * 0.6), 0) }) };
      }
      measureCtx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      return { lh: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6, pl: parseFloat(cs.paddingLeft) || 0, pt: parseFloat(cs.paddingTop) || 0, tab: 4 };
    }
    function posOf(index, m) {
      const v = ta.value;
      const ls = v.lastIndexOf('\n', index - 1) + 1;
      const line = v.slice(0, ls).split('\n').length - 1;
      const text = v.slice(ls, index);
      return { line, x: m.pl + measureCtx.measureText(text).width - ta.scrollLeft, y: m.pt + line * m.lh - ta.scrollTop };
    }

    // ---- 文字列・コメントの中か（行の中だけで調べる） ----
    function scanLine(line) {
      // 各位置が文字列/コメントの中かを返す
      const st = new Array(line.length).fill(0);
      let q = '';
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (q) { st[i] = 1; if (c === q) q = ''; continue; }
        if (c === '"' || c === "'") { q = c; st[i] = 1; continue; }
        if (c === '#') { for (let k = i; k < line.length; k++) st[k] = 2; break; }
      }
      return st;
    }

    // 行のはじめから text の終わりまで読んで、終わりが文字列('str')・コメント('cmt')の中か
    function stateAt(text) {
      let q = '';
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) { if (c === q) q = ''; continue; }
        if (c === '"' || c === "'") q = c;
        else if (c === '#') return 'cmt';
      }
      return q ? 'str' : '';
    }
    function stripComment(line) {
      let q = '';
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (q) { if (c === q) q = ''; continue; }
        if (c === '"' || c === "'") q = c;
        else if (c === '#') return line.slice(0, i).trimEnd();
      }
      return line.trimEnd();
    }

    // ---- 対応するかっこ ----
    const PAIRS = { '(': ')', '[': ']', '{': '}' };
    const CLOSE = { ')': '(', ']': '[', '}': '{' };
    function codeMask() {
      const v = ta.value;
      const mask = new Uint8Array(v.length);
      let off = 0;
      v.split('\n').forEach((ln) => { const s = scanLine(ln); for (let i = 0; i < ln.length; i++) mask[off + i] = s[i]; off += ln.length + 1; });
      return mask;
    }
    function matchAt(i, mask) {
      const v = ta.value;
      const c = v[i];
      if (mask[i]) return null;
      if (PAIRS[c]) {
        let d = 0;
        for (let k = i; k < v.length; k++) { if (mask[k]) continue; if (v[k] === c) d++; else if (v[k] === PAIRS[c]) { d--; if (d === 0) return k; } }
        return -1;
      }
      if (CLOSE[c]) {
        let d = 0;
        for (let k = i; k >= 0; k--) { if (mask[k]) continue; if (v[k] === c) d++; else if (v[k] === CLOSE[c]) { d--; if (d === 0) return k; } }
        return -1;
      }
      return null;
    }

    function drawLayer() {
      layer.innerHTML = '';
      if (doc.activeElement !== ta && (!ta.getRootNode || ta.getRootNode().activeElement !== ta)) return;
      const m = metrics();
      const p = posOf(ta.selectionStart, m);
      const cur = doc.createElement('div');
      cur.className = 'ea-cur';
      cur.style.top = p.y + 'px';
      cur.style.height = m.lh + 'px';
      layer.appendChild(cur);
      if (ta.selectionStart !== ta.selectionEnd) return;
      const v = ta.value;
      const mask = codeMask();
      let at = -1;
      const i = ta.selectionStart;
      if (i > 0 && (PAIRS[v[i - 1]] || CLOSE[v[i - 1]]) && !mask[i - 1]) at = i - 1;
      else if (PAIRS[v[i]] || CLOSE[v[i]]) at = i;
      if (at < 0) return;
      const mt = matchAt(at, mask);
      if (mt === null) return;
      [at, mt].forEach((k, n) => {
        if (k < 0) return;
        const q = posOf(k, m);
        const w = measureCtx.measureText(v[k]).width;
        const b = doc.createElement('div');
        b.className = 'ea-br' + (mt < 0 ? ' bad' : '');
        b.style.cssText = 'left:' + (q.x - 1) + 'px;top:' + (q.y + 1) + 'px;width:' + (w + 2) + 'px;height:' + (m.lh - 2) + 'px';
        layer.appendChild(b);
      });
    }

    // ---- 案内バー ----
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    function callAtCaret() {
      // いちばん内側の、閉じていない「名前(」を探す
      const v = ta.value;
      const i = ta.selectionStart;
      const ls = v.lastIndexOf('\n', i - 1) + 1;
      const line = v.slice(ls, i);
      const mask = scanLine(v.slice(ls, v.indexOf('\n', i) < 0 ? v.length : v.indexOf('\n', i)));
      let d = 0;
      for (let k = line.length - 1; k >= 0; k--) {
        if (mask[k]) continue;
        if (line[k] === ')') d++;
        else if (line[k] === '(') {
          if (d === 0) {
            const m = /([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(line.slice(0, k));
            if (!m) return null;
            // いま何番目の引数か（かっこの中の , を数える）
            let arg = 0;
            let dd = 0;
            for (let j = k + 1; j < line.length; j++) {
              if (mask[j]) continue;
              if ('([{'.includes(line[j])) dd++;
              else if (')]}'.includes(line[j])) dd--;
              else if (line[j] === ',' && dd === 0) arg++;
            }
            return { name: m[1], arg };
          }
          d--;
        }
      }
      const w = /([A-Za-z_][A-Za-z0-9_]*)$/.exec(line);
      const nm = w ? w[1] : (/^\s*(while|if|elif|for)\b/.exec(line) || [])[1] || null;
      return nm ? { name: nm, arg: -1 } : null;
    }
    function updateBar() {
      const now = Date.now();
      bar.classList.remove('warn', 'fix');
      if (flash && flash.until > now) { bar.classList.add(flash.cls); bar.innerHTML = flash.html; return; }
      flash = null;
      if (lang() === 'py') {
        const at = callAtCaret();
        const name = at && at.name;
        const it = name && buildBase().find((x) => x.name === name || x.name === '@' + name || x.name === name + ':');
        if (it) {
          const sig = it.sig || it.name;
          const m = /^([^(]*)\((.*)\)(:?)$/.exec(sig);
          let html = '<code>' + esc(sig) + '</code>';
          let help = '';
          if (m && m[2]) {
            const args = m[2].split(',').map((t) => t.trim());
            const k = at.arg >= 0 ? Math.min(at.arg, args.length - 1) : -1;
            html = '<code>' + esc(m[1]) + '(' + args.map((a, i) => (i === k ? '<u>' + esc(a) + '</u>' : esc(a))).join(', ') + ')' + esc(m[3]) + '</code>';
            if (k >= 0 && ARG_HELP[args[k]]) help = '<span class="ah">' + esc(args[k]) + '：' + esc(ARG_HELP[args[k]]) + '</span>';
          } else if (/条件|回数/.test(sig)) {
            const a = /条件/.test(sig) ? '条件' : '回数';
            help = '<span class="ah">' + a + '：' + esc(ARG_HELP[a]) + '</span>';
          }
          bar.innerHTML = html + '<span>' + esc(descOf(it)) + '</span>' + help;
          return;
        }
      }
      if (lintMsg) { bar.classList.add('warn'); bar.textContent = '⚠ ' + lintMsg; return; }
      bar.textContent = TIP;
    }
    function lintSoon() {
      clearTimeout(lintTimer);
      lintMsg = null;
      if (opt.lint === false || lang() !== 'py' || !BC || !BC.parse) return;
      lintTimer = setTimeout(() => {
        try {
          const r = BC.parse(ta.value, 'py', opt.parseOpts ? opt.parseOpts() : {});
          lintMsg = r && r.error ? r.error.line + '行目：' + r.error.msg : null;
          if (opt.onLint) opt.onLint(r && r.error ? r.error : null);
        } catch (e) { lintMsg = null; }
        updateBar();
      }, 1200);
    }

    // ---- 入力候補 ----
    function wordBefore() {
      const v = ta.value;
      const i = ta.selectionStart;
      const ls = v.lastIndexOf('\n', i - 1) + 1;
      const line = v.slice(ls, i);
      if (stateAt(line) !== '') return null; // 文字列・コメントの中
      const m = /(@?[\p{L}\p{N}_]+)$/u.exec(line);
      if (!m) return { start: i, word: '', atLineStart: /^\s*$/.test(line), afterDot: /\.$/.test(line) };
      const before = line.slice(0, line.length - m[1].length);
      return { start: i - m[1].length, word: m[1], atLineStart: /^\s*$/.test(before), afterDot: /\.$/.test(before) };
    }
    function varsInCode() {
      const out = new Map();
      const re = /^\s*([^\s=()[\]"'#+\-*/<>!,:.@0-9][^\s=()[\]"'#+\-*/<>!,:.]*)\s*=(?!=)\s*(\[)?/gmu;
      let m;
      while ((m = re.exec(ta.value))) {
        if (/^(if|while|for|elif|else|def|and|or|not)$/.test(m[1])) continue;
        out.set(m[1], m[2] ? 'list' : (out.get(m[1]) || 'var'));
      }
      (opt.extraVars ? opt.extraVars() : []).forEach((n) => { if (!out.has(n)) out.set(n, 'var'); });
      return [...out].map(([name, k]) => ({ name, ins: name, kind: k, jp: k === 'list' ? 'リスト' : '変数' }));
    }
    function showPop(force) {
      if (lang() !== 'py') return hidePop();
      const w = wordBefore();
      if (!w) return hidePop();
      const word = w.word;
      const ascii = /^@?[A-Za-z_]/.test(word);
      if (!force && (word.length < (ascii ? 2 : 1))) return hidePop();
      let pool = varsInCode().concat(buildBase());
      if (w.afterDot) pool = pool.filter((x) => x.name === 'append');
      else if (!w.atLineStart) pool = pool.filter((x) => !x.hat);
      const lw = word.toLowerCase();
      let list = pool.filter((x) => x.name.toLowerCase().startsWith(lw) && x.name !== word);
      if (word.length >= 2) list = list.concat(pool.filter((x) => !x.name.toLowerCase().startsWith(lw) && x.name.toLowerCase().includes(lw.replace(/^@/, ''))));
      if (!ascii && !force) list = list.filter((x) => x.kind === 'var' || x.kind === 'list');
      const seen = new Set();
      items = list.filter((x) => (seen.has(x.name) ? false : (seen.add(x.name), true))).slice(0, 30);
      if (!items.length) return hidePop();
      sel = 0;
      popFrom = w.start;
      renderPop();
    }
    function renderPop() {
      pop.innerHTML = '';
      items.forEach((it, k) => {
        const d = doc.createElement('div');
        d.className = 'ea-item' + (k === sel ? ' on' : '');
        d.innerHTML = '<span class="k ' + it.kind + '">' + ({ fn: '命令', kw: '文法', var: '変数', list: 'リスト', hat: 'はじまり' }[it.kind] || '') + '</span><b></b><span class="d"></span>';
        d.querySelector('b').textContent = it.sig || it.name;
        d.querySelector('.d').textContent = descOf(it);
        d.addEventListener('mousedown', (e) => { e.preventDefault(); sel = k; accept(); });
        pop.appendChild(d);
      });
      const f = doc.createElement('div');
      f.className = 'ea-foot';
      f.textContent = '↑↓でえらぶ　Enter / Tab で入れる　Esc で閉じる';
      pop.appendChild(f);
      pop.hidden = false;
      const m = metrics();
      const p = posOf(popFrom, m);
      const H = wrap.clientHeight;
      const ph = Math.min(pop.scrollHeight, 236);
      let top = p.y + m.lh + 2;
      if (top + ph > H && p.y - ph - 2 > 0) top = p.y - ph - 2;
      pop.style.top = Math.max(0, Math.min(top, H - ph)) + 'px';
      pop.style.left = Math.max(0, Math.min(p.x, wrap.clientWidth - 270)) + 'px';
      const on = pop.children[sel];
      if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
    }
    function hidePop() { pop.hidden = true; items = []; popFrom = -1; }
    function accept() {
      const it = items[sel];
      if (!it) return hidePop();
      const end = ta.selectionStart;
      const v = ta.value;
      let ins = it.ins || it.name;
      let back = it.caretBack || 0;
      if (it.hat) {
        const used = (v.match(/def script(\d+)/g) || []).map((s) => Number(s.replace(/\D/g, '')));
        const n = used.length ? Math.max(...used) + 1 : 1;
        ins += '\ndef script' + n + '():\n' + unit();
        back = 0;
      }
      // すでに後ろに「(」があるなら、かっこは足さない
      if (/\(\)$/.test(ins) && v[end] === '(') { ins = ins.slice(0, -2); back = 0; }
      const a = popFrom >= 0 ? popFrom : end;
      hidePop();
      flash = null;
      edit(a, end, ins, a + ins.length - back);
    }

    // ---- 全角を半角に ----
    function fixWidth() {
      if (lang() !== 'py' || applying) return;
      const v = ta.value;
      const i = ta.selectionStart;
      const ls = v.lastIndexOf('\n', i - 1) + 1;
      let le = v.indexOf('\n', i);
      if (le < 0) le = v.length;
      const line = v.slice(ls, le);
      let out = '';
      let q = '';
      let changed = '';
      for (let k = 0; k < line.length; k++) {
        let c = line[k];
        if (!q) {
          const code = c.charCodeAt(0);
          let h = c;
          if (code >= 0xFF01 && code <= 0xFF5E) h = String.fromCharCode(code - 0xFEE0);
          else if (c === '　') h = ' ';
          else if (c === '“' || c === '”') h = '"';
          else if (c === '‘' || c === '’') h = "'";
          if (h !== c) { changed = changed || c; c = h; }
          if (c === '#') { out += c + line.slice(k + 1); break; }
          if (c === '"' || c === "'") q = c;
        } else if (c === q) q = '';
        out += c;
      }
      if (out === line) return;
      const caret = ta.selectionStart;
      edit(ls, le, out, caret);
      flash = { cls: 'fix', html: '全角の「' + esc(changed) + '」を半角に直したよ（プログラムの記号や数字は半角で書こう）', until: Date.now() + 3000 };
      updateBar();
      setTimeout(updateBar, 3100);
    }

    // ---- キー操作 ----
    ta.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      const v = ta.value;
      const st = ta.selectionStart;
      const en = ta.selectionEnd;
      if (!pop.hidden && items.length) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; renderPop(); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); accept(); return; }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hidePop(); return; }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ' ') { e.preventDefault(); showPop(true); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === '/' || e.code === 'Slash')) { e.preventDefault(); toggleComment(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const ls = v.lastIndexOf('\n', st - 1) + 1;
      const u = unit();
      if (e.key === 'Tab') {
        e.preventDefault();
        const multi = v.slice(st, en).includes('\n');
        if (!multi && !e.shiftKey) { edit(st, en, u, st + u.length); return; }
        let le = v.indexOf('\n', Math.max(st, en - 1));
        if (le < 0) le = v.length;
        const block = v.slice(ls, le);
        const lines = block.split('\n');
        const re = u === '    ' ? /^ {1,4}/ : new RegExp('^(' + u.replace(/[|\\]/g, '\\$&') + '|\\|)');
        const done = lines.map((l) => (e.shiftKey ? l.replace(re, '') : (l.trim() ? u + l : l)));
        const nb = done.join('\n');
        const d0 = done[0].length - lines[0].length;
        edit(ls, le, nb, multi ? ls : Math.max(ls, st + d0), multi ? ls + nb.length : Math.max(ls, st + d0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const line = v.slice(ls, st);
        let ind;
        if (opt.enterIndent) ind = opt.enterIndent(line);
        else {
          ind = (/^ */.exec(line) || [''])[0];
          if (stateAt(line) !== 'str' && /:\s*$/.test(stripComment(line))) ind += u;
        }
        edit(st, en, '\n' + ind, st + 1 + ind.length);
        return;
      }
      if (e.key === 'Backspace' && st === en && st > 0) {
        const prev = v[st - 1];
        const next = v[st];
        if ((PAIRS[prev] && PAIRS[prev] === next) || ((prev === '"' || prev === "'") && next === prev)) { e.preventDefault(); edit(st - 1, st + 1, '', st - 1); return; }
        const before = v.slice(ls, st);
        if (u === '    ' && /^ +$/.test(before)) {
          e.preventDefault();
          const n = before.length % 4 || 4;
          edit(st - n, st, '', st - n);
          return;
        }
        return;
      }
      // かっこ・引用符
      const inStr = stateAt(v.slice(ls, st)) !== '';
      if (PAIRS[e.key] && !inStr) {
        e.preventDefault();
        const inner = v.slice(st, en);
        edit(st, en, e.key + inner + PAIRS[e.key], st + 1, st + 1 + inner.length);
        return;
      }
      if (CLOSE[e.key] && st === en && v[st] === e.key) { e.preventDefault(); ta.setSelectionRange(st + 1, st + 1); refresh(); return; }
      if ((e.key === '"' || e.key === "'")) {
        if (st === en && v[st] === e.key) { e.preventDefault(); ta.setSelectionRange(st + 1, st + 1); refresh(); return; }
        if (!inStr && !/[\p{L}\p{N}_]/u.test(v[st] || '')) {
          e.preventDefault();
          const inner = v.slice(st, en);
          edit(st, en, e.key + inner + e.key, st + 1, st + 1 + inner.length);
          return;
        }
      }
    });
    function toggleComment() {
      const v = ta.value;
      const st = ta.selectionStart;
      const en = ta.selectionEnd;
      const ls = v.lastIndexOf('\n', st - 1) + 1;
      let le = v.indexOf('\n', Math.max(st, en - 1));
      if (le < 0) le = v.length;
      const lines = v.slice(ls, le).split('\n');
      const all = lines.filter((l) => l.trim()).every((l) => /^\s*#/.test(l));
      const done = lines.map((l) => (!l.trim() ? l : all ? l.replace(/^(\s*)# ?/, '$1') : l.replace(/^(\s*)/, '$1# ')));
      const nb = done.join('\n');
      edit(ls, le, nb, ls, ls + nb.length);
    }

    ta.addEventListener('input', (e) => {
      if (applying) return;
      lintSoon();
      if (e && e.isComposing) { refresh(); return; }
      fixWidth();
      if (!applying) showPop(false);
      refresh();
    });
    ta.addEventListener('compositionend', () => setTimeout(() => { fixWidth(); showPop(false); refresh(); }, 0));
    ['click', 'keyup', 'focus', 'scroll', 'select'].forEach((t) => ta.addEventListener(t, (e) => {
      if (t === 'keyup' && e && ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key) && !pop.hidden) return;
      if (t === 'click' || (t === 'keyup' && e && /^Arrow|Home|End/.test(e.key))) hidePop();
      refresh();
    }));
    ta.addEventListener('blur', () => setTimeout(() => { hidePop(); layer.innerHTML = ''; }, 120));

    function refresh() {
      try { drawLayer(); } catch (e) { /* noop */ }
      updateBar();
    }
    updateBar();
    return {
      refresh() { lintSoon(); refresh(); },
      hide: hidePop,
      bar
    };
  }

  root.EditorAssist = { attach, _desc: DESC, _items: () => buildBase().map((x) => ({ name: x.name, sig: x.sig || x.name, desc: descOf(x) })) };
})(typeof window !== 'undefined' ? window : globalThis);
