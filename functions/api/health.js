import { authReady } from '../../lib/auth.js';
// auth: ログインのしくみ（KV と先生のID・パスワード）が設定されているか
export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({ ok: true, ai: !!env.ANTHROPIC_API_KEY, auth: authReady(env) }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
