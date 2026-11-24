// 拡張機能の見守り（background.js）のテスト：node tests/bg-test.js
const fs = require('fs');
const vm = require('vm');
const ok = (c, l) => { console.log((c ? 'OK  ' : 'NG  ') + l); if (!c) process.exitCode = 1; };
const posts = [];
let active = true;
let tab = { id: 1, windowId: 1, url: 'https://scratch.mit.edu/projects/1/editor', title: 'Scratch', active: true };
let focused = true;
const L = {};
const on = (n) => ({ addListener: (f) => { (L[n] = L[n] || []).push(f); } });
const local = {}; const session = {};
const store = (o) => ({ get: async (k) => (k in o ? { [k]: o[k] } : {}), set: async (v) => Object.assign(o, v), remove: async (k) => { delete o[k]; } });
let badge = '';
let now = 1000000;
const ctx = {
  Date: Object.assign(function () { return new Date(now); }, { now: () => now }),
  console, URL, Uint8Array, String, btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  fetch: async (url, opt) => {
    if (String(url).includes('action=config')) return { json: async () => ({ active, awaySec: 30 }) };
    if (opt && opt.method === 'POST') { posts.push(JSON.parse(opt.body)); return { json: async () => ({ ok: true }) }; }
    return { blob: async () => { throw new Error('no'); } };
  },
  chrome: {
    storage: { local: store(local), session: store(session) },
    tabs: { query: async () => [tab], captureVisibleTab: async () => 'data:image/jpeg;base64,AAAA', onActivated: on('act'), onUpdated: on('upd') },
    windows: { getLastFocused: async () => ({ id: 1, focused }), onFocusChanged: on('focus') },
    alarms: { create() {}, onAlarm: on('alarm') },
    runtime: { onStartup: on('start'), onInstalled: on('inst'), onMessage: on('msg') },
    action: { setBadgeText: async (o) => { badge = o.text; }, setBadgeBackgroundColor: async () => {}, setTitle: async () => {} }
  }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('extension/background.js', 'utf8'), ctx);
const tick = async () => { for (const f of L.alarm) await f({ name: 'tick' }); };
const act = async () => { for (const f of L.act) await f({}); await new Promise((r) => setTimeout(r, 30)); };
(async () => {
  await new Promise((r) => L.msg[0]({ type: 'auth', token: 'a'.repeat(64) }, {}, r));
  ok(local.mtoken === 'a'.repeat(64), 'ログインした生徒の合言葉を保存する');
  await tick();
  ok(badge === 'REC' && posts.some((p) => p.action === 'shot' && p.url.includes('scratch')), '教室の時間は REC を出して、スクショを送る');
  posts.length = 0;
  tab = Object.assign({}, tab, { url: 'https://www.youtube.com/', title: 'YouTube' }); await act();
  ok(session.away && session.away.pages[0].title === 'YouTube' && !posts.length, 'Scratch から離れたら記録を始める（まだ送らない）');
  now += 40e3; await act();
  ok(posts.some((p) => p.action === 'away' && p.open && p.pages[0].title === 'YouTube'), '30秒以上離れたら、続いている記録として送る');
  tab = Object.assign({}, tab, { url: 'https://www.google.com/', title: 'Google' }); now += 5e3; await act();
  ok(session.away.pages.length === 2, '見ていたページの変化も記録する');
  posts.length = 0;
  tab = Object.assign({}, tab, { url: 'https://scratch.mit.edu/projects/1/editor', title: 'Scratch' }); now += 5e3; await act();
  const last = posts.filter((p) => p.action === 'away').pop();
  ok(last && !last.open && last.end - last.start === 50e3 && !session.away, 'Scratch にもどったら、終わった記録として送る（50秒）');
  posts.length = 0;
  tab = Object.assign({}, tab, { url: 'https://www.youtube.com/', title: 'YouTube' }); await act();
  now += 10e3; tab = Object.assign({}, tab, { url: 'https://scratch.mit.edu/', title: 'Scratch' }); await act();
  ok(!posts.some((p) => p.action === 'away'), '短い（30秒未満）よそ見は記録しない');
  active = false; now += 10 * 60e3; posts.length = 0; await tick();
  ok(badge === '' && !posts.length, '教室の時間外は何も送らず、REC も消える');
  process.exit();
})();
