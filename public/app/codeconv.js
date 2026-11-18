// ブロックAIアシスタント - ブロック ⇄ DNCL（共通テスト用プログラム表記）／Python の変換
// ブロックは add_script と同じ形（{opcode, inputs, fields}）であつかう。
(function (root) {
  'use strict';

  // ---------------------------------------------------------------
  // 対応表
  // ---------------------------------------------------------------
  // 引数の種類：n=数の入力 t=文字の入力 c=色 m=メニュー入力 b=メッセージ f=項目 v=変数 L=リスト
  const n = (name) => ({ k: 'n', name });
  const t = (name) => ({ k: 't', name });
  const c = (name) => ({ k: 'c', name });
  const m = (name, opcode, field) => ({ k: 'm', name, opcode, field: field || name });
  const b = (name) => ({ k: 'b', name });
  const f = (name) => ({ k: 'f', name });
  const v = (name) => ({ k: 'v', name });
  const L = (name) => ({ k: 'L', name });

  // [DNCL名, Python名, opcode, 引数]
  const COMMANDS = [
    ['動かす', 'move', 'motion_movesteps', [n('STEPS')]],
    ['右に回す', 'turn_right', 'motion_turnright', [n('DEGREES')]],
    ['左に回す', 'turn_left', 'motion_turnleft', [n('DEGREES')]],
    ['座標を設定する', 'go_to', 'motion_gotoxy', [n('X'), n('Y')]],
    ['移動する', 'go_to_target', 'motion_goto', [m('TO', 'motion_goto_menu')]],
    ['滑らかに移動する', 'glide_to', 'motion_glidesecstoxy', [n('SECS'), n('X'), n('Y')]],
    ['x座標を変える', 'change_x', 'motion_changexby', [n('DX')]],
    ['x座標を設定する', 'set_x', 'motion_setx', [n('X')]],
    ['y座標を変える', 'change_y', 'motion_changeyby', [n('DY')]],
    ['y座標を設定する', 'set_y', 'motion_sety', [n('Y')]],
    ['向きを設定する', 'point_in_direction', 'motion_pointindirection', [n('DIRECTION')]],
    ['向ける', 'point_towards', 'motion_pointtowards', [m('TOWARDS', 'motion_pointtowards_menu')]],
    ['端で跳ね返る', 'bounce_on_edge', 'motion_ifonedgebounce', []],
    ['回転方法を設定する', 'set_rotation_style', 'motion_setrotationstyle', [f('STYLE')]],
    ['言う', 'say_for', 'looks_sayforsecs', [t('MESSAGE'), n('SECS')]],
    ['表示する', 'print', 'looks_say', [t('MESSAGE')]],
    ['考える', 'think_for', 'looks_thinkforsecs', [t('MESSAGE'), n('SECS')]],
    ['考えを表示する', 'think', 'looks_think', [t('MESSAGE')]],
    ['コスチュームを変える', 'switch_costume', 'looks_switchcostumeto', [m('COSTUME', 'looks_costume')]],
    ['次のコスチュームにする', 'next_costume', 'looks_nextcostume', []],
    ['背景を変える', 'switch_backdrop', 'looks_switchbackdropto', [m('BACKDROP', 'looks_backdrops')]],
    ['次の背景にする', 'next_backdrop', 'looks_nextbackdrop', []],
    ['大きさを変える', 'change_size', 'looks_changesizeby', [n('CHANGE')]],
    ['大きさを設定する', 'set_size', 'looks_setsizeto', [n('SIZE')]],
    ['効果を変える', 'change_effect', 'looks_changeeffectby', [f('EFFECT'), n('CHANGE')]],
    ['効果を設定する', 'set_effect', 'looks_seteffectto', [f('EFFECT'), n('VALUE')]],
    ['効果をなくす', 'clear_effects', 'looks_cleargraphiceffects', []],
    ['スプライトを表示する', 'show', 'looks_show', []],
    ['スプライトを隠す', 'hide', 'looks_hide', []],
    ['層を移動する', 'go_to_layer', 'looks_gotofrontback', [f('FRONT_BACK')]],
    ['音を鳴らす', 'play_sound', 'sound_play', [m('SOUND_MENU', 'sound_sounds_menu')]],
    ['終わるまで音を鳴らす', 'play_sound_until_done', 'sound_playuntildone', [m('SOUND_MENU', 'sound_sounds_menu')]],
    ['すべての音を止める', 'stop_all_sounds', 'sound_stopallsounds', []],
    ['音量を変える', 'change_volume', 'sound_changevolumeby', [n('VOLUME')]],
    ['音量を設定する', 'set_volume', 'sound_setvolumeto', [n('VOLUME')]],
    ['送る', 'broadcast', 'event_broadcast', [b('BROADCAST_INPUT')]],
    ['送って待つ', 'broadcast_and_wait', 'event_broadcastandwait', [b('BROADCAST_INPUT')]],
    ['待つ', 'wait', 'control_wait', [n('DURATION')]],
    ['止める', 'stop', 'control_stop', [f('STOP_OPTION')]],
    ['クローンを作る', 'create_clone', 'control_create_clone_of', [m('CLONE_OPTION', 'control_create_clone_of_menu')]],
    ['このクローンを削除する', 'delete_this_clone', 'control_delete_this_clone', []],
    ['尋ねる', 'ask', 'sensing_askandwait', [t('QUESTION')]],
    ['タイマーをリセットする', 'reset_timer', 'sensing_resettimer', []],
    ['変数を表示する', 'show_variable', 'data_showvariable', [v('VARIABLE')]],
    ['変数を隠す', 'hide_variable', 'data_hidevariable', [v('VARIABLE')]],
    ['追加する', 'list_add', 'data_addtolist', [L('LIST'), t('ITEM')]],
    ['削除する', 'list_delete', 'data_deleteoflist', [L('LIST'), n('INDEX')]],
    ['すべて削除する', 'list_clear', 'data_deletealloflist', [L('LIST')]],
    ['挿入する', 'list_insert', 'data_insertatlist', [L('LIST'), n('INDEX'), t('ITEM')]],
    ['置きかえる', 'list_replace', 'data_replaceitemoflist', [L('LIST'), n('INDEX'), t('ITEM')]],
    ['ペンを下ろす', 'pen_down', 'pen_penDown', []],
    ['ペンを上げる', 'pen_up', 'pen_penUp', []],
    ['全部消す', 'pen_clear', 'pen_clear', []],
    ['スタンプする', 'stamp', 'pen_stamp', []],
    ['ペンの太さを設定する', 'set_pen_size', 'pen_setPenSizeTo', [n('SIZE')]],
    ['ペンの太さを変える', 'change_pen_size', 'pen_changePenSizeBy', [n('SIZE')]],
    ['ペンの色を設定する', 'set_pen_color', 'pen_setPenColorToColor', [c('COLOR')]]
  ];

  const REPORTERS = [
    ['x座標', 'x_position', 'motion_xposition', []],
    ['y座標', 'y_position', 'motion_yposition', []],
    ['向き', 'direction', 'motion_direction', []],
    ['大きさ', 'size', 'looks_size', []],
    ['乱数', 'random', 'operator_random', [n('FROM'), n('TO')]],
    ['触れている', 'touching', 'sensing_touchingobject', [m('TOUCHINGOBJECTMENU', 'sensing_touchingobjectmenu')]],
    ['色に触れている', 'touching_color', 'sensing_touchingcolor', [c('COLOR')]],
    ['距離', 'distance_to', 'sensing_distanceto', [m('DISTANCETOMENU', 'sensing_distancetomenu')]],
    ['キーが押された', 'key_pressed', 'sensing_keypressed', [m('KEY_OPTION', 'sensing_keyoptions')]],
    ['マウスが押された', 'mouse_down', 'sensing_mousedown', []],
    ['マウスのx座標', 'mouse_x', 'sensing_mousex', []],
    ['マウスのy座標', 'mouse_y', 'sensing_mousey', []],
    ['タイマー', 'timer', 'sensing_timer', []],
    ['答え', 'answer', 'sensing_answer', []],
    ['音量', 'volume', 'sound_volume', []],
    ['つなぐ', 'join', 'operator_join', [t('STRING1'), t('STRING2')]],
    ['文字', 'letter_of', 'operator_letter_of', [t('STRING'), n('LETTER')]],
    ['長さ', 'len', 'operator_length', [t('STRING')]],
    ['含む', 'contains', 'operator_contains', [t('STRING1'), t('STRING2')]],
    ['四捨五入', 'round', 'operator_round', [n('NUM')]],
    ['要素', 'list_item', 'data_itemoflist', [L('LIST'), n('INDEX')]],
    ['要素数', 'list_length', 'data_lengthoflist', [L('LIST')]],
    ['リストに含む', 'list_contains', 'data_listcontainsitem', [L('LIST'), t('ITEM')]]
  ];
  const MATHOPS = [['絶対値', 'abs', 'abs'], ['切り捨て', 'floor', 'floor'], ['切り上げ', 'ceil', 'ceiling'], ['平方根', 'sqrt', 'sqrt'], ['sin', 'sin', 'sin'], ['cos', 'cos', 'cos'], ['tan', 'tan', 'tan']];

  // 中の値 ⇄ 見せる言葉
  const VALUE_WORDS = {
    _mouse_: 'マウスのポインター', _edge_: '端', _random_: 'どこかの場所', _myself_: '自分自身', _stage_: 'ステージ',
    space: 'スペース', 'up arrow': '上向き矢印', 'down arrow': '下向き矢印', 'left arrow': '左向き矢印', 'right arrow': '右向き矢印', any: 'どれか',
    all: 'すべて', 'this script': 'このスクリプト', 'other scripts in sprite': 'ほかのスクリプト', 'other scripts in stage': 'ほかのスクリプト（ステージ）',
    'left-right': '左右のみ', "don't rotate": '回転しない', 'all around': '自由に回転',
    front: '最前面', back: '最背面',
    COLOR: '色', GHOST: '幽霊', BRIGHTNESS: '明るさ', FISHEYE: '魚眼レンズ', WHIRL: '渦巻き', PIXELATE: 'ピクセル化', MOSAIC: 'モザイク'
  };
  const WORD_VALUES = {};
  Object.keys(VALUE_WORDS).forEach((k) => { WORD_VALUES[VALUE_WORDS[k]] = k; });
  const toWord = (val) => (Object.prototype.hasOwnProperty.call(VALUE_WORDS, val) ? VALUE_WORDS[val] : val);
  const fromWord = (w) => (Object.prototype.hasOwnProperty.call(WORD_VALUES, w) ? WORD_VALUES[w] : w);

  const HATS = [
    { opcode: 'event_whenflagclicked', dncl: '緑の旗が押されたとき', py: 'when_flag_clicked' },
    { opcode: 'event_whenkeypressed', dncl: 'キーが押されたとき', py: 'when_key_pressed', field: 'KEY_OPTION' },
    { opcode: 'event_whenthisspriteclicked', dncl: 'このスプライトが押されたとき', py: 'when_this_sprite_clicked' },
    { opcode: 'event_whenstageclicked', dncl: 'ステージが押されたとき', py: 'when_stage_clicked' },
    { opcode: 'event_whenbroadcastreceived', dncl: 'を受け取ったとき', py: 'when_broadcast_received', field: 'BROADCAST_OPTION', broadcast: true },
    { opcode: 'control_start_as_clone', dncl: 'クローンされたとき', py: 'when_i_start_as_clone' },
    { opcode: 'event_whenbackdropswitchesto', dncl: '背景が', py: 'when_backdrop_switches_to', field: 'BACKDROP' }
  ];

  // ---------------------------------------------------------------
  // 関数（定義ブロック）：用意済みのものと、作品の中にあるもの（AIが作ったもの）
  // Scratchの定義ブロックは値を返せないので、結果は変数「〇〇の答え」に入れる
  // ---------------------------------------------------------------
  const BUILTINS = {
    べき乗: { params: ['a', 'b'], py: 'pow', code: 'def べき乗(a, b):\n    x = 1\n    for _ in range(abs(b)):\n        x = x * a\n    if b < 0:\n        x = 1 / x\n    return x' },
    最大: { params: ['a', 'b'], py: 'max', code: 'def 最大(a, b):\n    x = b\n    if a > b:\n        x = a\n    return x' },
    最小: { params: ['a', 'b'], py: 'min', code: 'def 最小(a, b):\n    x = b\n    if a < b:\n        x = a\n    return x' }
  };
  const PY_ALIAS = {};
  Object.keys(BUILTINS).forEach((k) => { PY_ALIAS[BUILTINS[k].py] = k; });
  const answerVar = (name) => name + 'の答え';

  // 解析中の情報（関数の一覧、使った関数、関数の中かどうか）
  let CUR = { functions: {}, used: new Set(), inFunction: null, lists: new Set(), strs: new Set(), base: 0 };

  // ---------------------------------------------------------------
  // 配列（Scratchのリスト）
  // 共通テストの書き方は添字が0から（「# 添字は1から」と書けば1から）。Scratchのリストは1からなので、ずらして変換する
  // ---------------------------------------------------------------
  const ID_RE = '[A-Za-z_\\u3040-\\u30FF\\u3400-\\u9FFF\\uFF66-\\uFF9F々ー][A-Za-z0-9_\\u3040-\\u30FF\\u3400-\\u9FFF\\uFF66-\\uFF9F々ー]*';
  const LIST_INDEX_OPS = new Set(['data_itemoflist', 'data_deleteoflist', 'data_insertatlist', 'data_replaceitemoflist']);
  function baseOf(text, fallback) {
    if (/^\s*#\s*添字は\s*1\s*から/m.test(String(text || ''))) return 1;
    if (/^\s*#\s*添字は\s*0\s*から/m.test(String(text || ''))) return 0;
    return fallback === 1 ? 1 : 0;
  }
  // コードを先に見て、どの名前がリストか（文字か）を決める
  function scanNames(text, projectLists) {
    const src = String(text || '').split('\n').map((l) => l.replace(/"[^"]*"|'[^']*'|「[^」]*」/g, '""').replace(/#.*$/, '')).join('\n');
    const lists = new Set();
    const strs = new Set();
    const re = (pat) => new RegExp(pat, 'g');
    let m;
    const lit = re('(' + ID_RE + ')\\s*=\\s*\\[');
    while ((m = lit.exec(src))) lists.add(m[1]);
    const meth = re('(' + ID_RE + ')\\.(append|insert|pop|clear|remove)\\s*\\(');
    while ((m = meth.exec(src))) lists.add(m[1]);
    const del = re('del\\s+(' + ID_RE + ')\\s*\\[');
    while ((m = del.exec(src))) lists.add(m[1]);
    const fn = re('(?:要素数|追加する|削除する|すべて削除する|挿入する|置きかえる|要素|リストに含む|list_\\w+)\\s*\\(\\s*(' + ID_RE + ')');
    while ((m = fn.exec(src))) lists.add(m[1]);
    const assigned = new Set();
    const asg = re('(?:^|[\\s|│└⎿,])(' + ID_RE + ')\\s*=(?!=)(?!\\s*\\[)');
    while ((m = asg.exec(src))) assigned.add(m[1]);
    const idx = re('(' + ID_RE + ')\\s*\\[');
    while ((m = idx.exec(src))) {
      const n = m[1];
      if (lists.has(n)) continue;
      if ((projectLists || []).includes(n)) { lists.add(n); continue; }
      if (assigned.has(n)) { strs.add(n); continue; }
      lists.add(n);
    }
    (projectLists || []).forEach((n) => { if (new RegExp('(^|[^\\w\\u3040-\\u9FFF])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^\\w\\u3040-\\u9FFF]|$)').test(src) && !assigned.has(n)) lists.add(n); });
    return { lists, strs };
  }
  // コードの添字 → Scratchの番号
  function idx1(e) {
    if (CUR.base === 1) return e;
    if (e && 'num' in e && /^-?\d+$/.test(String(e.num).trim())) return { num: String(Number(e.num) + 1) };
    return { block: { opcode: 'operator_add', inputs: { NUM1: withShadow(e, 'n'), NUM2: { num: '1' } } } };
  }
  function listRef(name) { CUR.lists.add(name); return { list: name }; }

  function knownFunctions(extra) {
    const all = {};
    Object.keys(BUILTINS).forEach((k) => { all[k] = { params: BUILTINS[k].params, builtin: true }; });
    Object.keys(extra || {}).forEach((k) => { all[k] = Object.assign({}, extra[k], { builtin: !!(all[k] && all[k].builtin) }); });
    return all;
  }

  function resolveFn(name, lang) {
    if (CUR.functions[name]) return name;
    if (lang === 'py' && PY_ALIAS[name] && CUR.functions[PY_ALIAS[name]]) return PY_ALIAS[name];
    return null;
  }

  const byOpcode = {};
  COMMANDS.forEach((r) => { byOpcode[r[2]] = { kind: 'cmd', dncl: r[0], py: r[1], opcode: r[2], args: r[3] }; });
  REPORTERS.forEach((r) => { byOpcode[r[2]] = { kind: 'rep', dncl: r[0], py: r[1], opcode: r[2], args: r[3] }; });
  const cmdByName = { dncl: {}, py: {} };
  const repByName = { dncl: {}, py: {} };
  COMMANDS.forEach((r) => { cmdByName.dncl[r[0]] = byOpcode[r[2]]; cmdByName.py[r[1]] = byOpcode[r[2]]; });
  REPORTERS.forEach((r) => { repByName.dncl[r[0]] = byOpcode[r[2]]; repByName.py[r[1]] = byOpcode[r[2]]; });
  const mathByName = { dncl: {}, py: {} };
  MATHOPS.forEach((r) => { mathByName.dncl[r[0]] = r[2]; mathByName.py[r[1]] = r[2]; });
  const mathName = (op, lang) => { const r = MATHOPS.find((x) => x[2] === op); return r ? (lang === 'py' ? r[1] : r[0]) : null; };

  // ---------------------------------------------------------------
  // ブロック → コード
  // ---------------------------------------------------------------
  class Unsupported extends Error {}

  const IDENT = /^[A-Za-z_぀-ヿ㐀-鿿ｦ-ﾟ々ー][A-Za-z0-9_぀-ヿ㐀-鿿ｦ-ﾟ々ー０-９]*$/;
  const KEYWORDS_PY = new Set(['and', 'or', 'not', 'if', 'elif', 'else', 'while', 'for', 'in', 'def', 'True', 'False', 'None', 'pass', 'return', 'break', 'range', 'input']);
  const KEYWORDS_DNCL = new Set(['and', 'or', 'not', 'もし', 'ならば', 'そうでなければ', 'そうでなくもし']);

  function identOk(name, lang) {
    return IDENT.test(name) && !(lang === 'py' ? KEYWORDS_PY : KEYWORDS_DNCL).has(name) && !/^(True|False)$/.test(name);
  }

  function quote(s) {
    return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  }

  function isNumText(s) {
    return /^-?(\d+\.?\d*|\.\d+)$/.test(String(s).trim()) && String(s).trim() !== '';
  }

  // 式（優先順位つき）
  const PREC = { or: 1, and: 2, not: 3, cmp: 4, add: 5, mul: 6, unary: 7, pow: 8, atom: 9 };

  function exprOf(input, lang, ctx) {
    if (input === undefined || input === null) return { s: lang === 'py' ? 'False' : '偽', p: PREC.atom, empty: true };
    if ('num' in input) {
      const raw = String(input.num).trim();
      return { s: raw === '' ? '0' : (isNumText(raw) ? raw : quote(input.num)), p: PREC.atom };
    }
    if ('text' in input) return { s: isNumText(input.text) ? String(input.text).trim() : quote(input.text), p: PREC.atom };
    if ('color' in input) return { s: quote(input.color), p: PREC.atom };
    if (input.menu) return { s: quote(toWord(input.menu.broadcast !== undefined ? input.menu.broadcast : input.menu.value)), p: PREC.atom };
    if (input.block) return reporterOf(input.block, lang, ctx);
    throw new Unsupported('入力');
  }

  function wrap(e, p) { return e.p < p ? '(' + e.s + ')' : e.s; }

  function binop(spec, lang, ctx, sym, p, a, bName) {
    const l = exprOf(spec.inputs[a], lang, ctx);
    const r = exprOf(spec.inputs[bName], lang, ctx);
    return { s: wrap(l, p) + ' ' + sym + ' ' + wrap(r, p + 1), p };
  }

  function reporterOf(spec, lang, ctx) {
    const op = spec.opcode;
    switch (op) {
      case 'data_itemoflist': {
        const L = listName(spec);
        if (!identOk(L, lang)) throw new Unsupported('リスト名「' + L + '」');
        return { s: L + '[' + idx0(spec.inputs.INDEX, L, lang, ctx) + ']', p: PREC.atom };
      }
      case 'data_lengthoflist': {
        const L = listName(spec);
        if (!identOk(L, lang)) throw new Unsupported('リスト名「' + L + '」');
        return { s: (lang === 'py' ? 'len(' : '要素数(') + L + ')', p: PREC.atom };
      }
      case 'data_listcontainsitem': {
        const L = listName(spec);
        if (!identOk(L, lang)) throw new Unsupported('リスト名「' + L + '」');
        if (lang === 'py') return { s: wrap(exprOf(spec.inputs.ITEM, lang, ctx), PREC.add) + ' in ' + L, p: PREC.cmp };
        return { s: callText(byOpcode[op], spec, lang, ctx), p: PREC.atom };
      }
      case 'operator_letter_of': {
        const st = spec.inputs && spec.inputs.STRING && spec.inputs.STRING.block;
        if (lang === 'py' && st && st.opcode === 'data_variable' && identOk(varName(st.fields.VARIABLE), lang)) {
          const vn = varName(st.fields.VARIABLE);
          return { s: vn + '[' + idx0(spec.inputs.LETTER, vn, lang, ctx) + ']', p: PREC.atom };
        }
        return { s: callText(byOpcode[op], spec, lang, ctx), p: PREC.atom };
      }
      case 'operator_random': {
        const f = spec.inputs && spec.inputs.FROM;
        const t = spec.inputs && spec.inputs.TO;
        if (f && t && 'num' in f && 'num' in t && String(f.num) === '0' && String(t.num) === '1.0') return { s: lang === 'py' ? 'random()' : '乱数()', p: PREC.atom };
        return { s: callText(byOpcode[op], spec, lang, ctx), p: PREC.atom };
      }
      case 'operator_add': return binop(spec, lang, ctx, '+', PREC.add, 'NUM1', 'NUM2');
      case 'operator_subtract': return binop(spec, lang, ctx, '-', PREC.add, 'NUM1', 'NUM2');
      case 'operator_multiply': return binop(spec, lang, ctx, '*', PREC.mul, 'NUM1', 'NUM2');
      case 'operator_divide': return binop(spec, lang, ctx, '/', PREC.mul, 'NUM1', 'NUM2');
      case 'operator_mod': return binop(spec, lang, ctx, '%', PREC.mul, 'NUM1', 'NUM2');
      case 'operator_lt': return binop(spec, lang, ctx, '<', PREC.cmp, 'OPERAND1', 'OPERAND2');
      case 'operator_gt': return binop(spec, lang, ctx, '>', PREC.cmp, 'OPERAND1', 'OPERAND2');
      case 'operator_equals': return binop(spec, lang, ctx, '==', PREC.cmp, 'OPERAND1', 'OPERAND2');
      case 'operator_and': return binop(spec, lang, ctx, 'and', PREC.and, 'OPERAND1', 'OPERAND2');
      case 'operator_or': return binop(spec, lang, ctx, 'or', PREC.or, 'OPERAND1', 'OPERAND2');
      case 'operator_not': {
        const inner = spec.inputs.OPERAND && spec.inputs.OPERAND.block;
        // not(a > b) → a <= b、not(a < b) → a >= b、not(a == b) → a != b
        const flip = { operator_gt: '<=', operator_lt: '>=', operator_equals: '!=' };
        if (inner && flip[inner.opcode]) return binop(inner, lang, ctx, flip[inner.opcode], PREC.cmp, 'OPERAND1', 'OPERAND2');
        if (lang === 'py' && inner && inner.opcode === 'data_listcontainsitem' && identOk(listName(inner), lang)) {
          return { s: wrap(exprOf(inner.inputs.ITEM, lang, ctx), PREC.add) + ' not in ' + listName(inner), p: PREC.cmp };
        }
        const e = exprOf(spec.inputs.OPERAND, lang, ctx);
        return { s: 'not ' + wrap(e, PREC.not), p: PREC.not };
      }
      case 'operator_mathop': {
        const inner = spec.inputs && spec.inputs.NUM && spec.inputs.NUM.block;
        if (fieldVal(spec, 'OPERATOR') === 'floor' && inner && inner.opcode === 'operator_divide') {
          return binop(inner, lang, ctx, lang === 'py' ? '//' : '÷', PREC.mul, 'NUM1', 'NUM2');
        }
        const nm = mathName(fieldVal(spec, 'OPERATOR'), lang);
        if (!nm) throw new Unsupported(op);
        return { s: nm + '(' + exprOf(spec.inputs.NUM, lang, ctx).s + ')', p: PREC.atom };
      }
      case 'data_variable': {
        const name = varName(spec.fields.VARIABLE);
        if (ctx.pending && ctx.pending[name]) { const e = ctx.pending[name]; delete ctx.pending[name]; return e; }
        if (!identOk(name, lang)) throw new Unsupported('変数名「' + name + '」');
        return { s: name, p: PREC.atom };
      }
      case 'data_listcontents': {
        const name = varName(spec.fields.LIST);
        if (!identOk(name, lang)) throw new Unsupported('リスト名');
        return { s: name, p: PREC.atom };
      }
      case 'argument_reporter_string_number':
        return { s: fieldVal(spec, 'VALUE'), p: PREC.atom };
      case 'looks_costumenumbername': {
        const nn = fieldVal(spec, 'NUMBER_NAME');
        return { s: (lang === 'py' ? (nn === 'name' ? 'costume_name' : 'costume_number') : (nn === 'name' ? 'コスチューム名' : 'コスチューム番号')) + '()', p: PREC.atom };
      }
      case 'looks_backdropnumbername': {
        const nn = fieldVal(spec, 'NUMBER_NAME');
        return { s: (lang === 'py' ? (nn === 'name' ? 'backdrop_name' : 'backdrop_number') : (nn === 'name' ? '背景名' : '背景番号')) + '()', p: PREC.atom };
      }
      default: {
        const row = byOpcode[op];
        if (!row || row.kind !== 'rep') throw new Unsupported(op);
        return { s: callText(row, spec, lang, ctx), p: PREC.atom };
      }
    }
  }

  function fieldVal(spec, name) {
    const fv = spec.fields && spec.fields[name];
    if (fv === undefined) return '';
    return typeof fv === 'object' ? (fv.value !== undefined ? fv.value : (fv.variable || fv.list || fv.broadcast || '')) : fv;
  }

  function varName(fv) {
    if (fv && typeof fv === 'object') return fv.variable || fv.list || fv.value || '';
    return String(fv || '');
  }

  function argText(a, spec, lang, ctx) {
    if (a.k === 'f') return quote(toWord(fieldVal(spec, a.name)));
    if (a.k === 'v' || a.k === 'L') {
      const name = varName(spec.fields[a.name]);
      if (!identOk(name, lang)) throw new Unsupported('名前「' + name + '」');
      return name;
    }
    return exprOf(spec.inputs[a.name], lang, ctx).s;
  }

  function callText(row, spec, lang, ctx) {
    const name = lang === 'py' ? row.py : row.dncl;
    return name + '(' + row.args.map((a) => argText(a, spec, lang, ctx)).join(', ') + ')';
  }

  // 表示する(...) は「つなぐ」の連なりを , で分けて書く
  function joinParts(input, lang, ctx) {
    if (input && input.block && input.block.opcode === 'operator_join') {
      return joinParts(input.block.inputs.STRING1, lang, ctx).concat(joinParts(input.block.inputs.STRING2, lang, ctx));
    }
    return [exprOf(input, lang, ctx).s];
  }

  function isVarRef(input, name) {
    return input && input.block && input.block.opcode === 'data_variable' && varName(input.block.fields.VARIABLE) === name;
  }

  function literalNum(input) {
    if (!input) return null;
    if ('num' in input && isNumText(input.num)) return Number(input.num);
    if ('text' in input && isNumText(input.text)) return Number(input.text);
    return null;
  }

  // 定義ブロックの呼び出し → 関数呼び出しの文字
  function fnOf(spec) {
    const pc = String(spec.proccode || '');
    const m = /^([^\s%]+)((?: %s)*)$/.exec(pc);
    return m ? m[1] : null;
  }

  function fnCallExpr(spec, lang, ctx) {
    const name = fnOf(spec);
    if (!name || !ctx.functions[name]) throw new Unsupported('自作ブロック「' + String(spec.proccode || '').replace(/ %[snb]/g, ' ( )') + '」');
    const args = (spec.args || []).map((a) => exprOf(a, lang, ctx));
    if (lang === 'py' && name === 'べき乗' && args.length === 2) return { s: wrap(args[0], PREC.pow + 1) + ' ** ' + wrap(args[1], PREC.pow), p: PREC.pow };
    const nm = lang === 'py' && BUILTINS[name] ? BUILTINS[name].py : name;
    return { s: nm + '(' + args.map((a) => a.s).join(', ') + ')', p: PREC.atom };
  }

  const isAnswerCopy = (st) => st && st.opcode === 'data_setvariableto' && st.inputs && st.inputs.VALUE && st.inputs.VALUE.block &&
    st.inputs.VALUE.block.opcode === 'data_variable' && /の答え$/.test(varName(st.inputs.VALUE.block.fields.VARIABLE)) &&
    /の答え\d+$/.test(varName(st.fields.VARIABLE));

  function refsVar(st, name) {
    if (!st) return false;
    const parts = [];
    Object.keys(st.inputs || {}).forEach((k) => { if (!/^SUBSTACK/.test(k)) parts.push(st.inputs[k]); });
    (st.args || []).forEach((a) => parts.push(a));
    const needle = '"variable":' + JSON.stringify(name);
    return parts.some((x) => JSON.stringify(x).includes(needle));
  }

  // 呼び出し（と答えのコピー）の並びのあと、最初の命令がその答えを使っていれば、式の中に折りたたむ
  // 折りたためたら、使う命令の位置を返す。だめなら -1
  function foldCalls(stack, i, lang, ctx) {
    let k = i;
    const plan = [];
    while (k < stack.length && (stack[k].opcode === 'procedures_call' || isAnswerCopy(stack[k]))) { plan.push(stack[k]); k++; }
    const target = stack[k];
    if (!target || !plan.length || plan[0].opcode !== 'procedures_call') return -1;
    // どの答えが、どの呼び出しのものか
    const local = {};
    const pend = {};
    try {
      plan.forEach((st) => {
        if (st.opcode === 'procedures_call') {
          const name = fnOf(st);
          if (!name || !ctx.functions[name]) throw new Unsupported('fn');
          // 引数の中で前の答えを使っていれば、それを入れる
          const saved = ctx.pending;
          ctx.pending = Object.assign({}, pend);
          const e = fnCallExpr(st, lang, ctx);
          Object.keys(pend).forEach((kk) => { if (!ctx.pending[kk]) delete pend[kk]; });
          ctx.pending = saved;
          pend[answerVar(name)] = e;
          local.last = answerVar(name);
        } else {
          const from = varName(st.inputs.VALUE.block.fields.VARIABLE);
          if (!pend[from]) throw new Unsupported('fn');
          pend[varName(st.fields.VARIABLE)] = pend[from];
          delete pend[from];
        }
      });
    } catch (e) {
      if (e instanceof Unsupported) return -1;
      throw e;
    }
    const names = Object.keys(pend);
    if (!names.length || !names.every((n0) => refsVar(target, n0))) return -1;
    names.forEach((n0) => { ctx.pending[n0] = pend[n0]; });
    // 条件でくり返す形なら、くり返しの最後の同じ呼び出しは表示しない
    if (target.opcode === 'control_repeat_until') ctx.loopTails.set(target, JSON.stringify(plan));
    return k;
  }

  // 1つのスタック（ブロックの並び）をコードの行にする。行は {d: 深さ, s: 文字}
  // Scratchの番号 → コードの添字（ふつうは -1 する）
  function idx0(inp, listName, lang, ctx) {
    if (ctx.base === 1) return exprOf(inp, lang, ctx).s;
    if (inp && 'text' in inp && String(inp.text) === 'last') return lang === 'py' ? '-1' : '要素数(' + listName + ') - 1';
    if (inp && 'text' in inp && /^(random|any|all)$/.test(String(inp.text))) throw new Unsupported('ランダムな番号');
    if (inp && ('num' in inp || 'text' in inp)) {
      const raw = String('num' in inp ? inp.num : inp.text).trim();
      if (/^-?\d+$/.test(raw)) return String(Number(raw) - 1);
    }
    const b = inp && inp.block;
    if (b && b.opcode === 'operator_add') {
      const n1 = b.inputs.NUM1;
      const n2 = b.inputs.NUM2;
      if (n2 && 'num' in n2 && String(n2.num).trim() === '1') return exprOf(n1, lang, ctx).s;
      if (n1 && 'num' in n1 && String(n1.num).trim() === '1') return exprOf(n2, lang, ctx).s;
    }
    return wrap(exprOf(inp, lang, ctx), PREC.add) + ' - 1';
  }
  function listName(spec) {
    const n = varName(spec.fields && spec.fields.LIST);
    return n;
  }

  // リストに書く命令（配列の書き方で表示する）。表示できたら true
  function listStatement(s, d, lang, ctx, out) {
    const py = lang === 'py';
    const L = listName(s);
    if (!L) return false;
    if (!identOk(L, lang)) throw new Unsupported('リスト名「' + L + '」');
    switch (s.opcode) {
      case 'data_replaceitemoflist':
        out.push({ d, s: L + '[' + idx0(s.inputs.INDEX, L, lang, ctx) + '] = ' + exprOf(s.inputs.ITEM, lang, ctx).s });
        return true;
      case 'data_addtolist':
        if (!py) return false;
        out.push({ d, s: L + '.append(' + exprOf(s.inputs.ITEM, lang, ctx).s + ')' });
        return true;
      case 'data_deletealloflist':
        out.push({ d, s: py ? L + '.clear()' : L + ' = []' });
        return true;
      case 'data_deleteoflist': {
        const inp = s.inputs.INDEX;
        if (inp && 'text' in inp && String(inp.text) === 'all') { out.push({ d, s: py ? L + '.clear()' : L + ' = []' }); return true; }
        if (py && inp && 'text' in inp && String(inp.text) === 'last') { out.push({ d, s: L + '.pop()' }); return true; }
        if (py && inp && inp.block && inp.block.opcode === 'data_itemnumoflist' && listName(inp.block) === L) {
          out.push({ d, s: L + '.remove(' + exprOf(inp.block.inputs.ITEM, lang, ctx).s + ')' });
          return true;
        }
        out.push({ d, s: py ? 'del ' + L + '[' + idx0(inp, L, lang, ctx) + ']' : '削除する(' + L + ', ' + idx0(inp, L, lang, ctx) + ')' });
        return true;
      }
      case 'data_insertatlist':
        out.push({ d, s: (py ? L + '.insert(' : '挿入する(' + L + ', ') + idx0(s.inputs.INDEX, L, lang, ctx) + ', ' + exprOf(s.inputs.ITEM, lang, ctx).s + ')' });
        return true;
      default:
        return false;
    }
  }

  function stackLines(stack, d, lang, ctx, out) {
    for (let i = 0; i < stack.length; i++) {
      // 定義ブロックの呼び出し：答えを使う命令があれば式に折りたたむ
      if (stack[i].opcode === 'procedures_call') {
        const k = foldCalls(stack, i, lang, ctx);
        if (k > i) { i = k - 1; continue; }
        out.push({ d, s: fnCallExpr(stack[i], lang, ctx).s });
        continue;
      }
      const s = stack[i];
      const nx = stack[i + 1];
      // 回数つき繰り返し：v = A ／ v > B になるまで繰り返す（最後に v を S 変える）
      if (s.opcode === 'data_setvariableto' && nx && nx.opcode === 'control_repeat_until') {
        const vname = varName(s.fields.VARIABLE);
        const cond = nx.inputs.CONDITION && nx.inputs.CONDITION.block;
        const body = (nx.inputs.SUBSTACK && nx.inputs.SUBSTACK.stack) || [];
        const last = body[body.length - 1];
        if (identOk(vname, lang) && cond && (cond.opcode === 'operator_gt' || cond.opcode === 'operator_lt') && isVarRef(cond.inputs.OPERAND1, vname) &&
          last && last.opcode === 'data_changevariableby' && varName(last.fields.VARIABLE) === vname) {
          const step = literalNum(last.inputs.VALUE);
          const up = cond.opcode === 'operator_gt';
          if (step !== null && ((up && step > 0) || (!up && step < 0))) {
            const from = exprOf(s.inputs.VALUE, lang, ctx).s;
            const toE = exprOf(cond.inputs.OPERAND2, lang, ctx);
            if (lang === 'py') {
              const toNum = literalNum(cond.inputs.OPERAND2);
              const stop = toNum !== null ? String(toNum + (up ? 1 : -1)) : wrap(toE, PREC.add) + (up ? ' + 1' : ' - 1');
              const args = step === 1 ? [from, stop] : [from, stop, String(step)];
              out.push({ d, s: 'for ' + vname + ' in range(' + args.join(', ') + '):' });
            } else {
              out.push({ d, s: vname + ' を ' + from + ' から ' + toE.s + ' まで ' + Math.abs(step) + ' ずつ' + (up ? '増やし' : '減らし') + 'ながら繰り返す:' });
            }
            blockBody(body.slice(0, -1), d + 1, lang, ctx, out);
            i++;
            continue;
          }
        }
      }
      // 尋ねて代入：尋ねる(q) のすぐあとに v = 答え()
      if (s.opcode === 'sensing_askandwait' && nx && nx.opcode === 'data_setvariableto' && nx.inputs.VALUE && nx.inputs.VALUE.block &&
        nx.inputs.VALUE.block.opcode === 'sensing_answer' && identOk(varName(nx.fields.VARIABLE), lang)) {
        const qIn = s.inputs.QUESTION;
        const emptyQ = !qIn || ('text' in qIn && String(qIn.text) === '') || ('num' in qIn && String(qIn.num) === '');
        const q = exprOf(qIn, lang, ctx).s;
        const vn = varName(nx.fields.VARIABLE);
        if (emptyQ) out.push({ d, s: lang === 'py' ? vn + ' = input()' : vn + ' = 【外部からの入力】' });
        else out.push({ d, s: lang === 'py' ? vn + ' = input(' + q + ')' : q + ' と尋ねて ' + vn + ' に代入' });
        i++;
        continue;
      }
      // Data = [3, 1, 4]：「すべて削除」のすぐあとに、同じリストへの「追加」が続く
      if (s.opcode === 'data_deletealloflist' && listName(s) && identOk(listName(s), lang)) {
        const L = listName(s);
        const items = [];
        let k = i + 1;
        while (k < stack.length && stack[k].opcode === 'data_addtolist' && listName(stack[k]) === L) {
          items.push(exprOf(stack[k].inputs.ITEM, lang, ctx).s);
          k++;
        }
        out.push({ d, s: L + ' = [' + items.join(', ') + ']' });
        i = k - 1;
        continue;
      }
      if (/^data_(replaceitemoflist|addtolist|deletealloflist|deleteoflist|insertatlist)$/.test(s.opcode) && listStatement(s, d, lang, ctx, out)) continue;
      statementLines(s, d, lang, ctx, out);
    }
  }

  function blockBody(stack, d, lang, ctx, out) {
    if (!stack.length) out.push({ d, s: lang === 'py' ? 'pass' : '（なし）' });
    else stackLines(stack, d, lang, ctx, out);
  }

  function statementLines(s, d, lang, ctx, out) {
    const py = lang === 'py';
    const sub = (name) => (s.inputs[name] && s.inputs[name].stack) || [];
    const cond = (name) => exprOf(s.inputs[name], lang, ctx).s;
    switch (s.opcode) {
      case 'control_forever':
        out.push({ d, s: py ? 'while True:' : 'ずっと繰り返す:' });
        blockBody(sub('SUBSTACK'), d + 1, lang, ctx, out);
        return;
      case 'control_repeat':
        out.push({ d, s: py ? 'for _ in range(' + exprOf(s.inputs.TIMES, lang, ctx).s + '):' : exprOf(s.inputs.TIMES, lang, ctx).s + ' 回繰り返す:' });
        blockBody(sub('SUBSTACK'), d + 1, lang, ctx, out);
        return;
      case 'control_repeat_until': {
        const tail = ctx.loopTails && ctx.loopTails.get(s);
        if (tail) {
          const n0 = JSON.parse(tail).length;
          const body0 = sub('SUBSTACK');
          if (body0.length >= n0 && JSON.stringify(body0.slice(-n0)) === tail) s.inputs.SUBSTACK.stack = body0.slice(0, -n0);
        }
        const cb = s.inputs.CONDITION && s.inputs.CONDITION.block;
        if (cb && cb.opcode === 'operator_not') {
          // not(条件) になるまで → 条件 の間
          const inner = exprOf(cb.inputs.OPERAND, lang, ctx).s;
          out.push({ d, s: py ? 'while ' + inner + ':' : inner + ' の間繰り返す:' });
        } else {
          const e = exprOf(s.inputs.CONDITION, lang, ctx);
          out.push({ d, s: py ? 'while not ' + wrap(e, PREC.not) + ':' : e.s + ' になるまで繰り返す:' });
        }
        blockBody(sub('SUBSTACK'), d + 1, lang, ctx, out);
        return;
      }
      case 'control_if':
      case 'control_if_else': {
        out.push({ d, s: py ? 'if ' + cond('CONDITION') + ':' : 'もし ' + cond('CONDITION') + ' ならば:' });
        blockBody(sub('SUBSTACK'), d + 1, lang, ctx, out);
        if (s.opcode === 'control_if_else') {
          let els = sub('SUBSTACK2');
          // でなければの中が「もし」1つだけなら、そうでなくもし（elif）にする
          for (;;) {
            let e = null;
            if (els.length === 1 && (els[0].opcode === 'control_if' || els[0].opcode === 'control_if_else')) e = els[0];
            else if (els.length > 1 && els[0].opcode === 'procedures_call') {
              const k = foldCalls(els, 0, lang, ctx);
              const last = els[els.length - 1];
              if (k === els.length - 1 && (last.opcode === 'control_if' || last.opcode === 'control_if_else')) e = last;
              else ctx.pending = {};
            }
            if (!e) break;
            out.push({ d, s: py ? 'elif ' + exprOf(e.inputs.CONDITION, lang, ctx).s + ':' : 'そうでなくもし ' + exprOf(e.inputs.CONDITION, lang, ctx).s + ' ならば:' });
            blockBody((e.inputs.SUBSTACK && e.inputs.SUBSTACK.stack) || [], d + 1, lang, ctx, out);
            if (e.opcode !== 'control_if_else') { els = null; break; }
            els = (e.inputs.SUBSTACK2 && e.inputs.SUBSTACK2.stack) || [];
          }
          if (els) {
            out.push({ d, s: py ? 'else:' : 'そうでなければ:' });
            blockBody(els, d + 1, lang, ctx, out);
          }
        }
        return;
      }
      case 'control_wait_until':
        out.push({ d, s: py ? 'wait_until(' + cond('CONDITION') + ')' : cond('CONDITION') + ' になるまで待つ' });
        return;
      case 'data_setvariableto': {
        const vn = varName(s.fields.VARIABLE);
        if (!identOk(vn, lang)) throw new Unsupported('変数名「' + vn + '」');
        out.push({ d, s: vn + ' = ' + exprOf(s.inputs.VALUE, lang, ctx).s });
        return;
      }
      case 'data_changevariableby': {
        const vn = varName(s.fields.VARIABLE);
        if (!identOk(vn, lang)) throw new Unsupported('変数名「' + vn + '」');
        const num = literalNum(s.inputs.VALUE);
        if (num !== null && num < 0) out.push({ d, s: vn + ' = ' + vn + ' - ' + Math.abs(num) });
        else { const e = exprOf(s.inputs.VALUE, lang, ctx); out.push({ d, s: vn + ' = ' + vn + ' + ' + wrap(e, PREC.add + 1) }); }
        return;
      }
      case 'looks_say': {
        const parts = joinParts(s.inputs.MESSAGE, lang, ctx);
        out.push({ d, s: (py ? 'print' : '表示する') + '(' + parts.join(', ') + ')' });
        return;
      }
      default: {
        const row = byOpcode[s.opcode];
        if (!row || row.kind !== 'cmd') throw new Unsupported(s.opcode);
        out.push({ d, s: callText(row, s, lang, ctx) });
      }
    }
  }

  function hatLines(hat, lang, out, idx) {
    const h = HATS.find((x) => x.opcode === hat.opcode);
    if (!h) throw new Unsupported(hat.opcode);
    const val = h.field ? toWord(fieldVal(hat, h.field)) : null;
    if (lang === 'py') {
      out.push({ d: 0, s: '@' + h.py + (h.field ? '(' + quote(val) + ')' : '') });
      out.push({ d: 0, s: 'def script' + idx + '():' });
      return;
    }
    if (hat.opcode === 'event_whenkeypressed') out.push({ d: 0, s: quote(val) + ' キーが押されたとき:' });
    else if (hat.opcode === 'event_whenbroadcastreceived') out.push({ d: 0, s: quote(val) + ' を受け取ったとき:' });
    else if (hat.opcode === 'event_whenbackdropswitchesto') out.push({ d: 0, s: '背景が ' + quote(val) + ' になったとき:' });
    else out.push({ d: 0, s: h.dncl + ':' });
  }

  // DNCLの「|」「└」を付ける
  function dnclPrefix(lines) {
    return lines.map((ln, i) => {
      let p = '';
      for (let k = 1; k <= ln.d; k++) {
        let lastInBlock = true;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].d >= k) { lastInBlock = false; break; }
          if (lines[j].d < k) break;
        }
        p += lastInBlock ? '└ ' : '| ';
      }
      return p + ln.s;
    });
  }

  // scripts: [{topId, blocks:[...]}] → {text, used:[topId], skipped:[{topId, reason}]}
  function toCode(scripts, lang, opts) {
    const all = [];
    const used = [];
    const skipped = [];
    const defs = [];
    let idx = 1;
    const fns = knownFunctions(opts && opts.functions);
    scripts.forEach((sc) => {
      const blocks = sc.blocks || [];
      const out = [];
      // 定義ブロック（関数の中身）はコードには出さない
      if (blocks.length && blocks[0].opcode === 'procedures_definition') { defs.push(sc.topId); return; }
      try {
        if (!blocks.length || !HATS.find((h) => h.opcode === blocks[0].opcode)) throw new Unsupported('「〜とき」で始まらないブロックのかたまり');
        hatLines(blocks[0], lang, out, idx);
        const ctx = { functions: fns, pending: {}, loopTails: new Map(), base: opts && opts.base === 1 ? 1 : 0 };
        blockBody(JSON.parse(JSON.stringify(blocks.slice(1))), 1, lang, ctx, out);
        idx++;
        if (all.length) all.push({ d: 0, s: '' });
        out.forEach((x) => all.push(x));
        used.push(sc.topId);
      } catch (e) {
        if (!(e instanceof Unsupported)) throw e;
        skipped.push({ topId: sc.topId, reason: e.message });
      }
    });
    let lines;
    if (lang === 'py') lines = all.map((ln) => (ln.s ? '    '.repeat(ln.d) + ln.s : ''));
    else {
      // 空行で区切られたスクリプトごとに | を付ける
      lines = [];
      let chunk = [];
      const flush = () => { dnclPrefix(chunk).forEach((x) => lines.push(x)); chunk = []; };
      all.forEach((ln) => { if (!ln.s) { flush(); lines.push(''); } else chunk.push(ln); });
      flush();
    }
    const head = [];
    const fnList = Object.keys(fns).map((k) => {
      const nm = lang === 'py' && BUILTINS[k] ? BUILTINS[k].py : k;
      return (lang === 'py' && k === 'べき乗' ? 'a ** b, ' : '') + nm + '(' + fns[k].params.join(', ') + ')';
    });
    head.push('# 使える関数：' + fnList.join('、'));
    if (opts && opts.base === 1) head.push('# 添字は1から');
    if (skipped.length) {
      head.push((lang === 'py' ? '# ' : '# ') + 'コードにできないブロックがあるスクリプトが ' + skipped.length + ' 個あります（そのスクリプトはブロックのまま残ります）');
      head.push('');
    }
    if (!used.length && !skipped.length) head.push('# スクリプトはまだありません');
    head.push('');
    return { text: head.concat(lines).join('\n'), used, skipped, defs };
  }

  // ---------------------------------------------------------------
  // コード → ブロック
  // ---------------------------------------------------------------
  class CodeError extends Error {
    constructor(line, msg, extra) { super(msg); this.line = line; this.extra = extra || null; }
  }

  function unknownFn(line, name, argc) {
    return new CodeError(line, '「' + name + '」という関数はありません。', { kind: 'unknown_function', name, argc });
  }

  // 字句解析
  function tokenize(src, line) {
    const toks = [];
    let i = 0;
    const s = src;
    while (i < s.length) {
      const ch = s[i];
      if (ch === ' ' || ch === '\t' || ch === '　') { i++; continue; }
      if (ch === '#') break;
      // 全角の数字・記号はやさしく注意
      if (/[０-９]/.test(ch)) throw new CodeError(line, '全角の数字「' + ch + '」があります。半角（0〜9）で書いてね');
      if (/[（）＝＋－＊／，：＜＞％！]/.test(ch)) throw new CodeError(line, '全角の記号「' + ch + '」があります。半角で書いてね');
      if (MATH_SIGNS[ch]) throw new CodeError(line, MATH_SIGNS[ch]);
      if (ch === '÷') { toks.push({ t: 'op', v: '//' }); i++; continue; }
      if (s.startsWith('【外部からの入力】', i)) { toks.push({ t: 'ext' }); i += '【外部からの入力】'.length; continue; }
      if ((ch === 'f' || ch === 'F') && /["']/.test(s[i + 1] || '')) throw new CodeError(line, 'f"…"（f文字列）は使えません。print("答えは", x) のように「,」で区切って書いてね');
      if (ch === '"' || ch === "'" || ch === '「' || ch === '“' || ch === '”') {
        const close = ch === '「' ? '」' : (ch === '“' || ch === '”') ? '[”“"]' : ch;
        let j = i + 1;
        let str = '';
        const closeRe = new RegExp('^' + (close.length > 1 ? close : close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        while (j < s.length && !closeRe.test(s[j])) {
          if (s[j] === '\\' && j + 1 < s.length) { const nx = s[j + 1]; str += nx === 'n' ? '\n' : nx; j += 2; continue; }
          str += s[j++];
        }
        if (j >= s.length) throw new CodeError(line, '文字の終わりの「' + (ch === '「' ? '」' : '"') + '」がありません');
        toks.push({ t: 'str', v: str });
        i = j + 1;
        continue;
      }
      const num = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
      if (num) { toks.push({ t: 'num', v: num[1] }); i += num[1].length; continue; }
      const op = /^(\*\*|\/\/|==|!=|<=|>=|\+=|-=|[+\-*/%<>=(),:\[\]@])/.exec(s.slice(i));
      if (op) { toks.push({ t: 'op', v: op[1] }); i += op[1].length; continue; }
      const id = /^[A-Za-z_぀-ヿ㐀-鿿ｦ-ﾟ々ー][A-Za-z0-9_぀-ヿ㐀-鿿ｦ-ﾟ々ー]*/.exec(s.slice(i));
      if (id) {
        let word = id[0];
        i += word.length;
        // random.randint や time.sleep のような「モジュール.名前」
        const dot = /^\.([A-Za-z_][A-Za-z0-9_]*)/.exec(s.slice(i));
        if (dot && /^(random|time|math)$/.test(word)) { word += '.' + dot[1]; i += dot[0].length; }
        toks.push({ t: 'id', v: word });
        if (dot && word.indexOf('.') < 0) { toks.push({ t: 'op', v: '.' }); i += 1; }
        continue;
      }
      throw new CodeError(line, '「' + ch + '」は使えない文字です');
    }
    return toks;
  }

  // 数学の記号・昔のDNCLの書き方は、いまの書き方を教える
  const MATH_SIGNS = {
    '≧': '「≧」は「>=」と書いてね', '≦': '「≦」は「<=」と書いてね', '≠': '「≠」は「!=」と書いてね',
    '←': '代入は「←」ではなく「=」で書いてね（いまの共通テストの書き方）', '×': '「×」は「*」と書いてね'
  };
  const OLD_WORDS = { かつ: '「かつ」は「and」と書いてね（共通テストの書き方）', または: '「または」は「or」と書いてね（共通テストの書き方）', でない: '「でない」は前に「not」を書く形にしてね（例：not x > 1）' };
  const LIST_MSG = 'リスト（配列）は、まだコードでは使えません。Scratchのリストのブロックを使ってね';

  // 式の解析（Pratt）
  function Parser(toks, line, lang) {
    this.toks = toks; this.i = 0; this.line = line; this.lang = lang;
  }
  Parser.prototype.peek = function (k) { return this.toks[this.i + (k || 0)]; };
  Parser.prototype.next = function () { return this.toks[this.i++]; };
  Parser.prototype.isOp = function (v) { const t0 = this.peek(); return t0 && t0.t === 'op' && t0.v === v; };
  Parser.prototype.isWord = function (v) { const t0 = this.peek(); return t0 && t0.t === 'id' && t0.v === v; };
  Parser.prototype.expect = function (v, what) {
    if (!this.isOp(v)) throw new CodeError(this.line, (what || '「' + v + '」') + 'がありません');
    this.i++;
  };
  Parser.prototype.done = function () { return this.i >= this.toks.length; };

  const BIN = {
    or: [1, 'operator_or'], and: [2, 'operator_and'],
    '==': [4, 'operator_equals'], '!=': [4, '!='], '<': [4, 'operator_lt'], '>': [4, 'operator_gt'], '<=': [4, '<='], '>=': [4, '>='],
    '+': [5, 'operator_add'], '-': [5, 'operator_subtract'], '*': [6, 'operator_multiply'], '/': [6, 'operator_divide'], '%': [6, 'operator_mod'],
    '//': [6, '//'], '**': [8, '**'], in: [4, 'in'], notin: [4, 'notin']
  };

  Parser.prototype.binKey = function () {
    const t0 = this.peek();
    if (!t0) return null;
    if (t0.t === 'op' && BIN[t0.v]) return t0.v;
    if (t0.t === 'id' && (t0.v === 'and' || t0.v === 'or' || t0.v === 'AND' || t0.v === 'OR')) return t0.v.toLowerCase();
    if (t0.t === 'id' && OLD_WORDS[t0.v]) throw new CodeError(this.line, OLD_WORDS[t0.v]);
    if (t0.t === 'id' && t0.v === 'in') return 'in';
    if (t0.t === 'id' && t0.v === 'not' && this.peek(1) && this.peek(1).t === 'id' && this.peek(1).v === 'in') return 'notin';
    return null;
  };

  // 式の結果は「入力」の形（{num} {text} {block}）か {bool: block}
  Parser.prototype.expr = function (minP) {
    minP = minP || 0;
    let left = this.unary();
    for (;;) {
      const k = this.binKey();
      if (!k) break;
      const [p, opc] = BIN[k];
      if (p < minP) break;
      this.i += k === 'notin' ? 2 : 1;
      const right = this.expr(k === '**' ? p : p + 1); // ** は右から
      left = this.makeBin(k, opc, left, right);
    }
    return left;
  };

  Parser.prototype.makeBin = function (k, opc, l, r) {
    const blk = (opcode, a, bName, x, y) => {
      const inputs = {};
      const kind = /^operator_(add|subtract|multiply|divide|mod)$/.test(opcode) ? 'n' : (/^operator_(and|or)$/.test(opcode) ? null : 't');
      inputs[a] = kind ? withShadow(x, kind) : x;
      inputs[bName] = kind ? withShadow(y, kind) : y;
      return { block: { opcode, inputs } };
    };
    const isStr = (x) => x && (x.strMark || ('text' in x && !isNumText(x.text)) || (x.block && x.block.opcode === 'operator_join'));
    if (k === '**') {
      if (!CUR.functions.べき乗) throw new CodeError(this.line, '「**」（べき乗）は使えません');
      CUR.used.add('べき乗');
      return { fcall: { name: 'べき乗', args: [l, r] } };
    }
    if (k === '//') {
      return { block: { opcode: 'operator_mathop', fields: { OPERATOR: 'floor' }, inputs: { NUM: withShadow(blk('operator_divide', 'NUM1', 'NUM2', l, r), 'n') } } };
    }
    if (k === 'in' || k === 'notin') {
      let e;
      if (r && r.block && (r.block.opcode === 'data_listcontents' || (r.block.opcode === 'data_variable' && CUR.lists.has(r.block.fields.VARIABLE.variable)))) {
        const ln = r.block.opcode === 'data_listcontents' ? r.block.fields.LIST.list : r.block.fields.VARIABLE.variable;
        e = { block: { opcode: 'data_listcontainsitem', fields: { LIST: listRef(ln) }, inputs: { ITEM: withShadow(asText(l), 't') } } };
      } else {
        e = { block: { opcode: 'operator_contains', inputs: { STRING1: withShadow(asText(r), 't'), STRING2: withShadow(asText(l), 't') } } };
      }
      return k === 'notin' ? { block: { opcode: 'operator_not', inputs: { OPERAND: e } } } : e;
    }
    if (k === '+' && (isStr(l) || isStr(r))) return blk('operator_join', 'STRING1', 'STRING2', l, r);
    if (opc === '!=') return { block: { opcode: 'operator_not', inputs: { OPERAND: blk('operator_equals', 'OPERAND1', 'OPERAND2', l, r) } } };
    if (opc === '<=') return { block: { opcode: 'operator_not', inputs: { OPERAND: blk('operator_gt', 'OPERAND1', 'OPERAND2', l, r) } } };
    if (opc === '>=') return { block: { opcode: 'operator_not', inputs: { OPERAND: blk('operator_lt', 'OPERAND1', 'OPERAND2', l, r) } } };
    if (opc === 'operator_and' || opc === 'operator_or') return blk(opc, 'OPERAND1', 'OPERAND2', l, r);
    if (/^operator_(lt|gt|equals)$/.test(opc)) return blk(opc, 'OPERAND1', 'OPERAND2', l, r);
    return blk(opc, 'NUM1', 'NUM2', l, r);
  };

  Parser.prototype.unary = function () {
    if (this.isWord('not') || this.isWord('NOT')) {
      this.i++;
      const e = this.expr(3);
      return { block: { opcode: 'operator_not', inputs: { OPERAND: e } } };
    }
    if (this.isOp('-')) {
      this.i++;
      const t0 = this.peek();
      if (t0 && t0.t === 'num') { this.i++; return { num: '-' + t0.v }; }
      const e = this.unary();
      return { block: { opcode: 'operator_subtract', inputs: { NUM1: { num: '0' }, NUM2: e } } };
    }
    return this.atom();
  };

  Parser.prototype.args = function () {
    this.expect('(', '「(」');
    const list = [];
    if (this.isOp(')')) { this.i++; return list; }
    for (;;) {
      list.push(this.expr());
      if (this.isOp(',')) { this.i++; continue; }
      if (this.isOp(')')) { this.i++; break; }
      throw new CodeError(this.line, 'カッコ「)」が閉じていません');
    }
    return list;
  };

  Parser.prototype.atom = function () {
    const t0 = this.next();
    if (!t0) throw new CodeError(this.line, '式が途中で終わっています');
    if (t0.t === 'num') return { num: t0.v };
    if (t0.t === 'str') return { text: t0.v };
    if (t0.t === 'ext') return { ask: { text: '' } };
    if (t0.t === 'op' && t0.v === '[') {
      const items = [];
      if (this.isOp(']')) { this.i++; return { listLit: items }; }
      for (;;) {
        items.push(asInput(this.expr(), this.line));
        if (this.isOp(',')) { this.i++; continue; }
        if (this.isOp(']')) { this.i++; break; }
        throw new CodeError(this.line, 'カッコ「]」が閉じていません');
      }
      return { listLit: items };
    }
    if (t0.t === 'id' && OLD_WORDS[t0.v]) throw new CodeError(this.line, OLD_WORDS[t0.v]);
    if (t0.t === 'op' && t0.v === '(') {
      const e = this.expr();
      this.expect(')', 'カッコ「)」');
      return e;
    }
    if (t0.t === 'id') {
      if (t0.v === 'True' || t0.v === 'False' || t0.v === '偽' || t0.v === '真') return { bool: t0.v === 'True' || t0.v === '真' };
      if (this.isOp('(')) return this.callExpr(t0.v);
      if (this.isOp('[')) return this.indexExpr(t0.v);
      if (this.isOp('.')) throw new CodeError(this.line, '「' + t0.v + '.〜」は1行の命令として書いてね（例：' + t0.v + '.append(5)）');
      if (CUR.lists.has(t0.v)) return { block: { opcode: 'data_listcontents', fields: { LIST: { list: t0.v } } } };
      return { block: { opcode: 'data_variable', fields: { VARIABLE: { variable: t0.v } } } };
    }
    throw new CodeError(this.line, '「' + t0.v + '」の書き方がおかしいです');
  };

  // Data[i] → Data の (i+1) 番目（文字の変数なら、i+1 文字目）
  Parser.prototype.readIndex = function () {
    this.expect('[', '「[」');
    const e = asInput(this.expr(), this.line);
    if (this.isOp(',')) throw new CodeError(this.line, '2次元の配列（Data[i, j]）は、まだ使えません');
    this.expect(']', 'カッコ「]」');
    return e;
  };
  Parser.prototype.indexExpr = function (name) {
    const e = this.readIndex();
    if (CUR.strs.has(name)) {
      return { block: { opcode: 'operator_letter_of', inputs: { LETTER: withShadow(idx1(e), 'n'), STRING: withShadow({ block: { opcode: 'data_variable', fields: { VARIABLE: { variable: name } } } }, 't') } } };
    }
    const index = (this.lang === 'py' && 'num' in e && String(e.num).trim() === '-1') ? { text: 'last' } : withShadow(idx1(e), 'n');
    return { block: { opcode: 'data_itemoflist', fields: { LIST: listRef(name) }, inputs: { INDEX: index } } };
  };

  Parser.prototype.callExpr = function (rawName) {
    const lang = this.lang;
    const args = this.args();
    const name = aliasName(rawName, args.length, lang, this.line);
    // input("質問")：式の中でも使える（行の前で「質問して待つ」をして、「答え」を使う）
    if (name === 'input' && lang === 'py') {
      if (args.length > 1) throw new CodeError(this.line, 'input() の中には質問を1つだけ書いてね');
      return { ask: args.length ? asText(asInput(args[0], this.line)) : { text: '' } };
    }
    // Scratchは数と文字を自動で変えるので、int() float() str() は形だけ
    if (lang === 'py' && (name === 'int' || name === 'float' || name === 'str')) {
      if (args.length !== 1) throw new CodeError(this.line, name + '() の中には1つだけ書いてね');
      const a = asInput(args[0], this.line);
      if (name === 'str') return Object.assign({}, a, { strMark: true });
      if (name === 'int' && !a.ask && !('text' in a) && !('num' in a && /^-?\d+$/.test(String(a.num)))) {
        return { block: { opcode: 'operator_mathop', fields: { OPERATOR: 'floor' }, inputs: { NUM: withShadow(a, 'n') } } };
      }
      return a;
    }
    // len(リスト) はリストの長さ、len(文字) は文字数
    if ((name === 'len' || name === '長さ') && args.length === 1 && args[0] && args[0].block && args[0].block.opcode === 'data_listcontents') {
      return { block: { opcode: 'data_lengthoflist', fields: { LIST: listRef(args[0].block.fields.LIST.list) } } };
    }
    // 乱数()（0以上1未満の小数）
    if ((name === 'random' || name === '乱数') && args.length === 0) {
      return { block: { opcode: 'operator_random', inputs: { FROM: { num: '0' }, TO: { num: '1.0' } } } };
    }
    const special = {
      コスチューム番号: ['looks_costumenumbername', 'number'], コスチューム名: ['looks_costumenumbername', 'name'],
      costume_number: ['looks_costumenumbername', 'number'], costume_name: ['looks_costumenumbername', 'name'],
      背景番号: ['looks_backdropnumbername', 'number'], 背景名: ['looks_backdropnumbername', 'name'],
      backdrop_number: ['looks_backdropnumbername', 'number'], backdrop_name: ['looks_backdropnumbername', 'name']
    };
    if (special[name]) return { block: { opcode: special[name][0], fields: { NUMBER_NAME: special[name][1] } } };
    const fn = resolveFn(name, lang);
    if (fn) {
      if (CUR.inFunction && CUR.inFunction.name === fn) throw new CodeError(this.line, '関数の中で自分自身は呼べません');
      const want = CUR.functions[fn].params.length;
      if (args.length !== want) throw new CodeError(this.line, name + '() の中には ' + want + ' 個書いてね（いまは ' + args.length + ' 個）');
      CUR.used.add(fn);
      return { fcall: { name: fn, args: args.map((a) => asInput(a, this.line)) } };
    }
    const mop = mathByName[lang][name];
    if (mop) {
      if (args.length !== 1) throw new CodeError(this.line, name + '() の中には1つだけ書いてね');
      return { block: { opcode: 'operator_mathop', fields: { OPERATOR: mop }, inputs: { NUM: args[0] } } };
    }
    const row = repByName[lang][name];
    if (!row) {
      if (cmdByName[lang][name]) throw new CodeError(this.line, name + '() は命令なので、式の中には書けません');
      throw unknownFn(this.line, name, args.length);
    }
    return { block: buildCall(row, args, this.line, name) };
  };

  // 本物のPythonの書き方や共通テストの関数名を、ここでの名前にそろえる
  const ALIASES = {
    py: { 'random.randint': 'random', randint: 'random', 'random.random': 'random', 'time.sleep': 'wait', sleep: 'wait',
      'math.sqrt': 'sqrt', 'math.floor': 'floor', 'math.ceil': 'ceil', 'math.fabs': 'abs', 'math.sin': 'sin', 'math.cos': 'cos', 'math.tan': 'tan' },
    dncl: { 整数: '切り捨て' }
  };
  function aliasName(name, argc, lang, line) {
    const a = ALIASES[lang] && ALIASES[lang][name];
    if (a) return a;
    if (/\./.test(name)) throw new CodeError(line, '「' + name + '」は使えません');
    return name;
  }

  // ブロックを入れた入力にも、取り出したときの入力欄（シャドウ）を付けておく
  function withShadow(inp, kind) {
    if (inp && inp.block && !inp.shadow) return Object.assign({}, inp, { shadow: kind === 't' ? { text: '' } : { num: '' } });
    return inp;
  }

  function asInput(e, line) {
    if (e && e.bool !== undefined) throw new CodeError(line, 'True／False はここには書けません');
    if (e && e.listLit) throw new CodeError(line, 'リスト [ ] は「名前 = [ ]」の形でだけ書けます');
    return e;
  }

  function nameOf(e, line, what) {
    if (e && e.block && e.block.opcode === 'data_variable') return e.block.fields.VARIABLE.variable;
    if (e && e.block && e.block.opcode === 'data_listcontents') return e.block.fields.LIST.list;
    if (e && 'text' in e) return e.text;
    throw new CodeError(line, what + 'の名前を書いてね');
  }

  function valueOf(e, line) {
    if (e && 'text' in e) return e.text;
    if (e && 'num' in e) return e.num;
    throw new CodeError(line, 'ここには "〜" のような文字を書いてね');
  }

  function buildCall(row, args, line, name) {
    if (args.length !== row.args.length) {
      throw new CodeError(line, name + '() の中には ' + row.args.length + ' 個書いてね（いまは ' + args.length + ' 個）');
    }
    const spec = { opcode: row.opcode, inputs: {}, fields: {} };
    row.args.forEach((a, i) => {
      const e = args[i];
      if (a.k === 'f') spec.fields[a.name] = fromWord(valueOf(e, line));
      else if (a.k === 'v') spec.fields[a.name] = { variable: nameOf(e, line, '変数') };
      else if (a.k === 'L') spec.fields[a.name] = listRef(nameOf(e, line, 'リスト'));
      else if (a.k === 'm') {
        if (e && e.block) spec.inputs[a.name] = { block: e.block };
        else spec.inputs[a.name] = { menu: { opcode: a.opcode, field: a.field, value: fromWord(valueOf(e, line)) } };
      } else if (a.k === 'b') {
        if (e && e.block) spec.inputs[a.name] = { block: e.block };
        else spec.inputs[a.name] = { menu: { opcode: 'event_broadcast_menu', field: 'BROADCAST_OPTION', broadcast: valueOf(e, line) } };
      } else if (a.k === 'c') {
        spec.inputs[a.name] = { color: valueOf(e, line) };
      } else {
        const inp = asInput(e, line);
        // 文字の入力に数が来たら文字として
        if (a.k === 't' && inp && 'num' in inp) spec.inputs[a.name] = { text: inp.num };
        else if (a.k === 'n' && inp && 'text' in inp) spec.inputs[a.name] = isNumText(inp.text) ? { num: inp.text } : { text: inp.text };
        else spec.inputs[a.name] = withShadow(inp, a.k);
      }
    });
    if (LIST_INDEX_OPS.has(row.opcode) && spec.inputs.INDEX) {
      const ix = Object.assign({}, spec.inputs.INDEX);
      delete ix.shadow;
      spec.inputs.INDEX = withShadow(idx1(ix), 'n');
    }
    if (!Object.keys(spec.fields).length) delete spec.fields;
    return spec;
  }

  function condInput(e, line) {
    if (e && e.bool === true) return null; // 「ずっと」などでだけ使う
    if (e && e.bool === false) return undefined;
    if (!e || !e.block) throw new CodeError(line, '条件（〜 > 〜 や 触れている(...) など）を書いてね');
    return e;
  }

  // 文字列の外だけ：コメントを消し、DNCLでよく使う全角の（）：，を半角にする
  function normalize(raw, lang) {
    // Python の「import random」などは、書いてあっても無視する（Scratchでは不要）
    if (lang === 'py' && /^\s*(import\s+(random|time|math)(\s*,\s*(random|time|math))*|from\s+(random|time|math)\s+import\s+[\w*,\s]+)\s*(#.*)?$/.test(raw)) return '';
    let out = '';
    let q = null;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (q) {
        out += ch;
        if (ch === '\\' && i + 1 < raw.length) { out += raw[++i]; continue; }
        if ((q === '「' && ch === '」') || (q !== '「' && (ch === q || (q === '“' && ch === '”')))) q = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '「' || ch === '“') { q = ch; out += ch; continue; }
      if (ch === '#') break;
      if (lang === 'dncl') {
        if (ch === '（') { out += '('; continue; }
        if (ch === '）') { out += ')'; continue; }
        if (ch === '：') { out += ':'; continue; }
        if (ch === '，' || ch === '、') { out += (ch === '、' && /もし$|でなくもし$/.test(out.trim())) ? ' ' : ','; continue; }
      }
      out += ch;
    }
    return out.replace(/\s+$/, '');
  }

  // 行を読む：{line, raw, depth}
  function splitLines(text, lang) {
    const out = [];
    text.split(/\r?\n/).forEach((rawLine, idx) => {
      const line = idx + 1;
      let s = rawLine.replace(/\t/g, '    ');
      let indent = 0;
      if (lang === 'dncl') {
        // | や └ は1つで1段（空白2つ分）として数える
        let marks = 0;
        let spaces = 0;
        let j = 0;
        while (j < s.length && /[|｜└⎿│ 　]/.test(s[j])) {
          if (/[|｜└⎿│]/.test(s[j])) marks++;
          else spaces += s[j] === '　' ? 2 : 1;
          j++;
        }
        s = s.slice(j);
        indent = marks > 0 ? marks * 2 : spaces;
      } else {
        indent = /^ */.exec(s)[0].length;
        s = s.slice(indent);
      }
      s = normalize(s, lang);
      if (!s.trim()) return;
      out.push({ line, raw: s.trim(), indent, depth: 0 });
    });
    const stack = [0];
    out.forEach((ln) => {
      if (ln.indent > stack[stack.length - 1]) stack.push(ln.indent);
      else {
        while (stack.length > 1 && ln.indent < stack[stack.length - 1]) stack.pop();
        if (ln.indent !== stack[stack.length - 1]) throw new CodeError(ln.line, '字下げ（行のはじめの' + (lang === 'py' ? '空白' : '| や空白') + '）の深さがそろっていません');
      }
      ln.depth = stack.length - 1;
    });
    return out;
  }

  // ブロックの中身（深さ d の行の並び）を読む
  function parseBody(lines, pos, d, lang) {
    const stack = [];
    while (pos.i < lines.length) {
      const ln = lines[pos.i];
      if (ln.depth < d) break;
      if (ln.depth > d) throw new CodeError(ln.line, '字下げが深すぎます（前の行が「:」で終わっていないのに、字下げされています）');
      parseStatement(lines, pos, d, lang, stack);
    }
    return stack;
  }

  function childBody(lines, pos, d, lang, ln) {
    const nxt = lines[pos.i];
    if (!nxt || nxt.depth <= d) throw new CodeError(ln.line, '「:」のあとの行は、1段下げて（' + (lang === 'py' ? '空白4つ' : '| を付けて') + '）書いてね');
    return parseBody(lines, pos, d + 1, lang);
  }

  const toks = (ln, lang) => tokenize(ln.raw, ln.line);

  function endsWithColon(ts) {
    const last = ts[ts.length - 1];
    return last && last.t === 'op' && last.v === ':';
  }

  function parseExprFrom(ts, line, lang) {
    const p = new Parser(ts, line, lang);
    const e = p.expr();
    if (!p.done()) {
      const t = p.peek();
      // if や while の中で「=」を1つだけ書いたとき（比べるのは「==」）
      if (t && t.t === 'op' && t.v === '=') throw new CodeError(line, '比べるときは「=」ではなく「==」を使ってね（「=」は変数に入れるときに使う）');
      throw new CodeError(line, '「' + t.v + '」のあたりの書き方がおかしいです');
    }
    return e;
  }

  function findWord(ts, word) { return ts.findIndex((x) => x.t === 'id' && x.v === word); }

  function counted(vname, from, to, step, up, body) {
    const set = { opcode: 'data_setvariableto', fields: { VARIABLE: { variable: vname } }, inputs: { VALUE: from } };
    const cond = { block: { opcode: up ? 'operator_gt' : 'operator_lt', inputs: { OPERAND1: { block: { opcode: 'data_variable', fields: { VARIABLE: { variable: vname } } } }, OPERAND2: to } } };
    const change = { opcode: 'data_changevariableby', fields: { VARIABLE: { variable: vname } }, inputs: { VALUE: step } };
    return [set, { opcode: 'control_repeat_until', inputs: { CONDITION: cond, SUBSTACK: { stack: body.concat([change]) } } }];
  }

  // Data = [3, 1, 4] → リストを空にして順に追加。それ以外はふつうの代入
  function assignOrList(vname, rhs, line) {
    if (rhs && rhs.listLit) {
      CUR.lists.add(vname);
      const out = [{ opcode: 'data_deletealloflist', fields: { LIST: { list: vname } } }];
      rhs.listLit.forEach((it) => out.push({ opcode: 'data_addtolist', fields: { LIST: { list: vname } }, inputs: { ITEM: withShadow(asText(it), 't') } }));
      return out;
    }
    if (CUR.lists.has(vname)) throw new CodeError(line, '「' + vname + '」はリストです。リストに入れるときは「' + vname + ' = [ ]」や「' + vname + '[0] = 値」の形で書いてね');
    return [assign(vname, rhs, line)];
  }

  function assign(vname, rhs, line) {
    rhs = asInput(rhs, line);
    // v = v + x → v を x ずつ変える
    if (rhs && rhs.block && (rhs.block.opcode === 'operator_add' || rhs.block.opcode === 'operator_subtract') && isVarRef(rhs.block.inputs.NUM1, vname)) {
      let val = rhs.block.inputs.NUM2;
      if (rhs.block.opcode === 'operator_subtract') {
        if (val && 'num' in val) val = { num: String(-Number(val.num)) };
        else val = { block: { opcode: 'operator_subtract', inputs: { NUM1: { num: '0' }, NUM2: val } } };
      }
      return { opcode: 'data_changevariableby', fields: { VARIABLE: { variable: vname } }, inputs: { VALUE: withShadow(val, 'n') } };
    }
    if (rhs && rhs.block && rhs.block.opcode === 'data_listcontents') throw new CodeError(line, 'リストをそのまま別の名前に入れることはできません（1つずつコピーしてね）');
    return { opcode: 'data_setvariableto', fields: { VARIABLE: { variable: vname } }, inputs: { VALUE: withShadow(rhs, 't') } };
  }

  function parseStatement(lines, pos, d, lang, stack) {
    const ln = lines[pos.i++];
    const py = lang === 'py';
    let ts = py ? toks(ln, lang) : [];
    let word0 = ts[0] && ts[0].t === 'id' ? ts[0].v : null;

    if (py) {
      if (word0 === 'pass' && ts.length === 1) return;
      if (word0 === 'return') {
        if (!CUR.inFunction) throw new CodeError(ln.line, 'return は使えません');
        if (ts.length < 2) throw new CodeError(ln.line, 'return のうしろに返す値を書いてね');
        stack.push({ opcode: '__return', _line: ln.line, inputs: { VALUE: asInput(parseExprFrom(ts.slice(1), ln.line, lang), ln.line) } });
        return;
      }
      if (word0 === 'while') {
        if (!endsWithColon(ts)) throw new CodeError(ln.line, 'while の行の最後に「:」を付けてね');
        const inner = ts.slice(1, -1);
        if (inner.length === 1 && inner[0].t === 'id' && inner[0].v === 'True') {
          stack.push({ opcode: 'control_forever', inputs: { SUBSTACK: { stack: childBody(lines, pos, d, lang, ln) } } });
          return;
        }
        if (inner[0] && inner[0].t === 'id' && inner[0].v === 'not') {
          const e = condInput(parseExprFrom(inner.slice(1), ln.line, lang), ln.line);
          stack.push({ opcode: 'control_repeat_until', inputs: { CONDITION: e, SUBSTACK: { stack: childBody(lines, pos, d, lang, ln) } } });
          return;
        }
        const e = condInput(parseExprFrom(inner, ln.line, lang), ln.line);
        stack.push({ opcode: 'control_repeat_until', inputs: { CONDITION: { block: { opcode: 'operator_not', inputs: { OPERAND: e } } }, SUBSTACK: { stack: childBody(lines, pos, d, lang, ln) } } });
        return;
      }
      if (word0 === 'for') {
        // for v in range(...):
        if (!endsWithColon(ts) || !(ts[1] && ts[1].t === 'id') || !(ts[2] && ts[2].v === 'in') || !(ts[3] && ts[3].v === 'range')) {
          throw new CodeError(ln.line, 'for は「for i in range(1, 11):」の形で書いてね');
        }
        const p = new Parser(ts.slice(4, -1), ln.line, lang);
        const a = p.args();
        if (!p.done()) throw new CodeError(ln.line, 'range(...) のあとの書き方がおかしいです');
        const vname = ts[1].v;
        const body = childBody(lines, pos, d, lang, ln);
        if (a.length === 1 && vname === '_') {
          stack.push({ opcode: 'control_repeat', inputs: { TIMES: a[0], SUBSTACK: { stack: body } } });
          return;
        }
        const from = a.length === 1 ? { num: '0' } : a[0];
        const stop = a.length === 1 ? a[0] : a[1];
        const step = a.length === 3 ? a[2] : { num: '1' };
        const stepN = 'num' in step ? Number(step.num) : 1;
        const up = stepN > 0;
        const to = 'num' in stop ? { num: String(Number(stop.num) + (up ? -1 : 1)) } : { block: { opcode: up ? 'operator_subtract' : 'operator_add', inputs: { NUM1: stop, NUM2: { num: '1' } } } };
        counted(vname, from, to, step, up, body).forEach((x) => stack.push(x));
        return;
      }
      if (word0 === 'if') {
        if (!endsWithColon(ts)) throw new CodeError(ln.line, 'if の行の最後に「:」を付けてね');
        const e = condInput(parseExprFrom(ts.slice(1, -1), ln.line, lang), ln.line);
        const node = { opcode: 'control_if', inputs: { CONDITION: e, SUBSTACK: { stack: childBody(lines, pos, d, lang, ln) } } };
        stack.push(node);
        parseElse(lines, pos, d, lang, node);
        return;
      }
      if (word0 === 'elif' || word0 === 'else') throw new CodeError(ln.line, word0 + ' の前に if がありません（字下げをそろえてね）');
      if (word0 === 'wait_until') {
        const p = new Parser(ts.slice(1), ln.line, lang);
        const a = p.args();
        if (a.length !== 1) throw new CodeError(ln.line, 'wait_until() の中には条件を1つ書いてね');
        if (hasFcall(a[0])) throw new CodeError(ln.line, 'wait_until() の中では関数は使えません');
        stack.push({ opcode: 'control_wait_until', inputs: { CONDITION: condInput(a[0], ln.line) } });
        return;
      }
      // v += x / v -= x
      if (ts[0] && ts[0].t === 'id' && ts[1] && ts[1].t === 'op' && (ts[1].v === '+=' || ts[1].v === '-=')) {
        let val = parseExprFrom(ts.slice(2), ln.line, lang);
        if (ts[1].v === '-=') val = 'num' in val ? { num: String(-Number(val.num)) } : { block: { opcode: 'operator_subtract', inputs: { NUM1: { num: '0' }, NUM2: val } } };
        stack.push({ opcode: 'data_changevariableby', fields: { VARIABLE: { variable: ts[0].v } }, inputs: { VALUE: val } });
        return;
      }
    } else {
      // ---- DNCL ----（空白がなくても読めるように、行の形で判断する）
      const raw = ln.raw;
      const ex = (txt) => parseExprFrom(tokenize(txt, ln.line), ln.line, lang);
      const body = () => childBody(lines, pos, d, lang, ln);
      let mm;
      if (raw === '（なし）') return;
      if (/^ずっと繰り返す\s*:?$/.test(raw)) {
        if (!/:$/.test(raw)) throw new CodeError(ln.line, '行の最後に「:」を付けてね');
        stack.push({ opcode: 'control_forever', inputs: { SUBSTACK: { stack: body() } } });
        return;
      }
      if (/^もし/.test(raw)) {
        mm = /^もし[,\s]*(.+?)\s*ならば\s*(:?)$/.exec(raw);
        if (!mm) throw new CodeError(ln.line, '「もし 〜 ならば:」の形で書いてね');
        if (!mm[2]) throw new CodeError(ln.line, '「ならば」のあとに「:」を付けてね');
        const node = { opcode: 'control_if', inputs: { CONDITION: condInput(ex(mm[1]), ln.line), SUBSTACK: { stack: body() } } };
        stack.push(node);
        parseElse(lines, pos, d, lang, node);
        return;
      }
      if (/^そうでなくもし|^そうでなければ/.test(raw)) throw new CodeError(ln.line, '「そうでなくもし／そうでなければ」の前に「もし 〜 ならば:」がありません（字下げをそろえてね）');
      if ((mm = /^(.+?)\s*を\s*(.+?)\s*から\s*(.+?)\s*まで\s*(.+?)\s*ずつ\s*(増やし|減らし)ながら繰り返す\s*(:?)$/.exec(raw))) {
        if (!mm[6]) throw new CodeError(ln.line, '行の最後に「:」を付けてね');
        const vname = mm[1].trim();
        if (!IDENT.test(vname)) throw new CodeError(ln.line, '「' + vname + '」は変数の名前にできません');
        const up = mm[5] === '増やし';
        const stepE = ex(mm[4]);
        const step = 'num' in stepE ? { num: String((up ? 1 : -1) * Math.abs(Number(stepE.num))) } : (up ? stepE : { block: { opcode: 'operator_subtract', inputs: { NUM1: { num: '0' }, NUM2: stepE } } });
        counted(vname, ex(mm[2]), ex(mm[3]), step, up, body()).forEach((x) => stack.push(x));
        return;
      }
      if ((mm = /^(.+?)\s*回繰り返す\s*(:?)$/.exec(raw))) {
        if (!mm[2]) throw new CodeError(ln.line, '行の最後に「:」を付けてね');
        stack.push({ opcode: 'control_repeat', inputs: { TIMES: asInput(ex(mm[1]), ln.line), SUBSTACK: { stack: body() } } });
        return;
      }
      if ((mm = /^(.+?)\s*の間繰り返す\s*(:?)$/.exec(raw))) {
        if (!mm[2]) throw new CodeError(ln.line, '行の最後に「:」を付けてね');
        const e = condInput(ex(mm[1]), ln.line);
        stack.push({ opcode: 'control_repeat_until', inputs: { CONDITION: { block: { opcode: 'operator_not', inputs: { OPERAND: e } } }, SUBSTACK: { stack: body() } } });
        return;
      }
      if ((mm = /^(.+?)\s*になるまで繰り返す\s*(:?)$/.exec(raw))) {
        if (!mm[2]) throw new CodeError(ln.line, '行の最後に「:」を付けてね');
        stack.push({ opcode: 'control_repeat_until', inputs: { CONDITION: condInput(ex(mm[1]), ln.line), SUBSTACK: { stack: body() } } });
        return;
      }
      if ((mm = /^(.+?)\s*になるまで待つ$/.exec(raw))) {
        const we = ex(mm[1]);
        if (hasFcall(we)) throw new CodeError(ln.line, '「〜 になるまで待つ」の中では関数は使えません');
        stack.push({ opcode: 'control_wait_until', inputs: { CONDITION: condInput(we, ln.line) } });
        return;
      }
      if ((mm = /^(.+?)\s*と尋ねて\s*(.+?)\s*に代入$/.exec(raw))) {
        const vname = mm[2].trim();
        if (!IDENT.test(vname)) throw new CodeError(ln.line, '「' + vname + '」は変数の名前にできません');
        stack.push({ opcode: 'sensing_askandwait', inputs: { QUESTION: asText(ex(mm[1])) } });
        stack.push({ opcode: 'data_setvariableto', fields: { VARIABLE: { variable: vname } }, inputs: { VALUE: { block: { opcode: 'sensing_answer' } } } });
        return;
      }
      if ((mm = /^([^\s(=]+?)\s*を\s*(.+?)\s*(増やす|減らす)$/.exec(raw)) && IDENT.test(mm[1])) {
        let val = ex(mm[2]);
        if (mm[3] === '減らす') val = 'num' in val ? { num: String(-Number(val.num)) } : { block: { opcode: 'operator_subtract', inputs: { NUM1: { num: '0' }, NUM2: val } } };
        stack.push({ opcode: 'data_changevariableby', fields: { VARIABLE: { variable: mm[1] } }, inputs: { VALUE: val } });
        return;
      }
      if (/:$/.test(raw)) throw new CodeError(ln.line, 'この行の書き方がわかりません（「〜とき:」はスクリプトの先頭に、字下げなしで書いてね）');
    }

    // ---- 共通：代入と命令 ----
    if (!py) { ts = toks(ln, lang); word0 = ts[0] && ts[0].t === 'id' ? ts[0].v : null; }
    // ---- 配列（リスト） ----
    // Data[i] = x ／ Data[i] += x
    if (ts[0] && ts[0].t === 'id' && ts[1] && ts[1].t === 'op' && ts[1].v === '[') {
      const name = ts[0].v;
      const p = new Parser(ts.slice(1), ln.line, lang);
      const ix = p.readIndex();
      const opT = p.next();
      if (!opT || opT.t !== 'op' || !/^(=|\+=|-=)$/.test(opT.v)) throw new CodeError(ln.line, '「' + name + '[…]」のあとに「=」を書いてね（例：' + name + '[0] = 5）');
      let val = asInput(p.expr(), ln.line);
      if (!p.done()) throw new CodeError(ln.line, '「' + p.peek().v + '」のあたりの書き方がおかしいです');
      if (CUR.strs.has(name)) throw new CodeError(ln.line, '文字の一部だけを書きかえることはできません');
      const cur = { block: { opcode: 'data_itemoflist', fields: { LIST: listRef(name) }, inputs: { INDEX: withShadow(idx1(ix), 'n') } } };
      if (opT.v !== '=') val = { block: { opcode: opT.v === '+=' ? 'operator_add' : 'operator_subtract', inputs: { NUM1: withShadow(cur, 'n'), NUM2: withShadow(val, 'n') } } };
      stack.push({ opcode: 'data_replaceitemoflist', fields: { LIST: listRef(name) }, inputs: { INDEX: withShadow(idx1(ix), 'n'), ITEM: withShadow(asText(val), 't') } });
      return;
    }
    // data.append(x) など（Python）
    if (ts[0] && ts[0].t === 'id' && ts[1] && ts[1].t === 'op' && ts[1].v === '.' && ts[2] && ts[2].t === 'id') {
      const name = ts[0].v;
      const meth = ts[2].v;
      const p = new Parser(ts.slice(3), ln.line, lang);
      const a = p.args().map((x) => asInput(x, ln.line));
      if (!p.done()) throw new CodeError(ln.line, '「)」のあとの「' + p.peek().v + '」がよけいです');
      const L = () => ({ LIST: listRef(name) });
      const need = (n) => { if (a.length !== n) throw new CodeError(ln.line, name + '.' + meth + '() の中には ' + n + ' 個書いてね（いまは ' + a.length + ' 個）'); };
      if (meth === 'append') { need(1); stack.push({ opcode: 'data_addtolist', fields: L(), inputs: { ITEM: withShadow(asText(a[0]), 't') } }); return; }
      if (meth === 'insert') { need(2); stack.push({ opcode: 'data_insertatlist', fields: L(), inputs: { INDEX: withShadow(idx1(a[0]), 'n'), ITEM: withShadow(asText(a[1]), 't') } }); return; }
      if (meth === 'clear') { need(0); stack.push({ opcode: 'data_deletealloflist', fields: L() }); return; }
      if (meth === 'pop') {
        if (a.length > 1) need(1);
        stack.push({ opcode: 'data_deleteoflist', fields: L(), inputs: { INDEX: a.length ? withShadow(idx1(a[0]), 'n') : { text: 'last' } } });
        return;
      }
      if (meth === 'remove') {
        need(1);
        stack.push({ opcode: 'data_deleteoflist', fields: L(), inputs: { INDEX: withShadow({ block: { opcode: 'data_itemnumoflist', fields: L(), inputs: { ITEM: withShadow(asText(a[0]), 't') } } }, 'n') } });
        return;
      }
      throw new CodeError(ln.line, '「' + name + '.' + meth + '()」は使えません（append／insert／pop／remove／clear が使えます）');
    }
    // del data[i]（Python）
    if (py && word0 === 'del') {
      const name = ts[1] && ts[1].t === 'id' ? ts[1].v : null;
      if (!name || !(ts[2] && ts[2].t === 'op' && ts[2].v === '[')) throw new CodeError(ln.line, '「del リスト[番号]」の形で書いてね');
      const p = new Parser(ts.slice(2), ln.line, lang);
      const ix = p.readIndex();
      if (!p.done()) throw new CodeError(ln.line, '「]」のあとの「' + p.peek().v + '」がよけいです');
      stack.push({ opcode: 'data_deleteoflist', fields: { LIST: listRef(name) }, inputs: { INDEX: withShadow(idx1(ix), 'n') } });
      return;
    }
    if (ts[0] && ts[0].t === 'id' && ts[1] && ts[1].t === 'op' && ts[1].v === '=') {
      if (ts.length === 2) throw new CodeError(ln.line, '「=」の右に値を書いてね');
      // 共通テストの書き方：「kosu = 3 , kingaku = 300」のように1行に何個も代入できる
      if (!py) {
        const parts = [];
        let depth = 0;
        let start = 0;
        for (let k = 0; k < ts.length; k++) {
          const tk = ts[k];
          if (tk.t === 'op' && (tk.v === '(' || tk.v === '[')) depth++;
          else if (tk.t === 'op' && (tk.v === ')' || tk.v === ']')) depth--;
          else if (depth === 0 && tk.t === 'op' && tk.v === ',' && ts[k + 1] && ts[k + 1].t === 'id' && ts[k + 2] && ts[k + 2].t === 'op' && ts[k + 2].v === '=') {
            parts.push(ts.slice(start, k));
            start = k + 1;
          }
        }
        parts.push(ts.slice(start));
        if (parts.length > 1) {
          parts.forEach((pt) => {
            if (pt.length < 3) throw new CodeError(ln.line, '「=」の右に値を書いてね');
            assignOrList(pt[0].v, parseExprFrom(pt.slice(2), ln.line, lang), ln.line).forEach((x) => stack.push(x));
          });
          return;
        }
      }
      assignOrList(ts[0].v, parseExprFrom(ts.slice(2), ln.line, lang), ln.line).forEach((x) => stack.push(x));
      return;
    }
    if (ts[0] && ts[0].t === 'id' && ts[1] && ts[1].t === 'op' && ts[1].v === '(') {
      const p = new Parser(ts.slice(1), ln.line, lang);
      const a = p.args();
      let name = aliasName(ts[0].v, a.length, lang, ln.line);
      if (py && name === 'input') name = 'ask';
      if (name === 'random' || name === 'int' || name === 'str' || name === 'float') throw new CodeError(ln.line, name + '() は値を作る関数なので、1行だけでは使えません（「=」の右で使ってね）');
      if (!p.done()) {
        const rest = p.peek();
        throw new CodeError(ln.line, rest.v === ':' ? '「' + name + '(...)」の行に「:」はいりません' : '「)」のあとの「' + rest.v + '」がよけいです');
      }
      if (name === (py ? 'print' : '表示する')) {
        if (!a.length) throw new CodeError(ln.line, name + '() の中に表示するものを書いてね');
        let msg = withShadow(asText(asInput(a[0], ln.line)), 't');
        for (let k = 1; k < a.length; k++) msg = { block: { opcode: 'operator_join', inputs: { STRING1: msg, STRING2: withShadow(asText(asInput(a[k], ln.line)), 't') } }, shadow: { text: '' } };
        stack.push({ opcode: 'looks_say', inputs: { MESSAGE: msg } });
        return;
      }
      const fnName = resolveFn(name, lang);
      if (fnName) {
        if (CUR.inFunction && CUR.inFunction.name === fnName) throw new CodeError(ln.line, '関数の中で自分自身は呼べません');
        const want = CUR.functions[fnName].params.length;
        if (a.length !== want) throw new CodeError(ln.line, name + '() の中には ' + want + ' 個書いてね（いまは ' + a.length + ' 個）');
        CUR.used.add(fnName);
        stack.push({ opcode: 'procedures_call', fn: fnName, proccode: fnName + ' %s'.repeat(want), args: a.map((x) => asInput(x, ln.line)) });
        return;
      }
      const row = cmdByName[lang][name];
      if (!row) {
        if (repByName[lang][name] || mathByName[lang][name]) throw new CodeError(ln.line, name + '() は値を作る関数なので、1行だけでは使えません（「もし」や「=」の右で使ってね）');
        const hint = suggest(name, lang);
        if (hint) throw new CodeError(ln.line, '「' + name + '」という命令はありません' + hint);
        throw unknownFn(ln.line, name, a.length);
      }
      stack.push(buildCall(row, a, ln.line, name));
      return;
    }
    if (py && (word0 === 'def' || (ts[0] && ts[0].t === 'op' && ts[0].v === '@'))) throw new CodeError(ln.line, '@〜 と def は、字下げなしでスクリプトの先頭に書いてね');
    throw new CodeError(ln.line, 'この行の書き方がわかりません');
  }

  function asText(e) {
    if (e && 'num' in e) return { text: e.num };
    return e;
  }

  function suggest(name, lang) {
    const names = Object.keys(cmdByName[lang]);
    const hit = names.find((x) => x.includes(name) || name.includes(x));
    return hit ? '（もしかして「' + hit + '」？）' : '';
  }

  function parseElse(lines, pos, d, lang, node) {
    const py = lang === 'py';
    const nxt = lines[pos.i];
    if (!nxt || nxt.depth !== d) return;
    let isElif = false;
    let isElse = false;
    let condToks = null;
    if (py) {
      const ts = toks(nxt, lang);
      const w = ts[0] && ts[0].t === 'id' ? ts[0].v : '';
      if (w === 'elif' || w === 'else') {
        if (!endsWithColon(ts)) throw new CodeError(nxt.line, '行の最後に「:」を付けてね');
        if (w === 'elif') { isElif = true; condToks = ts.slice(1, -1); } else isElse = true;
      }
    } else if (/^そうでなくもし/.test(nxt.raw)) {
      const mm = /^そうでなくもし[,\s]*(.+?)\s*ならば\s*(:?)$/.exec(nxt.raw);
      if (!mm) throw new CodeError(nxt.line, '「そうでなくもし 〜 ならば:」の形で書いてね');
      if (!mm[2]) throw new CodeError(nxt.line, '行の最後に「:」を付けてね');
      isElif = true;
      condToks = tokenize(mm[1], nxt.line);
    } else if (/^そうでなければ/.test(nxt.raw)) {
      if (!/^そうでなければ\s*:$/.test(nxt.raw)) throw new CodeError(nxt.line, '「そうでなければ:」の形で書いてね');
      isElse = true;
    }
    if (isElif) {
      pos.i++;
      const e = condInput(parseExprFrom(condToks, nxt.line, lang), nxt.line);
      const inner = { opcode: 'control_if', inputs: { CONDITION: e, SUBSTACK: { stack: childBody(lines, pos, d, lang, nxt) } } };
      node.opcode = 'control_if_else';
      node.inputs.SUBSTACK2 = { stack: [inner] };
      parseElse(lines, pos, d, lang, inner);
      return;
    }
    if (isElse) {
      pos.i++;
      node.opcode = 'control_if_else';
      node.inputs.SUBSTACK2 = { stack: childBody(lines, pos, d, lang, nxt) };
    }
  }

  function parseHat(ln, lang, lines, pos) {
    const ts = tokenize(ln.raw, ln.line);
    if (lang === 'py') {
      if (ts[0] && ts[0].t === 'id' && ts[0].v === 'def') throw new CodeError(ln.line, '関数は自分で作らなくても大丈夫。使いたい名前で呼ぶと（例：g = 最大公約数(12, 18)）、「AIに作ってもらう」ボタンが出るよ');
      if (ts[0] && ts[0].t === 'id' && (ts[0].v === 'import' || ts[0].v === 'from')) throw new CodeError(ln.line, 'import は random・time・math だけ書けます（書かなくても使えます）');
      if (!(ts[0] && ts[0].t === 'op' && ts[0].v === '@' && ts[1] && ts[1].t === 'id')) {
        throw new CodeError(ln.line, 'スクリプトは「@when_flag_clicked」のような行から始めてね');
      }
      const h = HATS.find((x) => x.py === ts[1].v);
      if (!h) throw new CodeError(ln.line, '「@' + ts[1].v + '」はありません（@when_flag_clicked など）');
      const spec = { opcode: h.opcode };
      if (h.field) {
        const p = new Parser(ts.slice(2), ln.line, lang);
        const a = p.args();
        if (a.length !== 1) throw new CodeError(ln.line, '@' + h.py + '("...") のように1つ書いてね');
        const val = fromWord(valueOf(a[0], ln.line));
        spec.fields = {};
        spec.fields[h.field] = h.broadcast ? { broadcast: val } : val;
      } else if (ts.length > 2) throw new CodeError(ln.line, '@' + h.py + ' のうしろには何も書かないでね');
      const def = lines[pos.i];
      if (!def || def.depth !== 0) throw new CodeError(ln.line, '@' + h.py + ' の次の行に「def 名前():」を書いてね');
      const dts = tokenize(def.raw, def.line);
      if (!(dts[0] && dts[0].v === 'def' && dts[1] && dts[1].t === 'id' && endsWithColon(dts))) throw new CodeError(def.line, '「def 名前():」の形で書いてね');
      pos.i++;
      return spec;
    }
    if (!(ts.length && ts[ts.length - 1].t === 'op' && ts[ts.length - 1].v === ':')) throw new CodeError(ln.line, 'スクリプトの先頭は「緑の旗が押されたとき:」のように「:」で終わる行にしてね');
    const body = ts.slice(0, -1);
    const words = body.map((x) => x.v).join('');
    const simple = HATS.find((x) => !x.field && x.dncl === words);
    if (simple) return { opcode: simple.opcode };
    if (body.length >= 2 && body[0].t === 'str') {
      const rest = body.slice(1).map((x) => x.v).join('');
      if (rest === 'キーが押されたとき') return { opcode: 'event_whenkeypressed', fields: { KEY_OPTION: fromWord(body[0].v) } };
      if (rest === 'を受け取ったとき') return { opcode: 'event_whenbroadcastreceived', fields: { BROADCAST_OPTION: { broadcast: body[0].v } } };
    }
    if (body.length === 3 && body[0].v === '背景が' && body[1].t === 'str' && body[2].v === 'になったとき') {
      return { opcode: 'event_whenbackdropswitchesto', fields: { BACKDROP: body[1].v } };
    }
    throw new CodeError(ln.line, 'スクリプトの先頭は「緑の旗が押されたとき:」「"スペース" キーが押されたとき:」のような「〜とき:」の行にしてね');
  }


  // ---------------------------------------------------------------
  // 関数の呼び出しを、定義ブロックの呼び出し＋「〇〇の答え」変数に組みかえる
  // ---------------------------------------------------------------
  function hasFcall(x) {
    if (!x || typeof x !== 'object') return false;
    if (x.fcall || x.ask) return true;
    if (Array.isArray(x)) return x.some(hasFcall);
    return Object.keys(x).some((k) => k !== 'stack' && hasFcall(x[k]));
  }

  function countFcalls(x, counts) {
    if (!x || typeof x !== 'object') return;
    if (x.ask) { counts.__ask = (counts.__ask || 0) + 1; countFcalls(x.ask, counts); return; }
    if (x.fcall) {
      counts[x.fcall.name] = (counts[x.fcall.name] || 0) + 1;
      x.fcall.args.forEach((a) => countFcalls(a, counts));
      return;
    }
    if (Array.isArray(x)) { x.forEach((y) => countFcalls(y, counts)); return; }
    Object.keys(x).forEach((k) => { if (k !== 'stack') countFcalls(x[k], counts); });
  }

  const varRef = (name) => ({ block: { opcode: 'data_variable', fields: { VARIABLE: { variable: name } } } });

  function lowerInput(x, pre, plan) {
    if (!x || typeof x !== 'object') return x;
    if (x.ask) {
      const q = lowerInput(x.ask, pre, plan);
      pre.push({ opcode: 'sensing_askandwait', inputs: { QUESTION: withShadow(asText(q), 't') } });
      const ans = { block: { opcode: 'sensing_answer' } };
      if ((plan.counts.__ask || 0) > 1) {
        plan.idx.__ask = (plan.idx.__ask || 0) + 1;
        const tmp = '入力' + plan.idx.__ask;
        pre.push({ opcode: 'data_setvariableto', fields: { VARIABLE: { variable: tmp } }, inputs: { VALUE: withShadow(ans, 't') } });
        return varRef(tmp);
      }
      return ans;
    }
    if (x.fcall) {
      const name = x.fcall.name;
      const args = x.fcall.args.map((a) => lowerInput(a, pre, plan));
      pre.push({ opcode: 'procedures_call', fn: name, proccode: name + ' %s'.repeat(args.length), args });
      if ((plan.counts[name] || 0) > 1) {
        plan.idx[name] = (plan.idx[name] || 0) + 1;
        const tmp = answerVar(name) + plan.idx[name];
        pre.push({ opcode: 'data_setvariableto', fields: { VARIABLE: { variable: tmp } }, inputs: { VALUE: withShadow(varRef(answerVar(name)), 't') } });
        return varRef(tmp);
      }
      return varRef(answerVar(name));
    }
    if (x.block) {
      const b = Object.assign({}, x.block);
      if (b.inputs) {
        const inputs = {};
        Object.keys(b.inputs).forEach((k) => { inputs[k] = /^SUBSTACK/.test(k) ? b.inputs[k] : lowerInput(b.inputs[k], pre, plan); });
        b.inputs = inputs;
      }
      return Object.assign({}, x, { block: b });
    }
    return x;
  }

  // 1つの命令の、式の部分（中のブロックの並びはのぞく）を組みかえる
  function lowerStatement(st) {
    const pre = [];
    const counts = {};
    const exprParts = [];
    Object.keys(st.inputs || {}).forEach((k) => { if (!/^SUBSTACK/.test(k)) exprParts.push(st.inputs[k]); });
    (st.args || []).forEach((a) => exprParts.push(a));
    exprParts.forEach((e) => countFcalls(e, counts));
    const plan = { counts, idx: {} };
    const out = Object.assign({}, st);
    if (st.inputs) {
      out.inputs = {};
      Object.keys(st.inputs).forEach((k) => {
        out.inputs[k] = /^SUBSTACK/.test(k) ? { stack: lowerStack(st.inputs[k].stack || []) } : lowerInput(st.inputs[k], pre, plan);
      });
    }
    if (st.args) out.args = st.args.map((a) => lowerInput(a, pre, plan));
    // 条件でくり返すときは、くり返しの最後でも計算しなおす
    if (pre.length && out.opcode === 'control_repeat_until') {
      out.inputs.SUBSTACK = { stack: out.inputs.SUBSTACK.stack.concat(JSON.parse(JSON.stringify(pre))) };
    }
    return pre.concat([out]);
  }

  function stripMarks(x) {
    if (!x || typeof x !== 'object') return x;
    if (Array.isArray(x)) return x.map(stripMarks);
    const o = {};
    Object.keys(x).forEach((k) => { if (k !== 'strMark') o[k] = stripMarks(x[k]); });
    return o;
  }

  function lowerStack(stack) {
    const out = [];
    stack.forEach((st) => lowerStatement(st).forEach((x) => out.push(x)));
    return out;
  }

  // 関数の中身（Pythonの def）を定義ブロック用に変換する（AIや用意済みの関数のため）
  function compileFunction(code, opts) {
    const prev = CUR;
    try {
      CUR = { functions: knownFunctions(opts && opts.functions), used: new Set(), inFunction: null, lists: new Set(), strs: new Set(), base: 0 };
      const sc = scanNames(code, opts && opts.lists);
      CUR.lists = sc.lists; CUR.strs = sc.strs;
      const lines = splitLines(String(code || ''), 'py');
      if (!lines.length) throw new CodeError(1, '関数がありません');
      const first = lines[0];
      const ts = tokenize(first.raw, first.line);
      if (!(ts[0] && ts[0].v === 'def' && ts[1] && ts[1].t === 'id' && ts[2] && ts[2].v === '(' && endsWithColon(ts))) {
        throw new CodeError(first.line, '「def 名前(引数):」で始めてください');
      }
      const name = ts[1].v;
      if (!IDENT.test(name)) throw new CodeError(first.line, '関数の名前に使えない文字があります');
      const params = [];
      for (let i = 3; i < ts.length - 2; i++) {
        if (ts[i].t === 'id') params.push(ts[i].v);
        else if (!(ts[i].t === 'op' && ts[i].v === ',')) throw new CodeError(first.line, '引数の書き方がおかしいです');
      }
      if (!(ts[ts.length - 2] && ts[ts.length - 2].v === ')')) throw new CodeError(first.line, '「)」がありません');
      if (lines.length > 1 && lines.slice(1).some((l) => l.depth === 0)) throw new CodeError(lines.find((l, i) => i > 0 && l.depth === 0).line, '関数は1つだけ書いてください');
      CUR.inFunction = { name, params };
      const pos = { i: 1 };
      let body = lines.length > 1 ? parseBody(lines, pos, 1, 'py') : [];
      // return は最後の1回だけ
      const deepReturn = JSON.stringify(body.slice(0, -1)).includes('"__return"') ||
        (body.length && body[body.length - 1].opcode !== '__return' && JSON.stringify(body).includes('"__return"'));
      if (deepReturn) throw new CodeError(first.line, 'return は関数のいちばん最後に1回だけ書いてください（Scratchの定義ブロックは途中で戻れないため）');
      if (body.length && body[body.length - 1].opcode === '__return') {
        const r = body[body.length - 1];
        body[body.length - 1] = { opcode: 'data_setvariableto', fields: { VARIABLE: { variable: answerVar(name) } }, inputs: { VALUE: withShadow(r.inputs.VALUE, 't') } };
      }
      // 関数の中で値を入れる変数は「関数名_変数」にして、作品の変数とまざらないようにする
      const assigned = new Set();
      const walkAssign = (x) => {
        if (!x || typeof x !== 'object') return;
        if (Array.isArray(x)) { x.forEach(walkAssign); return; }
        if ((x.opcode === 'data_setvariableto' || x.opcode === 'data_changevariableby') && x.fields && x.fields.VARIABLE) assigned.add(x.fields.VARIABLE.variable);
        Object.keys(x).forEach((k) => walkAssign(x[k]));
      };
      walkAssign(body);
      params.forEach((pn) => { if (assigned.has(pn)) throw new CodeError(first.line, '引数「' + pn + '」に値を入れることはできません（Scratchの定義ブロックのきまり）。別の変数にコピーして使ってください'); });
      const keep = (v) => v === answerVar(name) || /の答え\d*$/.test(v);
      const rename = (x) => {
        if (!x || typeof x !== 'object') return x;
        if (Array.isArray(x)) return x.map(rename);
        if (x.opcode === 'data_variable' && x.fields && x.fields.VARIABLE) {
          const v = x.fields.VARIABLE.variable;
          if (params.includes(v)) return { opcode: 'argument_reporter_string_number', fields: { VALUE: v } };
          if (assigned.has(v) && !keep(v)) return { opcode: 'data_variable', fields: { VARIABLE: { variable: name + '_' + v } } };
          return x;
        }
        const o = {};
        Object.keys(x).forEach((k) => { o[k] = rename(x[k]); });
        if (o.fields && o.fields.VARIABLE && o.fields.VARIABLE.variable && o.opcode !== 'data_variable') {
          const v = o.fields.VARIABLE.variable;
          if (assigned.has(v) && !keep(v)) o.fields = Object.assign({}, o.fields, { VARIABLE: { variable: name + '_' + v } });
        }
        return o;
      };
      body = rename(body);
      body = stripMarks(lowerStack(body));
      return { name, params, body, used: Array.from(CUR.used), error: null };
    } catch (e) {
      if (e instanceof CodeError) return { error: { line: e.line, msg: e.message } };
      throw e;
    } finally {
      CUR = prev;
    }
  }

  function builtinFunction(name) {
    const bi = BUILTINS[name];
    if (!bi) return null;
    const r = compileFunction(bi.code, {});
    return r.error ? null : r;
  }


  // ---------------------------------------------------------------
  // 色分け：Scratchのブロックの色（カテゴリー）に合わせて、コードの文字に色を付ける
  // 返り値：行ごとの [{c: 種類, s: 文字}]。種類：ev 制御ct 動きmo 見た目lo 音sn 調べるse 演算op 変数va リストli ペンpe 関数fn 文字st 数nu コメントcm 印mk 全角zen
  // ---------------------------------------------------------------
  const CAT_OF = (opcode) => {
    const p = String(opcode).split('_')[0];
    if (p === 'data') return /list|item/.test(opcode) ? 'li' : 'va';
    return { motion: 'mo', looks: 'lo', sound: 'sn', event: 'ev', control: 'ct', sensing: 'se', operator: 'op', pen: 'pe', procedures: 'fn' }[p] || '';
  };
  let HL_MAP = null;
  function hlMap() {
    if (HL_MAP) return HL_MAP;
    const m = {};
    COMMANDS.concat(REPORTERS).forEach((r) => { const c = CAT_OF(r[2]); if (c) { m[r[0]] = c; m[r[1]] = c; } });
    MATHOPS.forEach((r) => { m[r[0]] = 'op'; m[r[1]] = 'op'; });
    ['絶対値', '切り捨て', '切り上げ', '平方根', 'abs', 'floor', 'ceil', 'sqrt', 'round'].forEach((k) => { m[k] = m[k] || 'op'; });
    HATS.forEach((h) => { m[h.py] = 'ev'; });
    m.print = m.print || 'lo'; m['表示する'] = m['表示する'] || 'lo';
    m.input = 'se'; m['と尋ねて'] = 'se'; m['に代入'] = 'se'; m.wait_until = 'ct';
    m['増やす'] = 'va'; m['減らす'] = 'va';
    const ct = ['を', 'もし', 'ならば', 'そうでなくもし', 'そうでなければ', 'ずっと繰り返す', '回繰り返す', 'の間繰り返す', 'になるまで繰り返す', 'になるまで待つ',
      'から', 'まで', 'ずつ増やしながら繰り返す', 'ずつ減らしながら繰り返す', 'ずつ', '増やしながら繰り返す', '減らしながら繰り返す', '繰り返す',
      'if', 'elif', 'else', 'while', 'for', 'in', 'range', 'True', 'False', 'return', 'pass', 'break'];
    ct.forEach((k) => { m[k] = 'ct'; });
    ['and', 'or', 'not', 'かつ', 'または', 'でない'].forEach((k) => { m[k] = 'op'; });
    m.def = 'ev';
    HL_MAP = m;
    return m;
  }
  const HL_RE = /(#.*$)|("[^"]*"?|「[^」]*」?|'[^']*'?)|([０-９（）：，、＋－＊／＝＜＞％“”]+)|(\d+(?:\.\d+)?)|(@?[A-Za-z_぀-ヿ㐀-鿿ｦ-ﾟ々〆ー][\w぀-ヿ㐀-鿿ｦ-ﾟ々〆ー]*)|(\*\*|\/\/|==|!=|<=|>=|[-+*\/%=<>])|([|｜│└⎿])|(\s+|.)/g;
  function highlight(text, lang, opts) {
    const m = hlMap();
    const fns = knownFunctions(opts && opts.functions);
    const fnNames = new Set(Object.keys(fns));
    Object.keys(BUILTINS).forEach((k) => fnNames.add(BUILTINS[k].py));
    const listNames = new Set((opts && opts.lists) || []);
    try { scanNames(text, opts && opts.lists).lists.forEach((n) => listNames.add(n)); } catch (e) { /* noop */ }
    return String(text).split('\n').map((line) => {
      const toks = [];
      const body = line.replace(/^[\s|｜│└⎿]*/, '');
      const isHat = lang !== 'py' && body === line.replace(/^\s*/, '') && /とき\s*[:：]\s*(#.*)?$/.test(body) && !/^[\s]/.test(line);
      let afterDef = false;
      let mm;
      HL_RE.lastIndex = 0;
      while ((mm = HL_RE.exec(line)) && mm[0] !== '') {
        const tx = mm[0];
        let c = '';
        if (mm[1]) c = 'cm';
        else if (mm[2]) c = isHat ? 'ev' : 'st';
        else if (mm[3]) c = 'zen';
        else if (mm[4]) c = isHat ? 'ev' : 'nu';
        else if (mm[5]) {
          const word = tx.replace(/^@/, '');
          const next = line.slice(HL_RE.lastIndex).replace(/^\s+/, '')[0];
          const prevTok = toks.length ? toks[toks.length - 1].s : '';
          if (isHat) c = 'ev';
          else if (tx[0] === '@') c = 'ev';
          else if (afterDef) { c = ''; afterDef = false; }
          else if (listNames.has(word) || next === '[') c = 'li';
          else if (/\.$/.test(prevTok) && /^(append|insert|pop|remove|clear)$/.test(word)) c = 'li';
          else if (fnNames.has(word)) c = 'fn';
          else if (m[word]) c = m[word];
          else if (next === '(' || next === '（') c = '';
          else c = 'va';
          if (word === 'def') afterDef = true;
        } else if (mm[6]) c = isHat ? 'ev' : (tx === '**' ? 'fn' : 'op');
        else if (mm[7]) c = 'mk';
        else if (/^[:：]$/.test(tx)) {
          const prev = toks.slice().reverse().find((t) => t.s.trim());
          c = isHat ? 'ev' : (prev && (prev.c === 'ct' || prev.c === 'ev') ? prev.c : '');
        } else c = '';
        const last = toks[toks.length - 1];
        if (last && last.c === c) last.s += tx; else toks.push({ c, s: tx });
      }
      return toks;
    });
  }

  // text → {scripts:[{blocks:[...]}], error:{line,msg}|null}
  function parse(text, lang, opts) {
    const prev = CUR;
    CUR = { functions: knownFunctions(opts && opts.functions), used: new Set(), inFunction: null, lists: new Set(), strs: new Set(), base: baseOf(text, opts && opts.base) };
    const sc = scanNames(text, opts && opts.lists);
    CUR.lists = sc.lists; CUR.strs = sc.strs;
    try {
      const lines = splitLines(text, lang);
      const pos = { i: 0 };
      const scripts = [];
      while (pos.i < lines.length) {
        const ln = lines[pos.i];
        if (ln.depth !== 0) throw new CodeError(ln.line, 'スクリプトの先頭は字下げなしで、「〜とき」の行から始めてね');
        pos.i++;
        const hat = parseHat(ln, lang, lines, pos);
        const body = (lines[pos.i] && lines[pos.i].depth > 0) ? parseBody(lines, pos, 1, lang) : [];
        scripts.push({ blocks: stripMarks([hat].concat(lowerStack(body))) });
      }
      return { scripts, error: null, used: Array.from(CUR.used), base: CUR.base, lists: Array.from(CUR.lists) };
    } catch (e) {
      if (e instanceof CodeError) return { scripts: [], error: { line: e.line, msg: e.message, extra: e.extra }, used: [], base: CUR.base };
      throw e;
    } finally {
      CUR = prev;
    }
  }

  // 対応表（AIの説明・ヘルプ用）
  function reference(lang) {
    const py = lang === 'py';
    const rows = COMMANDS.map((r) => (py ? r[1] : r[0]) + '(' + r[3].map((a) => a.name.toLowerCase()).join(', ') + ')  … ' + r[2]);
    const reps = REPORTERS.map((r) => (py ? r[1] : r[0]) + '(' + r[3].map((a) => a.name.toLowerCase()).join(', ') + ')  … ' + r[2]);
    return { commands: rows, reporters: reps };
  }

  const api = { toCode, parse, reference, highlight, compileFunction, builtinFunction, BUILTINS, HATS, COMMANDS, REPORTERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BlockCode = api;
})(typeof window !== 'undefined' ? window : globalThis);
