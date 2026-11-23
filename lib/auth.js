// ログインのしくみ（Cloudflare Pages Functions から使う）
//  - 先生：ID とパスワードは Cloudflare のシークレット TEACHER_ID / TEACHER_PASSWORD（サーバーだけが知る）
//  - 生徒：KV（バインド名 USERS）に保存。パスワードは PBKDF2 でハッシュにして保存する
//  - 初期パスワードは、生徒が自分のパスワードに変えるまでだけ、先生が見られるように残す
//  - ログインすると、ランダムな合言葉（トークン）を発行し、KV に12時間だけ保存する

export const SESSION_TTL = 12 * 60 * 60;
const ITER = 20000;
const LOCK_FAILS = 10;
const LOCK_TTL = 15 * 60;
export const SIM_ID = 'sim01';

export function authReady(env) {
  return !!(env && env.USERS && env.TEACHER_ID && env.TEACHER_PASSWORD);
}

export function sameText(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
function randomHex(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return hex(a); }

// まぎらわしい文字（0/o、1/l/i）を使わない初期パスワード
export function makePassword(len = 8) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return [...a].map((n) => chars[n % chars.length]).join('');
}

export async function hashPassword(pw, saltHex, iter = ITER) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pw)), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
  return hex(bits);
}

export const validId = (id) => /^[a-z0-9][a-z0-9_-]{2,19}$/.test(String(id || ''));
export const validPassword = (pw) => typeof pw === 'string' && pw.length >= 6 && pw.length <= 64 && !/\s/.test(pw);

export async function getUser(env, id) {
  const raw = await env.USERS.get('u:' + id);
  return raw ? JSON.parse(raw) : null;
}
export async function putUser(env, u) { await env.USERS.put('u:' + u.id, JSON.stringify(u)); }

export async function newStudent(env, id, name, password, sim) {
  const salt = randomHex(16);
  const pw = password || makePassword();
  const u = { id, name: String(name || id).slice(0, 30), salt, iter: ITER, hash: await hashPassword(pw, salt), init: pw, mustChange: true, sim: !!sim, created: Date.now() };
  await putUser(env, u);
  return u;
}

export async function setPassword(env, u, pw, isInitial) {
  u.salt = randomHex(16);
  u.iter = ITER;
  u.hash = await hashPassword(pw, u.salt);
  u.init = isInitial ? pw : null;
  u.mustChange = !!isInitial;
  await putUser(env, u);
}

export async function createSession(env, user) {
  const token = randomHex(32);
  await env.USERS.put('s:' + token, JSON.stringify(user), { expirationTtl: SESSION_TTL });
  return token;
}
// ポータルでログインしたことを、Scratchの中の画面にも伝えるためのクッキー
//  （Scratchの中の画面は保存領域がポータルと別になるため、クッキーで受けわたす）
export const COOKIE = 'bai_s';
export function sessionCookie(token) {
  return token
    ? `${COOKIE}=${token}; Path=/api/; Max-Age=${SESSION_TTL}; Secure; HttpOnly; SameSite=None`
    : `${COOKIE}=; Path=/api/; Max-Age=0; Secure; HttpOnly; SameSite=None`;
}
function cookieToken(request) {
  const c = request.headers.get('cookie') || '';
  const m = new RegExp('(?:^|;\\s*)' + COOKIE + '=([0-9a-f]{64})(?:;|$)').exec(c);
  return m ? m[1] : null;
}
export async function getSession(env, request) {
  if (!env || !env.USERS) return null;
  const h = request.headers.get('authorization') || '';
  const m = /^Bearer ([0-9a-f]{64})$/.exec(h);
  const token = m ? m[1] : cookieToken(request);
  if (!token) return null;
  const raw = await env.USERS.get('s:' + token);
  return raw ? Object.assign(JSON.parse(raw), { token, viaCookie: !m }) : null;
}

export async function tooManyFails(env, id) {
  const n = Number(await env.USERS.get('f:' + id)) || 0;
  return n >= LOCK_FAILS;
}
export async function addFail(env, id) {
  const n = (Number(await env.USERS.get('f:' + id)) || 0) + 1;
  await env.USERS.put('f:' + id, String(n), { expirationTtl: LOCK_TTL });
}
export async function clearFails(env, id) { await env.USERS.delete('f:' + id); }

export async function listStudents(env) {
  const out = [];
  let cursor;
  do {
    const r = await env.USERS.list({ prefix: 'u:', cursor });
    for (const k of r.keys) { const u = await getUser(env, k.name.slice(2)); if (u) out.push(u); }
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);
  return out.sort((a, b) => (a.sim === b.sim ? a.id.localeCompare(b.id) : a.sim ? 1 : -1));
}
