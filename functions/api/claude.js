// ブロックAIアシスタント - AIの中継（Cloudflare Pages Functions）
// APIキーはCloudflareのシークレット ANTHROPIC_API_KEY にだけ保存する。
// 使えるのは、ログインした人（生徒・先生）か、教室コード（シークレット CLASS_CODE）を知っているPCだけ。
import { getSession, getUser } from '../../lib/auth.js';
const ALLOWED_MODELS = ['claude-sonnet-5-5', 'claude-haiku-5-5'];
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_TOKENS = 16000;
const MAX_BODY = 3 * 1024 * 1024;

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
function err(message, status) { return json({ type: 'error', error: { type: 'proxy_error', message } }, status); }

// 文字列をくらべる（かかる時間で中身がわからないように）
function sameText(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

export async function onRequestPost({ request, env }) {
  const self = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  if (origin && origin !== self) return err('このサーバーのページからだけ使えます', 403);
  if (!env.ANTHROPIC_API_KEY) return err('NO_SERVER_KEY', 503);
  let allowed = false;
  const sess = await getSession(env, request);
  if (sess) allowed = sess.role === 'teacher' || !!(await getUser(env, sess.id));
  if (!allowed && env.CLASS_CODE) allowed = sameText(request.headers.get('x-class-code') || '', env.CLASS_CODE);
  if (!allowed) return err(request.headers.get('authorization') ? 'LOGIN_EXPIRED' : '教室コードがちがいます', 401);

  const size = Number(request.headers.get('content-length') || 0);
  if (size > MAX_BODY) return err('送るデータが大きすぎます', 413);
  let body;
  try { body = await request.json(); } catch (e) { return err('データの形がおかしいです', 400); }
  if (!body || typeof body !== 'object' || !Array.isArray(body.messages)) return err('データの形がおかしいです', 400);

  body.model = ALLOWED_MODELS.includes(body.model) ? body.model : DEFAULT_MODEL;
  body.max_tokens = Math.max(1, Math.min(Number(body.max_tokens) || 1024, MAX_TOKENS));

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body)
  });
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' }
  });
}

export async function onRequest() {
  return err('POSTで送ってください', 405);
}
