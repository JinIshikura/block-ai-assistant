const fs = require('fs');
const VM = require('scratch-vm');
const { JSDOM } = require('jsdom');
const R = '/home/claude/block-ai-assistant/';
const C = require(R + 'public/app/codeconv.js');
const course = JSON.parse(fs.readFileSync(R + 'public/learn/course.json', 'utf8'));
const sb3 = fs.readFileSync(R + 'public/learn/catch.sb3');
// learn.js の判定の関数を取り出す
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://block-ai-assistant.pages.dev/app/', runScripts: 'outside-only' });
dom.window.BlockAIHost = { origin: 'https://scratch.mit.edu', post() {}, on() {} };
dom.window.eval(fs.readFileSync(R + 'public/app/codeconv.js', 'utf8'));
dom.window.eval(fs.readFileSync(R + 'public/app/learn.js', 'utf8'));
const L = dom.window.BlockLearn;
// Scratchのまね（node の scratch-vm）
const vm = new VM();
const ScratchStorage = require('scratch-storage'); vm.attachStorage(new (ScratchStorage.ScratchStorage || ScratchStorage)());
vm.attachRenderer(new Proxy({}, { get: (t, k) => (k === 'then' ? undefined : (...a) => { if (k === 'getSkinSize' || k === 'getNativeSize' || k === 'getCurrentSkinSize') return [40, 40]; if (k === 'getSkinRotationCenter') return [0, 0]; if (k === 'getFencedPositionOfDrawable') return a[1]; if (/^isTouching|^pick/.test(k)) return false; if (/^getBounds/.test(k)) return { left: -10, right: 10, top: 10, bottom: -10 }; return 1; }) }));
let handler; const replies = {};
const fakeEl = { '__reactFiber$x': { memoizedProps: { vm }, return: null } };
global.window = { addEventListener: (t, fn) => { if (t === 'message') handler = fn; }, postMessage: (m) => { if (m.id) replies[m.id] = m; } };
global.document = { querySelector: (sel) => (sel.includes('stage-wrapper') ? fakeEl : null) };
global.location = { origin: 'x' }; global.CSS = { escape: (s) => s };
new Function(fs.readFileSync(R + 'extension/page-bridge.js', 'utf8'))();
let n = 0;
const call = async (method, params) => { const id = 'q' + (++n); await handler({ source: global.window, data: { source: 'block-ai-cs', id, method, params } }); const r = replies[id]; if (r.error) throw new Error(r.error); return r.result; };
const ok = (c, l) => { console.log((c ? 'OK  ' : 'NG  ') + l); if (!c) process.exitCode = 1; };
async function apply(sprite, code) {
  const p = C.parse(code, 'py', {}); if (p.error) throw new Error(p.error.msg);
  const cur = await call('getScripts', { sprite });
  await call('replaceScripts', { sprite, removeTopIds: cur.scripts.map((s) => s.topId), scripts: p.scripts });
  return p;
}
async function judge(ex, code) {
  if (C.parse(code, 'py', {}).error) return [false];
  const ab = sb3.buffer.slice(sb3.byteOffset, sb3.byteOffset + sb3.byteLength);
  await call('loadProject', { sb3: ab });
  for (const sp of Object.keys(ex.starter)) { try { await apply(sp, ex.starter[sp]); } catch (e) { if (!ex.brokenStarter) throw e; } }
  const p = await apply(ex.sprite, code);
  const lines = { [ex.sprite]: L.canonicalLines(p.scripts) };
  Object.keys(ex.starter).forEach((sp) => { if (sp !== ex.sprite) lines[sp] = L.canonicalLines(C.parse(ex.starter[sp], 'py', {}).scripts); });
  const out = [];
  for (const c of ex.checks) {
    if (c.type === 'code') out.push(L.checkCode(c, lines).ok);
    else {
      const timers = (c.answers || []).map((a) => setTimeout(() => { call('answerQuestion', { text: String(a.text) }).catch(() => {}); }, a.at));
      const r = await call('runTest', { ms: c.ms, setup: c.setup, keys: c.keys, sampleMs: 100 });
      timers.forEach(clearTimeout);
      out.push(c.expect.every((x) => L.evalExpect(x, r.samples)));
    }
  }
  return out;
}
const ex = {}; course.steps.forEach((st) => st.lessons.forEach((l) => l.exercises.forEach((e) => { ex[e.id] = e; })));
const A = ex.l1e1.starter['リンゴ'];
const CAT = ex.l1e1.starter['ネコ'];
const RET = '\n        if y_position() < -170:\n            go_to(random(-200, 200), 170)';
const JUMP = (n) => '\n\n@when_key_pressed("スペース")\ndef script2():\n    for i in range(' + n + '):\n        change_y(40)\n        wait(0.2)\n        change_y(-40)\n        wait(0.2)';
const FAST = CAT.replace('change_x(10)', 'change_x(15)').replace('change_x(-10)', 'change_x(-15)');
const l6 = 1; const ST = () => '@when_flag_clicked\ndef script1():\n    go_to(0, -140)';
const CLEAR = '\n        if 得点 == 5:\n            print("クリア！")';
const answers = {
  l1e1: A.replace('change_y(-5)', 'change_y(-10)'),
  l1e2: A.replace('得点 = 得点 + 1', '得点 = 得点 + 2'),
  l1e3: CAT + '\n\n@when_key_pressed("スペース")\ndef script2():\n    say_for("いくぞ！", 2)',
  l2e1: A + RET,
  l2e2: ex.l2e2.starter['リンゴ'].replace('    得点 = 0', '    得点 = 0\n    ミス = 0').replace('if y_position() < -170:\n', 'if y_position() < -170:\n            ミス = ミス + 1\n'),
  r1e1: A.replace('change_y(-5)', 'change_y(-4)').replace('    得点 = 0', '    得点 = 0\n    ミス = 0') + '\n        if y_position() < -170:\n            ミス = ミス + 1\n            go_to(random(-200, 200), 170)',
  r1e2: FAST + '\n\n@when_key_pressed("スペース")\ndef script2():\n    say_for("がんばれ！", 1)',
  l3e1: FAST,
  l3e2: A + CLEAR,
  l3e3: A + RET,
  l4e1: CAT + JUMP(3),
  l4e2: CAT,
  l5e1: A,
  l5e2: A,
  l5e3: A + CLEAR,
  r2e1: A + RET,
  r2e2: FAST + JUMP(2),
  // ステップ3
  l6e1: ST('ネコ', l6) + '\n    名前 = input("名前は？")\n    say_for("こんにちは、" + 名前 + "！", 2)',
  l6e2: ex.l6e2.starter['ネコ'] + '\n    if 答え == "12":\n        say_for("正解！", 2)\n    else:\n        say_for("ざんねん", 2)',
  l6e3: ST('ネコ', l6) + '\n    a = int(input("1つめの数は？"))\n    b = int(input("2つめの数は？"))\n    say_for(a + b, 2)',
  l7e1: ex.l7e1.starter['リンゴ'] + '\n    while y_position() > -170:\n        change_y(-5)\n    print("落ちた！")',
  l7e2: ex.l7e2.starter['リンゴ'].replace('change_y(-5)', 'change_y(-速さ)').replace('go_to(random(-200, 200), 170)', 'go_to(random(-200, 200), 170)\n            速さ = 速さ + 1'),
  l7e3: CAT + '\n\n@when_key_pressed("スペース")\ndef script2():\n    目 = random(1, 6)\n    say_for(str(目) + "が出た！", 1)',
  l8e1: CAT + '\n\n@when_broadcast_received("ミス")\ndef script2():\n    say_for("あっ！", 1)',
  l8e2: ex.l8e2.starter['リンゴ'].replace('        if y_position() < -170:\n', '        if y_position() < -170:\n            broadcast("ミス")\n'),
  l8e3: ex.l8e3.starter['リンゴ'].replace('@when_flag_clicked', '@when_broadcast_received("スタート")'),
  l9e1: CAT + '\n\n@when_key_pressed("スペース")\ndef script2():\n    ことば = ["やったね", "すごい", "その調子"]\n    say_for(ことば[random(0, 2)], 1)',
  l9e2: ex.l9e2.starter['リンゴ'].replace('            go_to(random', '            記録.append(x_position())\n            go_to(random'),
  l10e1: ex.l10e1.starter['ネコ'].replace('    print("あたり！")', '    while 予想 != 正解:\n        if 予想 < 正解:\n            say_for("もっと大きい", 1)\n        else:\n            say_for("もっと小さい", 1)\n        予想 = int(input("1から10の数は？"))\n    print("あたり！")'),
  l10e2: ex.l10e2.starter['ネコ'] + '\n    for i in range(1, 11):\n        合計 = 合計 + i\n    say_for(合計, 2)',
  r3e1: ex.r3e1.starter['リンゴ'] + '\n    ミス = 0\n    while ミス < 3:\n        change_y(-6)\n        if y_position() < -170:\n            ミス = ミス + 1\n            go_to(random(-200, 200), 170)\n    print("ゲームオーバー")',
  r3e2: ex.r3e2.starter['ネコ'].replace('    say_for("点数は"', '    for i in range(3):\n        答え = input(問題[i])\n        if 答え == 正解[i]:\n            点数 = 点数 + 1\n    say_for("点数は"')
};
(async () => {
  vm.start();
  const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
  for (const id of Object.keys(answers).filter((k) => !only || only.test(k))) {
    const e = ex[id];
    const good = await judge(e, answers[id]);
    let bad;
    try { bad = await judge(e, e.starter[e.sprite]); } catch (err) { bad = ['parse error']; }
    const touch = id === 'l1e2';
    ok(touch ? good[0] === true : good.every(Boolean), id + ' 正しいコードは合格' + (touch ? '（触れる判定はnodeでは確かめられないのでコードのみ）' : '') + ': ' + JSON.stringify(good));
    ok(!bad.every((x) => x === true), id + ' 最初のままのコードは不合格: ' + JSON.stringify(bad));
  }
  // 字下げをまちがえた例（ネコの if の中に入れた）
  const wrong = A + '\n            if y_position() < -170:\n                go_to(random(-200, 200), 170)';
  const w = await judge(ex.l2e1, wrong);
  ok(w[0] === false && w[1] === false, 'l2e1 ネコの if の中に入れると、コードも動きも不合格: ' + JSON.stringify(w));
  const stale = [{ t: 0, sprites: { リンゴ: { y: -185 } } }, { t: 100, sprites: { リンゴ: { y: 170 } } }, { t: 2000, sprites: { リンゴ: { y: -185 } } }, { t: 4000, sprites: { リンゴ: { y: -185 } } }];
  ok(!L.evalExpect({ kind: 'returnAfter', sprite: 'リンゴ', prop: 'y', below: -60, above: 120 }, stale), '動かす前に下にいた位置では「戻った」と判定しない');
  process.exit();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
