const fs = require('fs');
const { JSDOM } = require('jsdom');
const R = '/home/claude/block-ai-assistant/public/';
const P = new JSDOM('<!doctype html><body></body>', { url: 'https://scratch.mit.edu/projects/77/editor' }).window;
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://block-ai-assistant.pages.dev/app/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
Object.defineProperty(w, 'parent', { get: () => P });
const sent = [];
const send = (data) => w.dispatchEvent(new w.MessageEvent('message', { data, origin: 'https://scratch.mit.edu', source: P }));
P.postMessage = (msg) => {
  sent.push(msg);
  if (msg.kind !== 'rpc') return;
  let result = { ok: true };
  if (msg.method === 'getScripts') result = { sprite: msg.params.sprite, scripts: [{ topId: 'old1' }], functions: {} };
  if (msg.method === 'stageFrame') result = { url: 'data:image/jpeg;base64,AA', running: false };
  if (msg.method === 'loadProject') result = { ok: true, sprites: ['リンゴ', 'ネコ'], gotBuffer: msg.params.sb3 instanceof w.ArrayBuffer || (msg.params.sb3 && msg.params.sb3.byteLength > 0) };
  if (msg.method === 'runTest') result = { samples: [0, 100, 200, 300, 400].map((t) => ({ t, sprites: { リンゴ: { y: 170 - t / 2, say: '' }, ネコ: { y: -140, say: '' } }, vars: { 得点: 0 } })) };
  setTimeout(() => send({ kind: 'rpc-result', id: msg.id, result }), 2);
};
w.fetch = async (url) => {
  const f = url.replace(/^\//, '').split('?')[0];
  const data = fs.readFileSync(R + decodeURIComponent(f));
  return new Response(data, { status: 200 });
};
for (const f of ['shim.js', 'codeconv.js', 'editorassist.js', 'learn.js', 'app.js']) w.eval(fs.readFileSync(R + 'app/' + f, 'utf8'));
const root = w.document.getElementById('blockai-learn').shadowRoot;
const q = (s) => root.querySelector(s);
const qa = (s) => [...root.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (c, l) => { console.log((c ? 'OK  ' : 'NG  ') + l); if (!c) process.exitCode = 1; };
(async () => {
  send({ kind: 'open', view: 'learn', path: '/projects/77/editor' });
  await wait(300);
  ok(!q('.root').classList.contains('hidden'), '学習モードの画面が開く');
  const normal = w.document.getElementById('block-ai-assistant-root').shadowRoot.querySelector('.panel');
  ok(normal.classList.contains('hidden'), '普段の画面は出ない');
  const pills = qa('.home .pill').map((b) => b.textContent);
  const C2 = JSON.parse(fs.readFileSync('/home/claude/block-ai-assistant/public/learn/course.json', 'utf8')); const want = C2.steps.reduce((n, st) => n + st.lessons.reduce((m, l) => m + 1 + l.exercises.length, 0), 0);
  ok(pills.length === want && /スライド/.test(pills[0]), '一覧に回と演習が並ぶ（すべて開いている）: ' + pills.length);
  qa('.home .pill.slides')[0].click(); await wait(50);
  ok(/ブロックは、コードでも書ける/.test(q('.slide h1').textContent) && q('.slide pre.code .k-ev'), 'スライドが色つきコードで表示される');
  for (let i = 0; i < 4; i++) { q('.slide .nx').click(); await wait(20); }
  ok(q('.slide .nx').textContent === '演習へ', '最後のスライドで「演習へ」');
  q('.slide .nx').click(); await wait(400);
  const lp = sent.find((m) => m.method === 'loadProject');
  ok(lp && lp.params.sb3 && lp.params.sb3.byteLength > 1000, '演習を開くと、課題の作品（sb3）を読みこませる');
  ok(sent.filter((m) => m.method === 'replaceScripts').length === 2, '最初のコードをリンゴとネコに入れる');
  ok(/change_y\(-5\)/.test(q('textarea.code').value), 'コード欄に最初のコード');
  ok(!q('.ai .open').classList.contains('hidden') === false, 'AIははじめは使えない');
  // 1回目：そのまま判定 → 不合格
  q('.jbtn').click(); await wait(400);
  ok(qa('.results .res.ng').length >= 1 && /change_y/.test(q('.results').textContent), 'そのままだと不合格で、直す場所のヒントが出る');
  // 2回目も不合格 → AIが使える
  q('.jbtn').click(); await wait(400);
  ok(!q('.ai .open').classList.contains('hidden'), '2回うまくいかないとAIに聞ける');
  // 正しく直して判定 → クリア
  const ta = q('textarea.code'); ta.value = ta.value.replace('change_y(-5)', 'change_y(-10)'); ta.dispatchEvent(new w.Event('input'));
  q('.jbtn').click(); await wait(400);
  ok(!q('.over.clear').classList.contains('hidden'), '直して判定するとクリア');
  ok(![...root.querySelectorAll('button')].some((b) => /答え/.test(b.textContent) && !b.classList.contains('askok')), '「答えを見る」はない');
  q('.clear .next').click(); await wait(400);
  ok(/得点が2ずつ/.test(q('.ex-title').textContent), '次の演習へ進む');
  // ヒント
  q('.hintb').click(); q('.hintb').click(); await wait(20);
  ok(qa('.hint').length === 2, 'ヒントを順に表示');
  // ブロックで確かめる
  q('.eb.peek').click(); await wait(100);
  ok(sent.some((m) => m.kind === 'peek'), '「ブロックで確かめる」でScratchの画面を見せる');
  // やめる
  q('.quit').click(); q('.confirm .yes').click(); await wait(30);
  ok(sent.some((m) => m.kind === 'closeTab'), '「学習をやめる」でタブを閉じる合図');
  process.exit();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
