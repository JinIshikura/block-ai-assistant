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
const answers = JSON.parse(fs.readFileSync(R + 'tests/answers.json', 'utf8')); // tools/course.py が作る
(async () => {
  vm.start();
  const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
  for (const id of Object.keys(answers).filter((k) => !only || only.test(k))) {
    const e = ex[id];
    const good = await judge(e, answers[id]);
    let bad;
    try { bad = await judge(e, e.starter[e.sprite]); } catch (err) { bad = ['parse error']; }
    const touch = false;
    ok(touch ? good[0] === true : good.every(Boolean), id + ' 正しいコードは合格' + (touch ? '（触れる判定はnodeでは確かめられないのでコードのみ）' : '') + ': ' + JSON.stringify(good));
    ok(!bad.every((x) => x === true), id + ' 最初のままのコードは不合格: ' + JSON.stringify(bad));
  }
  const stale = [{ t: 0, sprites: { リンゴ: { y: -185 } } }, { t: 100, sprites: { リンゴ: { y: 170 } } }, { t: 2000, sprites: { リンゴ: { y: -185 } } }, { t: 4000, sprites: { リンゴ: { y: -185 } } }];
  ok(!L.evalExpect({ kind: 'returnAfter', sprite: 'リンゴ', prop: 'y', below: -60, above: 120 }, stale), '動かす前に下にいた位置では「戻った」と判定しない');
  process.exit();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
