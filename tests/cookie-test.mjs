// ポータルのログインをScratchの中の画面に受けわたすクッキーのテスト：node tests/cookie-test.mjs
import { onRequestPost as auth } from '/home/claude/block-ai-assistant/functions/api/auth.js';
const ok = (c, l) => { console.log((c ? 'OK  ' : 'NG  ') + l); if (!c) process.exitCode = 1; };
const store = new Map();
const USERS = {
  async get(k) { return store.has(k) ? store.get(k) : null; },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list({ prefix }) { return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
};
const env = { USERS, TEACHER_ID: 'teacher', TEACHER_PASSWORD: 'secret-pass' };
const call = async (body, { token, cookie, origin } = {}) => {
  const h = { 'content-type': 'application/json' };
  if (token) h.authorization = 'Bearer ' + token;
  if (cookie) h.cookie = cookie;
  if (origin) h.origin = origin;
  const r = await auth({ request: new Request('https://x.pages.dev/api/auth', { method: 'POST', headers: h, body: JSON.stringify(body) }), env });
  return Object.assign(await r.json(), { status: r.status, setCookie: r.headers.get('set-cookie') || '' });
};
let r = await call({ action: 'login', id: 'teacher', password: 'secret-pass' });
const T = r.token;
r = await call({ action: 'create', students: [{ id: 'goro01', name: 'ごろう', password: 'pass1234' }, { id: 'reji', name: 'レジ', password: 'pass1234' }] }, { token: T });
r = await call({ action: 'login', id: 'goro01', password: 'pass1234' });
ok(/^bai_s=[0-9a-f]{64}; Path=\/api\/;.*Secure; HttpOnly; SameSite=None/.test(r.setCookie), 'ログインするとクッキーを渡す（HttpOnly・Secure）');
const G = r.token;
r = await call({ action: 'me' }, { cookie: 'x=1; bai_s=' + G });
ok(r.ok && r.user.id === 'goro01' && r.token === G, 'クッキーだけで「だれか」がわかり、合言葉も受けとれる');
r = await call({ action: 'me' }, { token: G });
ok(r.ok && !r.token, '合言葉で聞いたときは、合言葉を返さない');
r = await call({ action: 'me' }, { cookie: 'bai_s=' + G, origin: 'https://evil.example' });
ok(r.status === 403, 'ほかのサイトからはクッキーがあっても使えない');
r = await call({ action: 'login', id: 'reji', password: 'pass1234' });
const R = r.token;
r = await call({ action: 'me' }, { cookie: 'bai_s=' + R });
ok(r.user.id === 'reji', 'あとからログインした人に切りかわる');
r = await call({ action: 'logout' }, { cookie: 'bai_s=' + R });
ok(r.ok && /Max-Age=0/.test(r.setCookie), 'ログアウトでクッキーを消す');
r = await call({ action: 'me' }, { cookie: 'bai_s=' + R });
ok(r.status === 401, 'ログアウトしたクッキーは使えない');
r = await call({ action: 'logout' }, { cookie: 'bai_s=' + 'f'.repeat(64) });
ok(/Max-Age=0/.test(r.setCookie), '切れたクッキーでログアウトしても、クッキーを消す');
