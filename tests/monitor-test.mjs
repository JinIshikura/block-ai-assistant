// 見守り（/api/monitor）のテスト：node tests/monitor-test.mjs
import { onRequestPost as auth } from '/home/claude/block-ai-assistant/functions/api/auth.js';
import { onRequestPost as mon, onRequestGet as monGet } from '/home/claude/block-ai-assistant/functions/api/monitor.js';
const ok = (c, l) => { console.log((c ? 'OK  ' : 'NG  ') + l); if (!c) process.exitCode = 1; };
const store = new Map();
const USERS = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list({ prefix }) { return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; } };
// D1 のまね（Node の SQLite）
import { DatabaseSync } from 'node:sqlite';
const sql = new DatabaseSync(':memory:');
const stmt = (q, args = []) => ({
  bind: (...a) => stmt(q, a),
  run: async () => { sql.prepare(q).run(...args); return { success: true }; },
  all: async () => ({ results: sql.prepare(q).all(...args) }),
  first: async () => sql.prepare(q).get(...args) || null
});
const MON = { prepare: (q) => stmt(q), batch: async (list) => { for (const x of list) await x.run(); return []; } };
const shotCount = () => sql.prepare('SELECT COUNT(*) AS n FROM shots').get().n;
const env = { USERS, MON, TEACHER_ID: 'sensei', TEACHER_PASSWORD: 'pw-123456' };
const req = (path, body, token) => new Request('https://x.pages.dev' + path, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}), body: JSON.stringify(body) });
const A = async (b, t) => (await auth({ request: req('/api/auth', b, t), env })).json();
const M = async (b, t) => { const r = await mon({ request: req('/api/monitor', b, t), env }); return r.headers.get('content-type') === 'image/jpeg' ? { img: true, status: r.status } : Object.assign(await r.json(), { status: r.status }); };
const T = (await A({ action: 'login', id: 'sensei', password: 'pw-123456' })).token;
const made = await A({ action: 'create', students: [{ id: 'kid1', name: 'たろう', password: 'abc123' }] }, T);
const S = (await A({ action: 'login', id: 'kid1', password: 'abc123' })).token;
let r = await (await monGet({ request: new Request('https://x.pages.dev/api/monitor?action=config'), env })).json();
ok(r.ok && r.day === 0 && r.start === '10:00' && /日曜/.test(r.label), '最初の設定は日曜 10:00〜12:00: ' + r.label);
r = await M({ action: 'setConfig', day: 9, start: '10:00', end: '09:00', awaySec: 60 }, T);
ok(!r.ok, 'おかしな設定は保存しない');
r = await M({ action: 'setConfig', day: 0, start: '10:00', end: '12:00', awaySec: 60 }, S);
ok(r.status === 403, '生徒は設定を変えられない');
// いまが記録時間外になる設定
const d = new Date(Date.now() + 9 * 3600e3); const other = (d.getUTCDay() + 3) % 7;
await M({ action: 'setConfig', day: other, start: '00:00', end: '23:59', awaySec: 60 }, T);
const IMG = 'data:image/jpeg;base64,' + Buffer.from('fakejpeg').toString('base64');
r = await M({ action: 'shot', image: IMG, url: 'https://scratch.mit.edu/', title: 'Scratch' }, S);
ok(r.skipped === 'not-class-time', '教室の時間以外は保存しない');
await M({ action: 'setConfig', day: d.getUTCDay(), start: '00:00', end: '23:59', awaySec: 30 }, T);
r = await M({ action: 'shot', image: IMG, url: 'https://www.youtube.com/', title: 'YouTube' }, S);
ok(r.ok && shotCount() === 1, '教室の時間はスクショを保存する');
r = await M({ action: 'shot', image: IMG }, T);
ok(r.skipped === 'teacher', '先生のPCは記録しない');
r = await M({ action: 'shot', image: 'data:image/png;base64,AAAA' }, S);
ok(!r.ok, 'jpeg 以外は受け付けない');
const st = Date.now() - 90e3;
r = await M({ action: 'away', start: st, end: Date.now() - 30e3, pages: [{ at: st, url: 'https://www.youtube.com/', title: 'YouTube' }], open: true }, S);
r = await M({ action: 'away', start: st, end: Date.now(), pages: [{ at: st, url: 'https://www.youtube.com/', title: 'YouTube' }], open: false }, S);
ok(r.ok, '離れた記録を保存（同じ始まりなら上書き）');
r = await M({ action: 'days', id: 'kid1' }, T);
ok(r.ok && r.days.length === 1, '記録がある日を返す: ' + r.days);
r = await M({ action: 'list', id: 'kid1', date: r.days[0] }, T);
ok(r.ok && r.shots.length === 1 && r.shots[0].title === 'YouTube' && r.away.length === 1 && r.away[0].sec >= 89 && !r.away[0].open, '先生は記録を見られる（スクショ1枚・離れた記録1回）');
const key = r.shots[0].key;
r = await M({ action: 'img', key }, T);
ok(r.img, '先生は画像を見られる');
r = await M({ action: 'list', id: 'kid1', date: '2026-01-01' }, S);
ok(r.status === 403, '生徒は記録を見られない');
r = await M({ action: 'img', key: '../secret' }, T);
ok(r.status === 404, 'おかしな画像の名前は断る');
// 30日より古い記録は、日付一覧を開いたときに消える
sql.prepare("INSERT INTO shots (sid, date, t, url, title, img) VALUES ('kid1', '2020-01-01', '100000', '', '', x'00')").run();
r = await M({ action: 'days', id: 'kid1' }, T);
ok(!r.days.includes('2020-01-01') && shotCount() === 1, '30日より古いスクショは消す');
