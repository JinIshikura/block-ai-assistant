// 見守り（日曜の教室の時間だけ）：Scratchから離れた記録と、1分おきのスクショ
//  GET  /api/monitor?action=config   … いま記録する時間か（だれでも見られる。秘密は入っていない）
//  POST /api/monitor { action, ... } … 生徒：shot / away、先生：days / list / img / setConfig
//  保存：スクショと離れた記録は D1（バインド名 MON。カード登録なしで使える）、設定は KV（USERS）。30日で消す
import { getSession, getUser } from '../../lib/auth.js';

const KEEP_DAYS = 30;
const DEFAULT_CFG = { day: 0, start: '10:00', end: '12:00', awaySec: 60, enabled: true };
const DAY_JP = ['日', '月', '火', '水', '木', '金', '土'];

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
const fail = (m, s) => json({ ok: false, error: m }, s || 400);

// 日本の時刻
function jst(ms) {
  const d = new Date((ms || Date.now()) + 9 * 3600e3);
  const p = (n) => String(n).padStart(2, '0');
  return { day: d.getUTCDay(), date: d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()), hm: p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()), hms: p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) };
}
async function getCfg(env) {
  try { const raw = await env.USERS.get('cfg:monitor'); return Object.assign({}, DEFAULT_CFG, raw ? JSON.parse(raw) : {}); } catch (e) { return Object.assign({}, DEFAULT_CFG); }
}
function isActive(cfg, ms) {
  if (!cfg.enabled) return false;
  const t = jst(ms);
  return t.day === Number(cfg.day) && t.hm >= cfg.start && t.hm < cfg.end;
}
// D1 の表（なければ作る）
let ready = null;
function db(env) {
  if (!env.MON) return null;
  if (!ready) {
    ready = env.MON.batch([
      env.MON.prepare('CREATE TABLE IF NOT EXISTS shots (sid TEXT, date TEXT, t TEXT, url TEXT, title TEXT, img BLOB, PRIMARY KEY (sid, date, t))'),
      env.MON.prepare('CREATE TABLE IF NOT EXISTS away (sid TEXT, date TEXT, start INTEGER, data TEXT, PRIMARY KEY (sid, start))')
    ]).catch((e) => { ready = null; throw e; });
  }
  return ready.then(() => env.MON);
}
async function cleanup(D) {
  const old = jst(Date.now() - KEEP_DAYS * 86400e3).date;
  await D.batch([D.prepare('DELETE FROM shots WHERE date < ?').bind(old), D.prepare('DELETE FROM away WHERE date < ?').bind(old)]);
}
const validHm = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s));
const daysAgo = (date) => (Date.now() + 9 * 3600e3 - Date.parse(date + 'T00:00:00Z')) / 86400e3;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get('action') !== 'config') return fail('知らない操作です');
  if (!env.USERS) return json({ ok: true, active: false, reason: 'not-ready' });
  const cfg = await getCfg(env);
  return json({ ok: true, active: isActive(cfg), shots: !!env.MON, day: cfg.day, start: cfg.start, end: cfg.end, awaySec: cfg.awaySec, label: '毎週' + DAY_JP[cfg.day] + '曜 ' + cfg.start + '〜' + cfg.end });
}

