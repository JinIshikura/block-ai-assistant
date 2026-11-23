// ポータル（/portal/）のテスト：node tests/portal-test.js
const fs = require('fs');
const { JSDOM } = require('jsdom');
const ok = (c, l) => { console.log((c ? 'OK  ' : 'NG  ') + l); if (!c) process.exitCode = 1; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const html = fs.readFileSync('public/portal/index.html', 'utf8');
const login = fs.readFileSync('public/app/login.js', 'utf8');

async function open(fetchImpl, stored) {
  const dom = new JSDOM(html.replace('<script src="/app/login.js"></script>', '<script>' + login + '</script>'), {
    url: 'https://block-ai-assistant.pages.dev/portal/', runScripts: 'dangerously',
    beforeParse(w) { w.fetch = fetchImpl; if (stored) w.localStorage.setItem('blockai:session', stored); w.HTMLElement.prototype.scrollIntoView = () => {}; }
  });
  await wait(50);
  return dom.window;
}
const res = (o, s) => ({ status: s || 200, json: async () => o });
const T = 'a'.repeat(64);

(async () => {
  // 名前のあてはめ
  let w = await open(async () => res({ ok: true, auth: false }));
  const f = (id, name) => { const r = w.findSheet({ id, name }); return r ? r[0] : null; };
  ok(f('goro01', '') === 'ゴロー', 'ID goro01 → ゴロー');
  ok(f('k01', 'ごろう') === 'ゴロー', '名前 ごろう → ゴロー');
  ok(f('k02', 'みどり') === 'みどりー', '名前 みどり → みどりー');
  ok(f('raito', '') === 'ライトー' && f('k03', 'ライト') === 'ライトー', 'raito・ライト → ライトー');
  ok(f('vin', '') === 'Vin' && f('k04', 'ビン') === null, 'vin → Vin');
  ok(f('reji2', '') === 'レジー' && f('k05', 'レジくん') === 'レジー', 'reji2・レジくん → レジー');
  ok(f('iyogun', '') === 'いよぐん' && f('kochi', '') === 'こちー' && f('akki', '') === 'あっきー', 'いよぐん・こちー・あっきー');
  ok(f('sim01', 'シミュレーション用') === null, '合わない人は記録表なし');
  w.LINKS.k09 = 'ゼンー';
  ok(f('k09', 'だれか') === 'ゼンー', 'LINKS で直接むすびつけられる');
  ok(!w.document.getElementById('records').hidden && w.document.getElementById('loginBtn').hidden, 'ログインのしくみがないときは、今まで通り名前の一覧');

  // ログインしてくると自分の記録表
  const calls = [];
  w = await open(async (url, opt) => {
    const b = opt && opt.body ? JSON.parse(opt.body) : {};
    calls.push({ url, b, auth: opt && opt.headers && opt.headers.authorization, cred: opt && opt.credentials });
    if (url === '/api/health') return res({ ok: true, auth: true });
    if (b.action === 'login') return res({ ok: true, token: T, user: { id: 'goro01', role: 'student', name: 'ごろう' }, mustChange: false });
    if (b.action === 'logout') return res({ ok: true });
    return res({ ok: false }, 401);
  });
  const d = w.document;
  const lg = d.querySelector('.lg');
  ok(!lg.hidden, 'ポータルを開くとログイン画面が出る');
  ok(d.querySelector('.lg .back').textContent === 'ログインしないで使う', '下のボタンは「ログインしないで使う」');
  const fL = lg.querySelector('.f-login');
  fL.elements.uid.value = 'goro01'; fL.elements.password.value = 'pass1234';
  fL.dispatchEvent(new w.Event('submit', { cancelable: true })); await wait(30);
  ok(lg.hidden && d.getElementById('who').textContent === 'ごろう さん', 'ログインすると名前が出る');
  ok(d.getElementById('recTitle').textContent === 'ゴローの記録表' && /1wRVnMi2SpdT6JHJxYSy_8m83pxfwV4KqC4SNIFvWWo0/.test(d.getElementById('recBtn').href) && d.getElementById('records').hidden, '記録表のボタンが自分の表になる');
  ok(calls.every((c) => c.url === '/api/health' || c.cred === 'same-origin'), 'クッキーをいっしょに送る');
  d.getElementById('logoutBtn').click(); await wait(30);
  ok(!lg.hidden && d.getElementById('recTitle').textContent === 'スコア記録表', 'ログアウトで元にもどり、ログイン画面が出る');
  d.querySelector('.lg .back').click(); await wait(10);
  ok(lg.hidden && !d.getElementById('records').hidden && !d.getElementById('loginBtn').hidden, 'ログインしないで使うと、名前の一覧とログインボタン');

  // Scratchの中の画面：クッキーのログインを優先する
  const dom2 = new JSDOM('<!doctype html><body></body>', { url: 'https://block-ai-assistant.pages.dev/app/', runScripts: 'outside-only' });
  const w2 = dom2.window;
  w2.localStorage.setItem('blockai:session', 'b'.repeat(64));
  const seen = [];
  w2.fetch = async (url, opt) => {
    const b = opt && opt.body ? JSON.parse(opt.body) : {};
    seen.push(opt && opt.headers && opt.headers.authorization);
    if (url === '/api/health') return res({ ok: true, auth: true });
    if (b.action === 'me' && !(opt.headers.authorization)) return res({ ok: true, token: T, user: { id: 'reji', role: 'student', name: 'レジ' } });
    return res({ ok: false }, 401);
  };
  w2.eval(login);
  await w2.BlockAuth.ready;
  ok(w2.BlockAuth.user().id === 'reji' && w2.localStorage.getItem('blockai:session') === T && w2.document.querySelector('.lg').hidden, 'Scratchの中の画面は、ポータルでログインした人で自動ログイン（前の人の合言葉より優先）');
  process.exit();
})();
