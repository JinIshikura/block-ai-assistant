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
  if (msg.method === 'runTest') result = { samples: [0, 100, 200, 300, 400].map((t) => ({ t, sprites: { リンゴ: { y: 170 - t / 2, say: '' }, ネコ: { x: t / 4, y: -140, say: '' } }, vars: { 得点: 0 } })) };
  setTimeout(() => send({ kind: 'rpc-result', id: msg.id, result }), 2);
};
w.fetch = async (url) => {
  const f = url.replace(/^\//, '').split('?')[0];
  const data = fs.readFileSync(R + decodeURIComponent(f));
  return new Response(data, { status: 200 });
};
for (const f of ['shim.js', 'login.js', 'codeconv.js', 'editorassist.js', 'blockview.js', 'learn.js', 'app.js']) w.eval(fs.readFileSync(R + 'app/' + f, 'utf8'));
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
  ok(q('.slide h1').textContent.length > 0 && (q('.slide .bv-row .bv-blk') || q('.slide pre.code')), 'スライドに、ブロックとコードの対応表が出る');
  ok(q('.slide .bv-words') && /move/.test(q('.slide .bv-words').textContent) && /動く/.test(q('.slide .bv-words').textContent), 'スライドに、新しく出てきた英語の意味が出る（move＝動く）');
  for (let i = 0; i < 10 && q('.slide .nx').textContent !== '演習へ'; i++) { q('.slide .nx').click(); await wait(20); }
  ok(q('.slide .nx').textContent === '演習へ', '最後のスライドで「演習へ」');
  q('.slide .nx').click(); await wait(100);
  // えらぶ問題（1問）
  ok(!q('.qz').classList.contains('hidden') && qa('.qchoices .qch').length === 4 && q('.qch .bv-blk'), 'えらぶ問題が出る（選択肢はブロック）');
  qa('.qchoices .qch')[1].click(); await wait(20);
  ok(q('.qfb').classList.contains('ng') && q('.qnext').classList.contains('hidden'), 'まちがえると理由が出て、先へは進めない');
  qa('.qchoices .qch')[0].click(); await wait(20);
  ok(q('.qfb').classList.contains('ok') && !q('.qnext').classList.contains('hidden'), '正解すると「次へ」が出る');
  q('.qnext').click(); await wait(400);
  ok(qa('.uses .ui').length >= 2 && q('.uses .bv-blk') && /move/.test(q('.uses').textContent), '左に「この課題で使うコード」がブロックつきで出る');
  const lp = sent.find((m) => m.method === 'loadProject');
  ok(lp && lp.params.sb3 && lp.params.sb3.byteLength > 1000, '演習を開くと、課題の作品（sb3）を読みこませる');
  ok(sent.filter((m) => m.method === 'replaceScripts').length >= 1, '最初のコードを作品に入れる');
  ok(/move\(10\)/.test(q('textarea.code').value), 'コード欄に最初のコード');
  ok(!q('.ai .open').classList.contains('hidden') === false, 'AIははじめは使えない');
  // 1回目：そのまま判定 → 不合格
  q('.jbtn').click(); await wait(400);
  ok(qa('.results .res.ng').length >= 1 && /move/.test(q('.results').textContent), 'そのままだと不合格で、直す場所のヒントが出る');
  // 2回目も不合格 → AIが使える
  q('.jbtn').click(); await wait(400);
  ok(!q('.ai .open').classList.contains('hidden'), '2回うまくいかないとAIに聞ける');
  // 正しく直して判定 → クリア
  const ta = q('textarea.code'); ta.value = ta.value.replace('move(10)', 'move(100)'); ta.dispatchEvent(new w.Event('input'));
  q('.jbtn').click(); await wait(400);
  ok(!q('.over.clear').classList.contains('hidden'), '直して判定するとクリア');
  { const bad = [...root.querySelectorAll('button')].filter((b) => !b.classList.contains('qch') && !b.classList.contains('pill') && !b.classList.contains('askok') && /答え/.test(b.textContent)).map((b) => b.className + ':' + b.textContent); ok(bad.length === 0, '「答えを見る」はない ' + bad.join(',')); }
  q('.clear .next').click(); await wait(400);
  ok(/反対向きに動かそう/.test(q('.ex-title').textContent), '次の演習へ進む');
  // ヒント
  q('.hintb').click(); q('.hintb').click(); await wait(20);
  ok(qa('.hint').length === 2, 'ヒントを順に表示');
  // ブロックで確かめる
  q('.eb.peek').click(); await wait(100);
  ok(sent.some((m) => m.kind === 'peek'), '「ブロックで確かめる」でScratchの画面を見せる');
  // 順番に解放（生徒のとき）
  { const A = w.BlockAuth; const u0 = A.user; A.user = () => ({ role: 'student', id: 'sim01' });
    q('.go-home').click(); await wait(50);
    const cards = qa('.home .lesson');
    ok(!cards[0].classList.contains('locked') && cards[1].classList.contains('locked') && cards[1].querySelector('.pill').disabled, '生徒は、前のレッスンをクリアするまで次のレッスンが開かない');
    ok(qa('.home .lesson.dojo').length >= 3 && /道場/.test(qa('.home .lesson.dojo')[0].textContent), '道場は色と札で区別される');
    A.user = u0; q('.go-home').click(); await wait(50);
    ok(!qa('.home .lesson')[1].classList.contains('locked'), '先生・ログインなしでは全部開いている');
  }
  // やめる
  q('.quit').click(); q('.confirm .yes').click(); await wait(30);
  ok(sent.some((m) => m.kind === 'closeTab'), '「学習をやめる」でタブを閉じる合図');
  process.exit();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
