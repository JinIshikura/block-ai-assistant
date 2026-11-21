/* コード（Python）の各行を、Scratch のブロック（色つきの帯・日本語）に置きかえて見せる。
 *  - BlockView.rows(code)：行ごとの { indent, kind, html, cat } の配列
 *  - BlockView.table(code)：ブロックとコードを横に並べた表（HTML 文字列）
 *  - BlockView.REFERENCE：対応一覧表のデータ
 *  - BlockView.CSS：見た目
 */
(function (root) {
  'use strict';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CAT = {
    event: { c: '#FFBF00', d: '#CC9900', n: 'イベント' }, motion: { c: '#4C97FF', d: '#3373CC', n: '動き' },
    looks: { c: '#9966FF', d: '#774DCB', n: '見た目' }, sound: { c: '#CF63CF', d: '#BD42BD', n: '音' },
    control: { c: '#FFAB19', d: '#CF8B17', n: '制御' }, sensing: { c: '#5CB1D6', d: '#2E8EB8', n: '調べる' },
    operator: { c: '#59C059', d: '#389438', n: '演算' }, variable: { c: '#FF8C1A', d: '#DB6E00', n: '変数' },
    list: { c: '#FF661A', d: '#E64D00', n: 'リスト' }, note: { c: '#8A93A3', d: '#6B7280', n: '' }
  };

  // ---- 式（かっこの中）を日本語のブロックに ----
  function tokenize(s) {
    const t = [];
    const re = /\s*(?:("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(-?\d+(?:\.\d+)?)|([\p{L}_][\p{L}\p{N}_]*)|(==|!=|<=|>=|[-+*/%<>()[\],.]))/uy;
    let m;
    let i = 0;
    while (i < s.length) {
      re.lastIndex = i;
      m = re.exec(s);
      if (!m) { if (/^\s+$/.test(s.slice(i))) break; return null; }
      if (m[1] !== undefined) t.push({ k: 'str', v: m[1].slice(1, -1) });
      else if (m[2] !== undefined) t.push({ k: 'num', v: m[2] });
      else if (m[3] !== undefined) t.push({ k: 'name', v: m[3] });
      else t.push({ k: 'op', v: m[4] });
      i = re.lastIndex;
    }
    return t;
  }
  function parseExpr(src) {
    const toks = tokenize(src);
    if (!toks) return null;
    let p = 0;
    const peek = () => toks[p];
    const eat = (v) => { if (toks[p] && toks[p].v === v) { p++; return true; } return false; };
    const PREC = { or: 1, and: 2, '==': 4, '!=': 4, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };
    function primary() {
      const t = toks[p++];
      if (!t) throw new Error('end');
      if (t.k === 'num') return { t: 'num', v: t.v };
      if (t.k === 'str') return { t: 'str', v: t.v };
      if (t.v === '(') { const e = expr(0); eat(')'); return e; }
      if (t.v === '[') { const items = []; while (peek() && peek().v !== ']') { items.push(expr(0)); eat(','); } eat(']'); return { t: 'listlit', items }; }
      if (t.v === '-') return { t: 'neg', a: primary() };
      if (t.v === 'not') return { t: 'not', a: expr(3) };
      if (t.k === 'name') {
        let node = { t: 'name', v: t.v };
        for (;;) {
          if (peek() && peek().v === '(') { p++; const args = []; while (peek() && peek().v !== ')') { args.push(expr(0)); eat(','); } eat(')'); node = { t: 'call', f: node.v, args }; }
          else if (peek() && peek().v === '[') { p++; const ix = expr(0); eat(']'); node = { t: 'index', l: node, i: ix }; }
          else if (peek() && peek().v === '.') { p++; const m = toks[p++]; node = { t: 'name', v: node.v + '.' + (m ? m.v : '') }; }
          else break;
        }
        return node;
      }
      throw new Error('bad');
    }
    function expr(min) {
      let left = primary();
      for (;;) {
        const t = peek();
        const op = t && (t.k === 'op' || t.v === 'and' || t.v === 'or') ? t.v : null;
        if (!op || !PREC[op] || PREC[op] < min || (min === 0 && false)) break;
        if (PREC[op] <= min - 1) break;
        p++;
        const right = expr(PREC[op] + 1);
        left = { t: 'bin', op, a: left, b: right };
      }
      return left;
    }
    try { const e = expr(0); return p === toks.length ? e : e; } catch (e) { return null; }
  }
  const isText = (n) => n && (n.t === 'str' || (n.t === 'bin' && n.op === '+' && (isText(n.a) || isText(n.b))) || (n.t === 'call' && n.f === 'str') || (n.t === 'call' && n.f === 'input'));
  // 丸い値・とがった条件・中に入るブロック
  const val = (s) => '<span class="bv-v">' + s + '</span>';
  const rep = (s, cat) => '<span class="bv-r" style="background:' + CAT[cat].c + ';border-color:' + CAT[cat].d + '">' + s + '</span>';
  const boo = (s, cat) => '<span class="bv-b" style="background:' + CAT[cat].c + ';border-color:' + CAT[cat].d + '">' + s + '</span>';
  const KEYJP = { space: 'スペース' };
  function ex(n, wantBool) {
    if (!n) return val('?');
    switch (n.t) {
      case 'num': return val(esc(n.v));
      case 'str': return val(esc(n.v));
      case 'neg': return n.a.t === 'num' ? val('-' + esc(n.a.v)) : rep(val('0') + ' − ' + ex(n.a), 'operator');
      case 'listlit': return val(esc(n.items.map((i) => (i.t === 'str' || i.t === 'num' ? i.v : '…')).join(' ')));
      case 'name':
        if (n.v === 'True') return boo('ほんとう', 'operator');
        if (n.v === 'False') return boo('うそ', 'operator');
        if (n.v === 'answer') return rep('答え', 'sensing');
        return rep(esc(n.v), 'variable');
      case 'not': return boo(ex(n.a, true) + ' ではない', 'operator');
      case 'index': return rep(ex(n.l) + ' の ' + (n.i.t === 'num' ? val(Number(n.i.v) + 1) : ex(n.i) + ' + 1') + ' 番目', 'list');
      case 'bin': {
        if (n.op === 'and' || n.op === 'or') return boo(ex(n.a, true) + (n.op === 'and' ? ' かつ ' : ' または ') + ex(n.b, true), 'operator');
        if (['==', '<', '>'].includes(n.op)) return boo(ex(n.a) + ' ' + (n.op === '==' ? '=' : n.op) + ' ' + ex(n.b), 'operator');
        if (n.op === '!=') return boo(boo(ex(n.a) + ' = ' + ex(n.b), 'operator') + ' ではない', 'operator');
        if (n.op === '<=' || n.op === '>=') return boo(ex(n.a) + ' ' + (n.op === '<=' ? '≦' : '≧') + ' ' + ex(n.b), 'operator');
        if (n.op === '+' && isText(n)) return rep(ex(n.a) + ' と ' + ex(n.b), 'operator');
        return rep(ex(n.a) + ' ' + ({ '*': '×', '/': '÷', '%': 'を割った余り' }[n.op] || n.op) + ' ' + ex(n.b), 'operator');
      }
      case 'call': {
        const a = n.args;
        switch (n.f) {
          case 'random': return rep(ex(a[0]) + ' から ' + ex(a[1]) + ' までの乱数', 'operator');
          case 'key_pressed': return boo((a[0] && a[0].t === 'str' ? val(esc(KEYJP[a[0].v] || a[0].v)) : ex(a[0])) + ' キーが押された', 'sensing');
          case 'touching': return boo(ex(a[0]) + ' に触れた', 'sensing');
          case 'x_position': return rep('x座標', 'motion');
          case 'y_position': return rep('y座標', 'motion');
          case 'direction': return rep('向き', 'motion');
          case 'mouse_down': return boo('マウスが押された', 'sensing');
          case 'timer': return rep('タイマー', 'sensing');
          case 'answer': return rep('答え', 'sensing');
          case 'len': return rep(ex(a[0]) + ' の長さ', 'list');
          case 'str': case 'int': case 'float': return ex(a[0]);
          case 'round': return rep(ex(a[0]) + ' を四捨五入', 'operator');
          case 'input': return rep('答え', 'sensing');
          default: return rep(esc(n.f) + '(…)', 'note');
        }
      }
      default: return val('?');
    }
  }

  // ---- 命令（1行）を日本語のブロックに ----
  const S = (cat, html) => ({ cat, html });
  const STMT = {
    move: (a) => S('motion', ex(a[0]) + ' 歩動かす'),
    turn_right: (a) => S('motion', '右に ' + ex(a[0]) + ' 度回す'),
    turn_left: (a) => S('motion', '左に ' + ex(a[0]) + ' 度回す'),
    go_to: (a) => S('motion', 'x座標を ' + ex(a[0]) + ' 、y座標を ' + ex(a[1]) + ' にする'),
    glide_to: (a) => S('motion', ex(a[0]) + ' 秒でx座標を ' + ex(a[1]) + ' に、y座標を ' + ex(a[2]) + ' に変える'),
    change_x: (a) => S('motion', 'x座標を ' + ex(a[0]) + ' ずつ変える'),
    change_y: (a) => S('motion', 'y座標を ' + ex(a[0]) + ' ずつ変える'),
    set_x: (a) => S('motion', 'x座標を ' + ex(a[0]) + ' にする'),
    set_y: (a) => S('motion', 'y座標を ' + ex(a[0]) + ' にする'),
    point_in_direction: (a) => S('motion', ex(a[0]) + ' 度に向ける'),
    bounce_on_edge: () => S('motion', 'もし端に着いたら、跳ね返る'),
    say_for: (a) => S('looks', ex(a[0]) + ' と ' + ex(a[1]) + ' 秒言う'),
    print: (a) => S('looks', ex(a[0]) + ' と言う'),
    think_for: (a) => S('looks', ex(a[0]) + ' と ' + ex(a[1]) + ' 秒考える'),
    show: () => S('looks', '表示する'),
    hide: () => S('looks', '隠す'),
    next_costume: () => S('looks', '次のコスチュームにする'),
    switch_costume: (a) => S('looks', 'コスチュームを ' + ex(a[0]) + ' にする'),
    change_size: (a) => S('looks', '大きさを ' + ex(a[0]) + ' ずつ変える'),
    set_size: (a) => S('looks', '大きさを ' + ex(a[0]) + ' %にする'),
    play_sound: (a) => S('sound', ex(a[0]) + ' の音を鳴らす'),
    wait: (a) => S('control', ex(a[0]) + ' 秒待つ'),
    stop: (a) => S('control', ex(a[0]) + ' を止める'),
    broadcast: (a) => S('event', ex(a[0]) + ' を送る'),
    broadcast_and_wait: (a) => S('event', ex(a[0]) + ' を送って待つ'),
    create_clone: (a) => S('control', ex(a[0]) + ' のクローンを作る'),
    delete_this_clone: () => S('control', 'このクローンを削除する')
  };
  const HAT = {
    when_flag_clicked: () => '<span class="bv-flag">⚑</span> が押されたとき',
    when_key_pressed: (a) => val(esc(a || 'スペース')) + ' キーが押されたとき',
    when_this_sprite_clicked: () => 'このスプライトが押されたとき',
    when_broadcast_received: (a) => val(esc(a || '')) + ' を受け取ったとき',
    when_i_start_as_clone: () => 'クローンされたとき'
  };

  function lineRow(line) {
    const m = /^(\s*)(.*?)\s*$/.exec(line);
    const ind = Math.floor(m[1].replace(/\t/g, '    ').length / 4);
    let s = m[2];
    const cm = /^#\s?(.*)$/.exec(s);
    if (!s) return { indent: ind, kind: 'blank', html: '' };
    if (cm) return { indent: ind, kind: 'comment', html: '<span class="bv-note">（メモ：コードだけに書けるもの）</span>' };
    s = s.replace(/\s+#.*$/, '');
    let mm;
    if ((mm = /^@([a-z_]+)(?:\((?:"([^"]*)"|'([^']*)')?\))?$/.exec(s))) {
      const h = HAT[mm[1]];
      return { indent: ind, kind: 'hat', cat: 'event', html: h ? h(mm[2] || mm[3]) : esc(s) };
    }
    if (/^def\s+script\d*\s*\(\s*\)\s*:$/.test(s)) return { indent: ind, kind: 'def', html: '<span class="bv-note">（はじまりの決まり文句：上の行とセット）</span>' };
    if ((mm = /^def\s+/.exec(s))) return { indent: ind, kind: 'note', html: '<span class="bv-note">（自分で作るブロック）</span>' };
    if (s === 'while True:') return { indent: ind, kind: 'c', cat: 'control', html: 'ずっと' };
    if ((mm = /^while\s+(.+):$/.exec(s))) return { indent: ind, kind: 'c', cat: 'control', html: ex(parseExpr(mm[1]), true) + ' のあいだ繰り返す' };
    if ((mm = /^for\s+\w+\s+in\s+range\((.+)\):$/.exec(s))) {
      const e = parseExpr('f(' + mm[1] + ')');
      const a = e && e.args ? e.args : [];
      let n;
      if (a.length === 1) n = ex(a[0]);
      else if (a.length === 2 && a[0].t === 'num' && a[1].t === 'num') n = val(Number(a[1].v) - Number(a[0].v));
      else n = ex(a[1]) + ' − ' + ex(a[0]);
      return { indent: ind, kind: 'c', cat: 'control', html: n + ' 回繰り返す' };
    }
    if ((mm = /^if\s+(.+):$/.exec(s))) return { indent: ind, kind: 'c', cat: 'control', html: 'もし ' + ex(parseExpr(mm[1]), true) + ' なら' };
    if ((mm = /^elif\s+(.+):$/.exec(s))) return { indent: ind, kind: 'c', cat: 'control', html: 'でなければ／もし ' + ex(parseExpr(mm[1]), true) + ' なら' };
    if (s === 'else:') return { indent: ind, kind: 'else', cat: 'control', html: 'でなければ' };
    if ((mm = /^([\p{L}_][\p{L}\p{N}_]*)\.append\((.*)\)$/u.exec(s))) return { indent: ind, kind: 'stmt', cat: 'list', html: ex(parseExpr(mm[2])) + ' を ' + rep(esc(mm[1]), 'list') + ' に追加する' };
    if ((mm = /^([\p{L}_][\p{L}\p{N}_]*)\s*=(?!=)\s*(.+)$/u.exec(s))) {
      const name = mm[1];
      const e = parseExpr(mm[2]);
      if (e && e.t === 'listlit') return { indent: ind, kind: 'stmt', cat: 'list', html: 'リスト ' + rep(esc(name), 'list') + ' を作って ' + val(esc(e.items.map((i) => i.v).join('、')) || '（から）') + ' を入れる' };
      const inp = e && (e.t === 'call' && e.f === 'input' ? e : e && e.t === 'call' && (e.f === 'int' || e.f === 'str') && e.args[0] && e.args[0].t === 'call' && e.args[0].f === 'input' ? e.args[0] : null);
      if (inp) return { indent: ind, kind: 'stmt2', cat: 'sensing', html: ex(inp.args[0]) + ' と聞いて待つ', html2: rep(esc(name), 'variable') + ' を ' + rep('答え', 'sensing') + ' にする', cat2: 'variable' };
      if (e && e.t === 'bin' && (e.op === '+' || e.op === '-') && e.a.t === 'name' && e.a.v === name && !isText(e)) {
        const d = e.op === '+' ? ex(e.b) : (e.b.t === 'num' ? val('-' + esc(e.b.v)) : rep(val('0') + ' − ' + ex(e.b), 'operator'));
        return { indent: ind, kind: 'stmt', cat: 'variable', html: rep(esc(name), 'variable') + ' を ' + d + ' ずつ変える' };
      }
      return { indent: ind, kind: 'stmt', cat: 'variable', html: rep(esc(name), 'variable') + ' を ' + ex(e) + ' にする' };
    }
    if ((mm = /^([a-z_]+)\((.*)\)$/.exec(s)) && STMT[mm[1]]) {
      const e = parseExpr(s);
      const r = STMT[mm[1]](e && e.args ? e.args : []);
      return { indent: ind, kind: 'stmt', cat: r.cat, html: r.html };
    }
    return { indent: ind, kind: 'unknown', html: '<span class="bv-note">（このツールでは使えない書き方かも）</span>' };
  }

  function rows(code) { return String(code || '').replace(/\s+$/, '').split('\n').map(lineRow); }

  function blockHtml(r) {
    if (r.kind === 'blank') return '';
    if (r.kind === 'def' || r.kind === 'comment' || r.kind === 'note' || r.kind === 'unknown') return r.html;
    const c = CAT[r.cat] || CAT.note;
    const cls = r.kind === 'hat' ? 'bv-blk bv-hat' : r.kind === 'c' || r.kind === 'else' ? 'bv-blk bv-c' : 'bv-blk';
    let h = '<span class="' + cls + '" style="background:' + c.c + ';border-color:' + c.d + '">' + r.html + '</span>';
    if (r.kind === 'stmt2') { const c2 = CAT[r.cat2]; h += '<span class="bv-blk" style="background:' + c2.c + ';border-color:' + c2.d + ';margin-top:3px">' + r.html2 + '</span>'; }
    return h;
  }

  // ブロックとコードを横に並べた表
  function table(code, opts) {
    const o = opts || {};
    const lines = String(code || '').replace(/\s+$/, '').split('\n');
    const rs = lines.map(lineRow);
    const hl = o.highlight || ((t) => esc(t));
    // 字下げの帯（Cブロックの中にいることを示す）
    const stack = [];
    let out = '<div class="bv-tbl">' + (o.noHead ? '' : '<div class="bv-hd"><span></span><span>ブロック</span><span>Python のコード</span></div>');
    rs.forEach((r, i) => {
      if (r.kind !== 'blank') { while (stack.length && stack[stack.length - 1].indent >= r.indent && !(r.kind === 'else' && stack[stack.length - 1].indent === r.indent)) stack.pop(); }
      const bars = stack.filter((s) => s.indent < r.indent).map((s) => '<span class="bv-bar" style="background:' + CAT[s.cat].c + '"></span>').join('');
      const lead = Math.max(0, r.indent - 1 - stack.filter((s) => s.indent < r.indent).length);
      out += '<div class="bv-row" data-line="' + (i + 1) + '"><span class="bv-n">' + (i + 1) + '</span><span class="bv-bk">' + bars + '<span style="display:inline-block;width:' + (lead * 14) + 'px"></span>' + blockHtml(r) + '</span><span class="bv-cd">' + hl(lines[i]) + '</span></div>';
      if (r.kind === 'c' || r.kind === 'else') { if (r.kind === 'else') stack.pop(); stack.push({ indent: r.indent, cat: r.cat }); }
    });
    return out + '</div>';
  }

  const CSS = `
  .bv-tbl { display: flex; flex-direction: column; gap: 2px; }
  .bv-hd, .bv-row { display: grid; grid-template-columns: 26px minmax(0, 1.15fr) minmax(0, 1fr); gap: 10px; align-items: center; }
  .bv-hd { font-size: 12px; color: #6B7280; margin-bottom: 2px; }
  .bv-row { min-height: 36px; border-radius: 8px; padding: 2px 4px; }
  .bv-row:hover { background: #FFF6D6; }
  .bv-n { font-size: 12px; color: #9AA1AB; text-align: right; }
  .bv-bk { display: flex; align-items: stretch; flex-wrap: nowrap; min-width: 0; }
  .bv-bk > .bv-blk { align-self: center; }
  .bv-bar { flex: none; width: 10px; margin-right: 4px; border-radius: 3px; }
  .bv-blk { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 3px; color: #fff; font-size: 13px; line-height: 1.5; border: 1px solid; border-radius: 6px; padding: 4px 9px; max-width: 100%; }
  .bv-hat { border-radius: 16px 16px 6px 6px; padding-top: 6px; }
  .bv-c { border-radius: 6px 6px 6px 0; }
  .bv-v { display: inline-block; background: #fff; color: #333; border-radius: 10px; padding: 0 7px; font-size: 12.5px; min-width: 14px; text-align: center; }
  .bv-r { display: inline-flex; align-items: center; gap: 3px; border: 1px solid; border-radius: 12px; padding: 0 6px; }
  .bv-b { display: inline-flex; align-items: center; gap: 3px; border: 1px solid; padding: 0 9px; clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 8px 100%, 0 50%); }
  .bv-flag { color: #4CBF56; background: #fff; border-radius: 4px; padding: 0 3px; font-size: 12px; }
  .bv-note { font-size: 12px; color: #6B7280; }
  .bv-cd { font-family: "BIZ UDGothic", Consolas, Menlo, monospace; font-size: 14px; background: #1E1F23; color: #E6E6E6; border-radius: 6px; padding: 6px 10px; white-space: pre; overflow: hidden; text-overflow: ellipsis; }
  .bv-row.empty .bv-cd { background: transparent; }
  `;

  // ---- 対応一覧表 ----
  const REFERENCE = [
    { cat: 'event', title: 'はじまり（イベント）', items: [
      { code: '@when_flag_clicked\ndef script1():', note: '旗が押されたら、下のまとまりが動く。2行でセット。中身は4つ右に下げて書く' },
      { code: '@when_key_pressed("スペース")\ndef script2():', note: 'キーの名前は "スペース" "右向き矢印" "a" など。script の番号は重ならなければよい' },
      { code: '@when_broadcast_received("ミス")\ndef script3():', note: 'メッセージを受け取ったとき' },
      { code: 'broadcast("ミス")', note: 'メッセージを送る' }
    ] },
    { cat: 'motion', title: '動き', items: [
      { code: 'move(10)', note: '向いている方へ動く' },
      { code: 'turn_right(15)', note: '右に回す（左は turn_left）' },
      { code: 'go_to(0, 170)', note: 'x座標（左右）・y座標（上下）の場所へ' },
      { code: 'change_x(10)', note: '右へ＋、左へ−' },
      { code: 'change_y(-5)', note: '上へ＋、下へ−' },
      { code: 'set_x(0)', note: 'x座標を決める（y は set_y）' },
      { code: 'x = x_position()', note: 'x座標・y座標は x_position()・y_position()' }
    ] },
    { cat: 'looks', title: '見た目', items: [
      { code: 'say_for("こんにちは！", 2)', note: '文字は " " でかこむ。数はそのまま' },
      { code: 'print("こんにちは！")', note: '言い続ける（ふきだしが消えない）' },
      { code: 'show()', note: '表示する（隠すは hide()）' },
      { code: 'next_costume()', note: '次のコスチュームにする' }
    ] },
    { cat: 'control', title: '制御', items: [
      { code: 'wait(1)', note: '秒数は 0.5 なども書ける' },
      { code: 'while True:\n    move(10)', note: 'ずっと。中に入れる命令は、4つ右に下げる' },
      { code: 'for i in range(3):\n    move(10)', note: '〇回繰り返す' },
      { code: 'while y_position() > -170:\n    change_y(-5)', note: '条件が正しいあいだ繰り返す（Scratch の「〜まで繰り返す」は条件が反対）' },
      { code: 'if key_pressed("スペース"):\n    say_for("ニャー", 1)', note: 'もし〜なら' },
      { code: 'if 得点 == 5:\n    print("クリア！")\nelse:\n    print("まだまだ")', note: 'でなければ（else）は if と同じ深さに書く' }
    ] },
    { cat: 'sensing', title: '調べる', items: [
      { code: 'if touching("ネコ"):\n    得点 = 得点 + 1', note: '触れたか（ほんとう／うそ）' },
      { code: '名前 = input("名前は？")', note: '質問して待つ。答えが変数に入る（Scratch では2つのブロック）' }
    ] },
    { cat: 'operator', title: '演算', items: [
      { code: 'x = random(1, 6)', note: '1〜6のどれか' },
      { code: 'if 得点 == 5:\n    wait(1)', note: '比べるときは ==（= は変数に入れる）' },
      { code: 'if 得点 > 3 and 得点 < 10:\n    wait(1)', note: 'かつ（and）・または（or）・ではない（not）' },
      { code: 'say_for("こんにちは、" + 名前, 2)', note: '文字の + は「つなぐ」' }
    ] },
    { cat: 'variable', title: '変数', items: [
      { code: '得点 = 0', note: '変数に入れる（なければ作られる）' },
      { code: '得点 = 得点 + 1', note: '1ずつ変える' }
    ] },
    { cat: 'list', title: 'リスト', items: [
      { code: 'ことば = ["やったね", "すごい"]', note: 'リストを作る' },
      { code: 'ことば.append("ナイス")', note: '追加する' },
      { code: 'say_for(ことば[0], 1)', note: 'Python は 0 から数える（[0] が1番目）' },
      { code: 'n = len(ことば)', note: '長さ' }
    ] }
  ];

  // ---- Python で使う英単語の意味 ----
  // [読み方, 英語の意味, プログラムでの使い方（なくてもよい）]
  const WORDS = {
    move: ['ムーブ', '動く・動かす'], turn: ['ターン', '回る・回す'], right: ['ライト', '右'], left: ['レフト', '左'],
    point: ['ポイント', '向ける・指す'], in: ['イン', '〜の中に・〜で'], direction: ['ディレクション', '方向・向き'],
    wait: ['ウェイト', '待つ'], print: ['プリント', '印刷する', '画面に文字を出す（このツールでは「言う」）'],
    say: ['セイ', '言う'], for: ['フォー', '〜のあいだ・〜について', 'for 文では「〜のそれぞれについて、くり返す」'],
    go: ['ゴー', '行く'], to: ['トゥー', '〜へ'], change: ['チェンジ', '変える'], set: ['セット', '決める・設定する'],
    x: ['エックス', '横の位置（x座標）'], y: ['ワイ', 'たての位置（y座標）'],
    when: ['ウェン', '〜のとき'], flag: ['フラッグ', '旗'], clicked: ['クリックト', 'クリックされた'],
    def: ['デフ', 'define（デファイン＝決める・定義する）の略', '命令のまとまりを作って、名前をつける'],
    script: ['スクリプト', '台本', 'プログラムのまとまり'],
    while: ['ワイル', '〜のあいだ', '条件が正しいあいだ、くり返す'], True: ['トゥルー', '本当・正しい'], False: ['フォールス', 'うそ・正しくない'],
    range: ['レンジ', '範囲', 'range(3) は 0, 1, 2 の3つ'], i: ['アイ', 'index（インデックス＝番号）の頭文字', 'くり返しの何回目かを入れる変数によく使う名前'],
    if: ['イフ', 'もし'], else: ['エルス', 'そうでなければ'], elif: ['エリフ', 'else if（そうでなく、もし）の略'],
    key: ['キー', 'キーボードのキー'], pressed: ['プレスト', '押された'], touching: ['タッチング', '触れている'],
    position: ['ポジション', '位置'], random: ['ランダム', 'でたらめ・無作為', '毎回ちがう数（乱数）を出す'],
    input: ['インプット', '入力', 'キーボードから答えを入れてもらう'], int: ['イント', 'integer（インテジャー＝整数）の略', '数にする'],
    str: ['ストラ', 'string（ストリング＝文字列）の略', '文字にする'], broadcast: ['ブロードキャスト', '放送する', 'ほかのスプライトみんなにメッセージを送る'],
    received: ['レシーブド', '受け取った'], append: ['アペンド', '付け足す', 'リストのいちばん後ろに追加する'],
    len: ['レン', 'length（レングス＝長さ）の略', 'リストに入っている数'], and: ['アンド', 'かつ・そして'], or: ['オア', 'または'], not: ['ノット', '〜ではない'],
    import: ['インポート', '取りこむ', 'ほかの命令のセットを使えるようにする'], time: ['タイム', '時間'], sleep: ['スリープ', '眠る', '〇秒止まる'],
    randint: ['ランドイント', 'random integer（ランダムな整数）', '〇から〇までの整数をランダムに出す'],
    show: ['ショウ', '見せる'], hide: ['ハイド', 'かくす'], next: ['ネクスト', '次の'], costume: ['コスチューム', '衣装'], stop: ['ストップ', '止める']
  };
  const SKIP = new Set(['script1', 'script2', 'script3']);
  // コードの中の英語の名前（命令・文法）を、出てきた順に返す
  function wordsIn(code) {
    const out = [];
    const seen = new Set();
    String(code || '').split('\n').forEach((line) => {
      let s = '';
      let q = '';
      for (const ch of line) {
        if (q) { if (ch === q) q = ''; continue; }
        if (ch === '"' || ch === "'") { q = ch; s += ' '; continue; }
        if (ch === '#') break;
        s += ch;
      }
      (s.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []).forEach((name) => {
        if (seen.has(name) || SKIP.has(name) || /^script\d+$/.test(name)) return;
        const parts = name.split('_').filter(Boolean).map((w) => ({ w, d: WORDS[w] }));
        if (!parts.some((p) => p.d)) return;
        seen.add(name);
        out.push({ name, parts });
      });
    });
    return out;
  }
  // 「turn（ターン）回る ＋ right（ライト）右」のような説明（HTML）
  function wordHtml(item, opts) {
    const o = opts || {};
    const p = item.parts.map((x) => (x.d ? '<b>' + esc(x.w) + '</b><span class="bv-yomi">（' + esc(x.d[0]) + '）</span>' + esc(x.d[1]) : '<b>' + esc(x.w) + '</b>')).join(' ＋ ');
    const use = item.parts.length === 1 && item.parts[0].d && item.parts[0].d[2] ? '<span class="bv-use">→ ' + esc(item.parts[0].d[2]) + '</span>' : '';
    return (item.parts.length > 1 ? '<code class="bv-wn">' + esc(item.name) + '</code> ' : '') + p + (o.noUse ? '' : use);
  }
  const wordText = (item) => item.parts.map((x) => (x.d ? x.w + '＝' + x.d[1] : x.w)).join('、');

  // ブロックだけを縦に並べる（左の「使うコード」や選ぶ問題で使う）
  function blocks(code) {
    return '<span class="bv-stack">' + rows(code).filter((r) => r.kind !== 'blank' && r.kind !== 'def' && r.kind !== 'comment').map((r) => '<span class="bv-sl" style="padding-left:' + (r.indent * 12) + 'px">' + blockHtml(r) + '</span>').join('') + '</span>';
  }
  const WCSS = '.bv-words{background:#F6F2FF;border:1px solid #E1D6FA;border-radius:10px;padding:8px 12px;display:flex;flex-direction:column;gap:4px;font-size:14px;line-height:1.6}.bv-words .bv-wt{font-size:12px;font-weight:700;color:#4B23A3}.bv-words b{font-family:"BIZ UDGothic",Consolas,Menlo,monospace;color:#3B2C82}.bv-yomi{font-size:12px;color:#6B7280;margin-right:4px}.bv-use{display:block;font-size:12.5px;color:#555B63;margin-left:12px}.bv-wn{font-family:"BIZ UDGothic",Consolas,Menlo,monospace;background:#EEF0F3;border-radius:4px;padding:0 5px;margin-right:4px}';
  function wordsBox(list, title) {
    if (!list.length) return '';
    return '<div class="bv-words"><span class="bv-wt">' + esc(title || 'ことばの意味') + '</span>' + list.map((w) => '<div>' + wordHtml(w) + '</div>').join('') + '</div>';
  }
  root.BlockView = { rows, table, blocks, lineRow, parseExpr, wordsIn, wordHtml, wordText, wordsBox, WORDS, CSS: CSS + WCSS + '.bv-stack{display:inline-flex;flex-direction:column;gap:3px;align-items:flex-start}.bv-sl{display:block}', REFERENCE, CAT };
})(typeof window !== 'undefined' ? window : globalThis);
