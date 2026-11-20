const fs = require('fs');
const { JSDOM } = require('jsdom');
const R = '/home/claude/block-ai-assistant/public/app/';
const C = require(R + 'codeconv.js');
const parentDom = new JSDOM('<!doctype html><body></body>', { url: 'https://scratch.mit.edu/projects/9/editor' });
const P = parentDom.window;
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://block-ai-assistant.pages.dev/app/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
Object.defineProperty(w, 'parent', { get: () => P });
const toParent = [];
let scripts = C.parse('@when_flag_clicked\ndef main():\n    move(10)', 'py').scripts.map((s, i) => ({ topId: 'top' + i, x: 0, y: 0, blocks: s.blocks }));
const send = (data) => w.dispatchEvent(new w.MessageEvent('message', { data, origin: 'https://scratch.mit.edu', source: P }));
P.postMessage = (msg, origin) => {
  toParent.push({ msg, origin });
  if (msg.kind !== 'rpc') return;
  let result = { ok: true };
  if (msg.method === 'getScripts') result = { sprite: 'ネコ', scripts, functions: {}, targetId: 's1', sprites: [{ id: 'st', name: 'Stage' }, { id: 's1', name: 'ネコ' }] };
  if (msg.method === 'stageFrame') result = { url: 'data:image/jpeg;base64,AA', running: false, question: null };
  if (msg.method === 'readMemoList') result = { exists: false, items: [] };
  if (msg.method === 'snapshot') result = { token: 't1' };
  setTimeout(() => send({ kind: 'rpc-result', id: msg.id, result }), 2);
};
// AIの中継（/api/claude）のまね：SSEで返す
const fetchCalls = [];
w.fetch = async (url, opt) => {
  fetchCalls.push({ url, opt });
  if (opt.headers['x-class-code'] !== 'abc') return new Response(JSON.stringify({ error: { message: 'x' } }), { status: 401 });
  const ev = [
    { type: 'message_start', message: { usage: { input_tokens: 5 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'こんにちは！' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 3 } }
  ].map((e) => 'event: x\ndata: ' + JSON.stringify(e) + '\n\n').join('');
  return new Response(ev, { status: 200, headers: { 'content-type': 'text/event-stream' } });
};
w.localStorage.setItem('blockai:timeLimitOn', 'false');
w.localStorage.setItem('blockai:level', '1');
w.localStorage.setItem('blockai:codeLang', '"py"');
for (const f of ['shim.js', 'login.js', 'codeconv.js', 'editorassist.js', 'blockview.js', 'app.js']) w.eval(fs.readFileSync(R + f, 'utf8'));
const root = w.document.getElementById('block-ai-assistant-root').shadowRoot;
const q = (s) => root.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (c, l) => { console.log((c ? 'OK  ' : 'NG  ') + l); if (!c) process.exitCode = 1; };
(async () => {
  await wait(50);
  ok(toParent.some((t) => t.msg.kind === 'ready' && t.origin === 'https://scratch.mit.edu'), '読みこんだら ready を送る（相手はscratchだけ）');
  ok(q('.panel').classList.contains('hidden'), '開く合図の前は隠れている');
  // ちがう送り元の合図は無視
  w.dispatchEvent(new w.MessageEvent('message', { data: { kind: 'open', view: 'code', path: '/projects/9/editor' }, origin: 'https://evil.example', source: P }));
  await wait(50);
  ok(q('.panel').classList.contains('hidden'), 'ちがうサイトからの合図は無視');
  send({ kind: 'open', view: 'code', path: '/projects/9/editor' });
  await wait(400);
  ok(!q('.panel').classList.contains('hidden'), '開く合図で全画面が出る');
  ok(/move\(10\)/.test(q('textarea.code').value), 'スクリプトをコードで表示: ' + q('textarea.code').value.split('\n').filter((l) => l.includes('move'))[0]);
  // 教室コードなし → 設定の案内
  q('.inrow textarea').value = 'こんにちは';
  q('.send').click();
  await wait(300);
  ok(/教室コード/.test(q('.msgs').textContent), '教室コードがないと案内が出る');
  // 教室コードあり → AIの返事が出る
  w.chrome.storage.local.set({ classCode: 'abc' });
  q('.inrow textarea').value = 'こんにちは';
  q('.send').click();
  await wait(500);
  const last = fetchCalls[fetchCalls.length - 1];
  ok(last && last.url === '/api/claude' && last.opt.headers['x-class-code'] === 'abc', '同じサーバーの /api/claude に教室コード付きで送る');
  ok(!/x-api-key/i.test(JSON.stringify(last.opt.headers)) && !/sk-ant/.test(last.opt.body), 'APIキーは送らない');
  ok(/こんにちは！/.test(q('.msgs').textContent), 'AIの返事が表示される');
  // 閉じる
  q('.close').click();
  await wait(30);
  ok(toParent.some((t) => t.msg.kind === 'close'), '閉じると close を送る');
  // 作品ごとの会話の保存キー
  ok(Object.keys(w.localStorage).some((k) => k === 'blockai:chat:9'), '会話はScratchの作品IDごとに保存: ' + Object.keys(w.localStorage).filter((k) => k.includes('chat')).join(','));
  process.exit();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
