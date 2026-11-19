// ログインのしくみのテスト：node tests/auth-test.mjs
import { onRequestPost as auth } from '/home/claude/block-ai-assistant/functions/api/auth.js';
import { onRequestPost as claude } from '/home/claude/block-ai-assistant/functions/api/claude.js';
const ok = (c, l) => { console.log((c ? 'OK  ' : 'NG  ') + l); if (!c) process.exitCode = 1; };
// KV のまね
const store = new Map();
const USERS = {
  async get(k) { return store.has(k) ? store.get(k) : null; },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list({ prefix }) { return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
};
const env = { USERS, TEACHER_ID: 'teacher', TEACHER_PASSWORD: 'secret-pass', ANTHROPIC_API_KEY: 'sk-test' };
const call = async (body, token) => {
  const r = await auth({ request: new Request('https://x.pages.dev/api/auth', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}), body: JSON.stringify(body) }), env });
  return Object.assign(await r.json(), { status: r.status });
};
let r = await call({ action: 'login', id: 'teacher', password: 'wrong' });
ok(r.status === 401, '先生のパスワードがちがうと入れない');
r = await call({ action: 'login', id: 'Teacher', password: 'secret-pass' });
ok(r.ok && r.user.role === 'teacher' && /^[0-9a-f]{64}$/.test(r.token), '先生がログインできる（IDの大文字小文字は気にしない）');
const T = r.token;
r = await call({ action: 'list' }, T);
const sim = r.students.find((s) => s.id === 'sim01');
ok(r.ok && sim && sim.sim && /^[a-z2-9]{8}$/.test(sim.init), 'シミュレーション用の生徒が自動で作られ、初期パスワードが見える');
r = await call({ action: 'create', students: [{ id: 'kids01', name: 'テスト1' }, { id: 'kids02', name: 'テスト2', password: 'hello12' }, { id: 'AB', name: 'x' }, { id: 'teacher' }] }, T);
ok(r.students.length === 2 && r.errors.length === 2, 'まとめて作成：正しいものだけ作り、だめなものは理由を返す: ' + r.errors.join(' / '));
const k1 = r.students[0];
r = await call({ action: 'list' }, T);
ok(!JSON.stringify(r).includes('"hash"') && !JSON.stringify(r).includes('salt'), '一覧にパスワードのハッシュは出さない');
r = await call({ action: 'login', id: 'kids01', password: k1.init });
ok(r.ok && r.user.role === 'student' && r.mustChange, '生徒が初期パスワードでログインでき、変更をうながされる');
const S = r.token;
r = await call({ action: 'list' }, S);
ok(r.status === 403, '生徒は一覧を見られない');
r = await call({ action: 'password', old: k1.init, password: 'abc' }, S);
ok(!r.ok, '短いパスワードには変えられない');
r = await call({ action: 'password', old: k1.init, password: 'mypass99' }, S);
ok(r.ok, '自分のパスワードに変えられる');
r = await call({ action: 'list' }, T);
const k1b = r.students.find((s) => s.id === 'kids01');
ok(k1b.changed && k1b.init === null, '変えたあとは、先生にも初期パスワードは見えない');
r = await call({ action: 'login', id: 'kids01', password: 'mypass99' });
ok(r.ok && !r.mustChange, '新しいパスワードでログインできる');
for (let i = 0; i < 10; i++) await call({ action: 'login', id: 'kids02', password: 'bad' });
r = await call({ action: 'login', id: 'kids02', password: 'hello12' });
ok(r.status === 429, '10回まちがえると、しばらくロック');
r = await call({ action: 'reset', id: 'kids02' }, T);
ok(r.ok && r.student.init && !r.student.changed, '先生が初期パスワードを再発行できる（ロックも解除）');
r = await call({ action: 'login', id: 'kids02', password: r.student.init });
ok(r.ok, '再発行したパスワードで入れる');
// AIの中継
globalThis.fetch = async () => new Response('{}', { status: 200 });
const creq = (h) => new Request('https://x.pages.dev/api/claude', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, h), body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }) });
let c = await claude({ request: creq({ authorization: 'Bearer ' + S }), env });
ok(c.status === 200, 'ログインした生徒はAIを使える');
c = await claude({ request: creq({}), env });
ok(c.status === 401, 'ログインしていないと使えない（教室コードもなし）');
r = await call({ action: 'delete', id: 'kids01' }, T);
c = await claude({ request: creq({ authorization: 'Bearer ' + S }), env });
ok(c.status === 401, '削除された生徒は、ログイン中でも使えなくなる');
r = await call({ action: 'logout' }, T);
r = await call({ action: 'list' }, T);
ok(r.status === 401, 'ログアウトすると、その合言葉は使えない');
