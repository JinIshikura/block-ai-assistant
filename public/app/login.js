/* 生徒のログイン（サーバーにログインのしくみが設定されているときだけ使う）
 *  - ログイン画面と、初めてのときのパスワード変更
 *  - 合言葉（トークン）はこのPCのこのブラウザに保存し、12時間で切れる
 *  - ポータル（/portal/）でログインしていれば、クッキーで受けとって自動でログインする
 *  - window.BlockAuth = { ready, enabled, token(), user(), logout(), require() }
 *  - window.BlockAuthOptions = { backLabel, onBack }：「もどる」ボタンの名前と動き（ポータル用）
 */
(function () {
  'use strict';
  const KEY = 'blockai:session';
  const HOST = window.BlockAIHost || { post() {} };
  const OPT = window.BlockAuthOptions || {};
  let enabled = false;
  let token = '';
  let user = null;
  let lastPw = '';
  try { token = localStorage.getItem(KEY) || ''; } catch (e) { token = ''; }

  const CSS = `
  .lg { position: fixed; inset: 0; z-index: 2147483646; background: #E9EDF2; display: flex; align-items: center; justify-content: center; padding: 20px;
        font: 15px/1.6 system-ui, -apple-system, "Hiragino Sans", "Yu Gothic UI", sans-serif; color: #1F2328; }
  .lg[hidden], .lg [hidden] { display: none !important; }
  .lg .box { width: 100%; max-width: 400px; background: #fff; border-radius: 16px; padding: 26px 28px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 8px 30px rgba(0,0,0,.12); }
  .lg h1 { margin: 0; font-size: 22px; color: #4B23A3; }
  .lg p { margin: 0; font-size: 14px; color: #555B63; }
  .lg label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #555B63; }
  .lg input { font: inherit; font-size: 17px; border: 1.5px solid #C5CCD6; border-radius: 10px; padding: 9px 12px; min-height: 46px; }
  .lg input:focus { outline: none; border-color: #7C4FD0; }
  .lg button { font: inherit; border-radius: 10px; min-height: 48px; cursor: pointer; }
  .lg .go { border: none; background: #7C4FD0; color: #fff; font-weight: 700; font-size: 16px; }
  .lg .sub { border: 1.5px solid #C5CCD6; background: #fff; color: #1F2328; }
  .lg .err { background: #FDE7DD; color: #9A330A; border-radius: 8px; padding: 8px 12px; font-size: 14px; }
  .lg .err:empty { display: none; }
  .lg label.show { flex-direction: row; align-items: center; gap: 8px; font-size: 13px; color: #555B63; cursor: pointer; }
  .lg label.show input { min-height: 0; width: 18px; height: 18px; padding: 0; }
  `;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
  const el = document.createElement('div');
  el.className = 'lg';
  el.hidden = true;
  el.innerHTML = `
    <form class="box f-login" autocomplete="off">
      <h1>ログイン</h1>
      <p>先生からもらったIDとパスワードを入れてね。</p>
      <label>ID<input name="uid" autocapitalize="off" spellcheck="false" inputmode="email"></label>
      <label>パスワード<input name="password" type="password"></label>
      <label class="show"><input type="checkbox" class="showpw"> パスワードを表示する</label>
      <div class="err"></div>
      <button class="go" type="submit">ログイン</button>
      <button class="sub back" type="button"></button>
    </form>
    <form class="box f-change" hidden>
      <h1>自分のパスワードを決めよう</h1>
      <p>はじめてのログインです。先生からもらったパスワードを、自分だけのパスワードに変えてね（6文字以上、スペースなし）。名前や誕生日など、わかりやすいものはさけよう。</p>
      <label class="oldw">いまのパスワード（先生からもらったもの）<input name="old" type="password"></label>
      <label>新しいパスワード<input name="password" type="password"></label>
      <label>もう一度（確認）<input name="again" type="password"></label>
      <div class="err"></div>
      <button class="go" type="submit">これにする</button>
    </form>`;
  (document.body || document.documentElement).appendChild(el);
  const fLogin = el.querySelector('.f-login');
  const fChange = el.querySelector('.f-change');
  fLogin.querySelector('.back').textContent = OPT.backLabel || 'Scratchにもどる';
  // Scratch のショートカットにキーを伝えない
  ['keydown', 'keyup', 'keypress'].forEach((t) => el.addEventListener(t, (e) => e.stopPropagation()));

  function save() { try { if (token) localStorage.setItem(KEY, token); else localStorage.removeItem(KEY); } catch (e) { /* noop */ } }
  function notify() { try { window.dispatchEvent(new CustomEvent('blockai-auth', { detail: { user } })); } catch (e) { /* noop */ } }
  async function api(body, cookieOnly) {
    const useToken = token && !cookieOnly;
    const r = await fetch('/api/auth', { method: 'POST', credentials: 'same-origin', headers: Object.assign({ 'content-type': 'application/json' }, useToken ? { authorization: 'Bearer ' + token } : {}), body: JSON.stringify(body) });
    let d = {};
    try { d = await r.json(); } catch (e) { d = { ok: false, error: 'サーバーの返事が読めませんでした' }; }
    d.status = r.status;
    return d;
  }
  function showLogin(text) {
    el.hidden = false;
    fChange.hidden = true;
    fLogin.hidden = false;
    fLogin.querySelector('.err').textContent = text || '';
    setTimeout(() => fLogin.elements.uid.focus(), 30);
  }
  function showChange() {
    el.hidden = false;
    fLogin.hidden = true;
    fChange.hidden = false;
    fChange.querySelector('.oldw').hidden = !!lastPw;
    fChange.querySelector('.err').textContent = '';
    setTimeout(() => (lastPw ? fChange.elements.password : fChange.elements.old).focus(), 30);
  }
  function done() { el.hidden = true; lastPw = ''; notify(); }

  fLogin.querySelector('.showpw').addEventListener('change', (e) => { fLogin.elements.password.type = e.target.checked ? 'text' : 'password'; });
  fLogin.querySelector('.back').addEventListener('click', () => {
    if (typeof OPT.onBack === 'function') { el.hidden = true; OPT.onBack(); } else HOST.post({ kind: 'close' });
  });
  fLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = fLogin.querySelector('.go');
    btn.disabled = true;
    let d;
    try { d = await api({ action: 'login', id: fLogin.elements.uid.value, password: fLogin.elements.password.value }); } catch (err) { d = { ok: false, error: 'サーバーにつながりませんでした。インターネットを確かめてね。' }; }
    btn.disabled = false;
    if (!d.ok) { fLogin.querySelector('.err').textContent = d.error || 'ログインできませんでした'; return; }
    token = d.token; user = d.user; save();
    lastPw = fLogin.elements.password.value;
    fLogin.elements.password.value = '';
    if (d.mustChange) showChange(); else done();
  });
  fChange.addEventListener('submit', async (e) => {
    e.preventDefault();
    const er = fChange.querySelector('.err');
    if (fChange.elements.password.value !== fChange.elements.again.value) { er.textContent = '確認のパスワードが、ちがっているよ'; return; }
    const d = await api({ action: 'password', old: lastPw || fChange.elements.old.value, password: fChange.elements.password.value });
    if (!d.ok) { er.textContent = d.error || '変えられませんでした'; if (d.status === 401 && !lastPw) fChange.elements.old.value = ''; return; }
    fChange.reset();
    done();
  });

  async function logout() {
    if (token) { try { await api({ action: 'logout' }); } catch (e) { /* noop */ } }
    token = ''; user = null; save(); notify();
    if (enabled) showLogin('ログアウトしました。');
  }
  function require(text) { if (!enabled) return; token = ''; user = null; save(); notify(); showLogin(text || 'ログインが切れました。もう一度ログインしてね。'); }

  const ready = (async () => {
    let h = {};
    try { h = await fetch('/api/health', { cache: 'no-store' }).then((r) => r.json()); } catch (e) { h = {}; }
    enabled = !!h.auth;
    if (!enabled) return;
    // ポータルでいちばん最近ログインした人（クッキー）を優先する
    const c = await api({ action: 'me' }, true).catch(() => ({ ok: false }));
    if (c.ok && c.token) { token = c.token; user = c.user; save(); notify(); if (c.mustChange) showChange(); return; }
    if (token) {
      const d = await api({ action: 'me' }).catch(() => ({ ok: false }));
      if (d.ok) { user = d.user; notify(); if (d.mustChange) showChange(); return; }
      token = ''; save();
    }
    showLogin('');
  })();

  window.BlockAuth = {
    ready,
    get enabled() { return enabled; },
    token: () => token,
    user: () => user,
    logout,
    require
  };
})();
