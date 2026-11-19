// ログイン・生徒の管理（POST /api/auth に { action, ... } を送る）
import {
  authReady, sameText, validId, validPassword, getUser, putUser, newStudent, setPassword,
  createSession, getSession, tooManyFails, addFail, clearFails, listStudents, makePassword, hashPassword, SIM_ID
} from '../../lib/auth.js';

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
const fail = (message, status) => json({ ok: false, error: message }, status || 400);
const pub = (u) => ({ id: u.id, name: u.name, init: u.mustChange ? u.init : null, changed: !u.mustChange, sim: !!u.sim, created: u.created });

export async function onRequestPost({ request, env }) {
  const self = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  if (origin && origin !== self) return fail('このサーバーのページからだけ使えます', 403);
  if (!authReady(env)) return fail('ログインのしくみがまだ設定されていません（先生に連絡してね）', 503);
  let b;
  try { b = await request.json(); } catch (e) { return fail('データの形がおかしいです'); }
  const action = b && b.action;
  const teacherId = String(env.TEACHER_ID).trim().toLowerCase();

  if (action === 'login') {
    const id = String(b.id || '').trim().toLowerCase();
    const pw = String(b.password || '');
    if (!id || !pw) return fail('IDとパスワードを入れてね');
    if (await tooManyFails(env, id)) return fail('まちがいが多いので、15分ほど待ってからためしてね', 429);
    if (id === teacherId) {
      if (!sameText(pw, env.TEACHER_PASSWORD)) { await addFail(env, id); return fail('IDかパスワードがちがいます', 401); }
      await clearFails(env, id);
      const user = { id, role: 'teacher', name: '先生' };
      return json({ ok: true, token: await createSession(env, user), user });
    }
    const u = validId(id) ? await getUser(env, id) : null;
    if (!u) { await addFail(env, id); return fail('IDかパスワードがちがいます', 401); }
    const h = await hashPassword(pw, u.salt, u.iter);
    if (!sameText(h, u.hash)) { await addFail(env, id); return fail('IDかパスワードがちがいます', 401); }
    await clearFails(env, id);
    const user = { id: u.id, role: 'student', name: u.name, sim: !!u.sim };
    return json({ ok: true, token: await createSession(env, user), user, mustChange: !!u.mustChange });
  }

  const s = await getSession(env, request);
  if (!s) return fail('ログインしてね', 401);

  if (action === 'me') {
    const user = { id: s.id, role: s.role, name: s.name, sim: !!s.sim };
    let mustChange = false;
    if (s.role === 'student') { const u = await getUser(env, s.id); if (!u) return fail('ログインしてね', 401); mustChange = !!u.mustChange; }
    return json({ ok: true, user, mustChange });
  }
  if (action === 'logout') {
    await env.USERS.delete('s:' + s.token);
    return json({ ok: true });
  }
  if (action === 'password') {
    if (s.role !== 'student') return fail('先生のパスワードは、Cloudflareの設定（TEACHER_PASSWORD）で変えてください');
    const u = await getUser(env, s.id);
    if (!u) return fail('ログインしてね', 401);
    if (!sameText(await hashPassword(String(b.old || ''), u.salt, u.iter), u.hash)) return fail('いまのパスワードがちがいます', 401);
    if (!validPassword(b.password)) return fail('新しいパスワードは、スペースなしの6文字以上にしてね');
    if (b.password === b.old) return fail('いまとちがうパスワードにしてね');
    await setPassword(env, u, b.password, false);
    return json({ ok: true });
  }

  // ここから先生だけ
  if (s.role !== 'teacher') return fail('先生だけが使えます', 403);
  if (action === 'list') {
    let list = await listStudents(env);
    if (!list.some((u) => u.id === SIM_ID)) { list.push(await newStudent(env, SIM_ID, 'シミュレーション用', null, true)); }
    return json({ ok: true, students: list.map(pub) });
  }
  if (action === 'create') {
    const rows = Array.isArray(b.students) ? b.students : [b];
    if (rows.length > 100) return fail('一度に作れるのは100人までです');
    const made = [];
    const errors = [];
    for (const r of rows) {
      const id = String(r.id || '').trim().toLowerCase();
      if (!validId(id)) { errors.push(id + '：IDは半角の英小文字・数字・ - _ で3〜20文字（はじめは英数字）'); continue; }
      if (id === teacherId) { errors.push(id + '：先生のIDと同じにはできません'); continue; }
      if (await getUser(env, id)) { errors.push(id + '：もうあります'); continue; }
      const pw = r.password ? String(r.password) : '';
      if (pw && !validPassword(pw)) { errors.push(id + '：初期パスワードはスペースなしの6文字以上'); continue; }
      made.push(pub(await newStudent(env, id, r.name || id, pw || null, false)));
    }
    return json({ ok: errors.length === 0, students: made, errors });
  }
  if (action === 'reset') {
    const u = await getUser(env, String(b.id || ''));
    if (!u) return fail('その生徒はいません', 404);
    const pw = b.password ? String(b.password) : makePassword();
    if (!validPassword(pw)) return fail('初期パスワードはスペースなしの6文字以上');
    await setPassword(env, u, pw, true);
    await clearFails(env, u.id);
    return json({ ok: true, student: pub(u) });
  }
  if (action === 'rename') {
    const u = await getUser(env, String(b.id || ''));
    if (!u) return fail('その生徒はいません', 404);
    u.name = String(b.name || u.id).slice(0, 30);
    await putUser(env, u);
    return json({ ok: true, student: pub(u) });
  }
  if (action === 'delete') {
    const id = String(b.id || '');
    if (!(await getUser(env, id))) return fail('その生徒はいません', 404);
    await env.USERS.delete('u:' + id);
    return json({ ok: true });
  }
  return fail('知らない操作です');
}

export async function onRequest() {
  return fail('POSTで送ってください', 405);
}
