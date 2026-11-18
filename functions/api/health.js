export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({ ok: true, ai: !!(env.ANTHROPIC_API_KEY && env.CLASS_CODE) }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