export async function onRequestPost({ request, env }) {
  if (!env.USERS) return fail('まだ設定されていません', 503);
  const s = await getSession(env, request);
  if (!s) return fail('ログインしてね', 401);
  let b;
  try { b = await request.json(); } catch (e) { return fail('データの形がおかしいです'); }
  const cfg = await getCfg(env);

  // ---- 生徒のPC（拡張機能）から ----
  if (b.action === 'shot' || b.action === 'away') {
    if (s.role !== 'student') return json({ ok: true, skipped: 'teacher' });
    if (!(await getUser(env, s.id))) return fail('ログインしてね', 401);
    if (!isActive(cfg)) return json({ ok: true, skipped: 'not-class-time' });
    const t = jst();
    const D = await db(env);
    if (!D) return json({ ok: true, skipped: 'no-storage' });
    if (b.action === 'shot') {
      const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ''));
      if (!m) return fail('画像の形がおかしいです');
      if (m[1].length > 900000) return fail('画像が大きすぎます');
      const bin = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0));
      await D.prepare('INSERT OR REPLACE INTO shots (sid, date, t, url, title, img) VALUES (?, ?, ?, ?, ?, ?)').bind(s.id, t.date, t.hms, String(b.url || '').slice(0, 300), String(b.title || '').slice(0, 120), bin).run();
      return json({ ok: true });
    }
    // 離れた記録（同じ start なら上書き＝のびていく）
    const start = Number(b.start);
    const end = Number(b.end) || Date.now();
    if (!start || end < start || end - start > 6 * 3600e3) return fail('時刻がおかしいです');
    const pages = (Array.isArray(b.pages) ? b.pages : []).slice(0, 30).map((p) => ({ at: Number(p.at) || start, url: String(p.url || '').slice(0, 300), title: String(p.title || '').slice(0, 120) }));
    const ev = { start, end, sec: Math.round((end - start) / 1000), pages, open: !!b.open };
    await D.prepare('INSERT OR REPLACE INTO away (sid, date, start, data) VALUES (?, ?, ?, ?)').bind(s.id, jst(start).date, start, JSON.stringify(ev)).run();
    return json({ ok: true });
  }

  // ---- ここから先生だけ ----
  if (s.role !== 'teacher') return fail('先生だけが使えます', 403);
  if (b.action === 'getConfig') return json({ ok: true, config: cfg, active: isActive(cfg), shots: !!env.MON });
  if (b.action === 'setConfig') {
    const c = { day: Number(b.day), start: String(b.start || ''), end: String(b.end || ''), awaySec: Number(b.awaySec), enabled: b.enabled !== false };
    if (!(c.day >= 0 && c.day <= 6) || !validHm(c.start) || !validHm(c.end) || c.start >= c.end) return fail('曜日と時間を正しく入れてください（終わりは始まりより後）');
    if (!(c.awaySec >= 10 && c.awaySec <= 1800)) return fail('離れたと判定する時間は10〜1800秒にしてください');
    await env.USERS.put('cfg:monitor', JSON.stringify(c));
    return json({ ok: true, config: c, active: isActive(c) });
  }
  const id = String(b.id || '');
  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(id) && b.action !== 'img') return fail('生徒のIDがおかしいです');
  const D = await db(env);
  if (!D) return fail('記録の保存先（D1 の MON）がまだ設定されていません', 503);
  if (b.action === 'days') {
    // 記録がある日（新しい順）。ついでに30日より古い記録を消す
    await cleanup(D);
    const r = await D.prepare('SELECT date FROM shots WHERE sid = ? UNION SELECT date FROM away WHERE sid = ? ORDER BY date DESC').bind(id, id).all();
    return json({ ok: true, days: (r.results || []).map((x) => x.date) });
  }
  if (b.action === 'list') {
    const date = String(b.date || '');
    if (!/^\d{4}-\d\d-\d\d$/.test(date)) return fail('日付がおかしいです');
    const sh = await D.prepare('SELECT t, url, title FROM shots WHERE sid = ? AND date = ? ORDER BY t').bind(id, date).all();
    const aw = await D.prepare('SELECT data FROM away WHERE sid = ? AND date = ? ORDER BY start').bind(id, date).all();
    const shots = (sh.results || []).map((x) => ({ key: id + '/' + date + '/' + x.t, time: x.t.replace(/(\d\d)(\d\d)(\d\d)/, '$1:$2:$3'), url: x.url || '', title: x.title || '' }));
    return json({ ok: true, shots, away: (aw.results || []).map((x) => JSON.parse(x.data)) });
  }
  if (b.action === 'img') {
    const m = /^([a-z0-9][a-z0-9_-]{0,39})\/(\d{4}-\d\d-\d\d)\/(\d{6})$/.exec(String(b.key || ''));
    if (!m) return fail('画像が見つかりません', 404);
    const row = await D.prepare('SELECT img FROM shots WHERE sid = ? AND date = ? AND t = ?').bind(m[1], m[2], m[3]).first();
    if (!row || !row.img) return fail('画像が見つかりません', 404);
    return new Response(new Uint8Array(row.img), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, no-store' } });
  }
  return fail('知らない操作です');
}
