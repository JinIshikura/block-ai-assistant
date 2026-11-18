// ブロックAIアシスタント - つなぎ役（拡張機能） v0.12
// ・Scratchの上のバーにボタンを出す（ボタンの名前や場所はサーバーの config.json で変えられる）
// ・サーバーの画面を、Scratchのページの上に全画面の枠として重ねる
// ・枠（サーバーの画面）からの頼みを、Scratchの中（page-bridge.js）に取りつぐ
// 画面や機能の更新はサーバー側で行うので、この拡張機能はほとんど変えなくてよい。
(function () {
  'use strict';
  if (window.__blockAiShell) return;
  window.__blockAiShell = true;

  const APP_ORIGIN = 'https://block-ai-assistant.pages.dev';
  const APP_URL = APP_ORIGIN + '/app/';
  const CS = 'block-ai-cs';
  const PAGE = 'block-ai-page';
  const EXT_VERSION = (() => { try { return chrome.runtime.getManifest().version; } catch (e) { return ''; } })();

  // サーバーに届かないときに使う、いつもの設定
  const FALLBACK = {
    menu: {
      bar: '[class*="menu-bar_main-menu"]',
      item: '[class*="menu-bar_menu-bar-item"]',
      hide: ['チュートリアル', 'Tutorials', 'Debug', 'デバッグ', 'でばっぐ', 'ちゅーとりある'],
      buttons: [{ label: 'AIに聞く', view: 'ai' }, { label: 'コードで見る', view: 'code' }]
    },
    editorReady: '.blocklyWorkspace',
    learn: { baseProject: null, label: '学習', tabButtons: [{ label: '学習の画面', view: 'learn' }] }
  };
  // 学習用のタブ（先生の土台作品を開いたタブ）かどうか
  const LEARN_TAB = /(^|[#&])blockai=learn\b/.test(location.hash);
  let config = FALLBACK;
  fetch(APP_ORIGIN + '/config.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((c) => { if (c && c.menu && Array.isArray(c.menu.buttons)) { config = Object.assign({}, FALLBACK, c); removeButtons(); } })
    .catch(() => { /* いつもの設定のまま */ });

  // ---------------------------------------------------------------
  // 上のバーのボタン
  // ---------------------------------------------------------------
  const BTN_CSS = 'margin:0 4px;height:32px;padding:0 10px;border:none;border-radius:8px;background:#fff;color:#5A2FB0;font-weight:700;font-size:13px;cursor:pointer;align-self:center;font-family:inherit;white-space:nowrap;flex-shrink:0;';
  function removeButtons() { document.querySelectorAll('.block-ai-menu-btn').forEach((b) => b.remove()); }
  function decorateMenu() {
    const m = config.menu || FALLBACK.menu;
    let bar = null;
    try { bar = document.querySelector(m.bar); } catch (e) { bar = null; }
    if (!bar) return;
    try {
      bar.querySelectorAll(m.item).forEach((el) => {
        if (el.dataset.blockAiHidden) return;
        if ((m.hide || []).includes((el.textContent || '').trim())) { el.style.display = 'none'; el.dataset.blockAiHidden = '1'; }
      });
    } catch (e) { /* noop */ }
    if (bar.querySelector('.block-ai-menu-btn')) return;
    const learn = Object.assign({}, FALLBACK.learn, config.learn || {});
    let defs = LEARN_TAB ? (learn.tabButtons || []) : (m.buttons || []).slice();
    if (!LEARN_TAB && /^\d+$/.test(String(learn.baseProject || ''))) defs.push({ label: learn.label || '学習', openLearn: true });
    defs.forEach((def) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'block-ai-menu-btn';
      b.textContent = String(def.label || 'AI');
      b.style.cssText = BTN_CSS;
      b.addEventListener('click', () => (def.openLearn ? openLearnTab() : openApp(String(def.view || 'ai'))));
      bar.appendChild(b);
    });
  }

  // ---------------------------------------------------------------
  // サーバーの画面（全画面の枠）
  // ---------------------------------------------------------------
  let frame = null;
  let frameReady = false;
  let isOpen = false;
  let queued = [];
  let loadTimer = null;

  function makeFrame() {
    frame = document.createElement('iframe');
    frame.src = APP_URL;
    frame.title = 'ブロックAIアシスタント';
    frame.allow = 'microphone; clipboard-read; clipboard-write; autoplay';
    frame.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483000;background:transparent;display:none;color-scheme:light;';
    document.documentElement.appendChild(frame);
    loadTimer = setTimeout(() => { if (!frameReady) showOffline(); }, 15000);
  }

  function toFrame(msg) {
    if (!frame || !frame.contentWindow) return;
    if (!frameReady) { queued.push(msg); return; }
    frame.contentWindow.postMessage(msg, APP_ORIGIN);
  }

  function hostInfo() {
    return { path: location.pathname, href: location.href, ext: EXT_VERSION };
  }

  function openApp(view) {
    if (!frame) makeFrame();
    hideOffline();
    frame.style.display = 'block';
    isOpen = true;
    toFrame(Object.assign({ kind: 'open', view }, hostInfo()));
    setTimeout(() => { try { frame.focus(); } catch (e) { /* noop */ } }, 50);
  }

  // 学習は、先生の土台作品を別のタブで開いて行う（子どもの作品には何も読みこまない）
  function openLearnTab() {
    const learn = Object.assign({}, FALLBACK.learn, config.learn || {});
    const id = String(learn.baseProject || '');
    if (!/^\d+$/.test(id)) return;
    window.open('https://scratch.mit.edu/projects/' + id + '/editor#blockai=learn', 'blockai-learn');
  }

  // 「ブロックで確かめる」：枠をいったん隠して、Scratchの画面を見せる
  let peekBar = null;
  function peek() {
    if (frame) frame.style.display = 'none';
    if (!peekBar) {
      peekBar = document.createElement('button');
      peekBar.type = 'button';
      peekBar.textContent = '見るだけです　［学習の画面にもどる］';
      peekBar.style.cssText = 'position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:2147483001;border:none;border-radius:999px;padding:12px 22px;background:#855CD6;color:#fff;font-weight:700;font-size:15px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);font-family:inherit;';
      peekBar.addEventListener('click', () => { peekBar.remove(); if (frame) frame.style.display = 'block'; toFrame({ kind: 'peek-end' }); });
    }
    document.documentElement.appendChild(peekBar);
  }

  function closeApp() {
    if (frame) frame.style.display = 'none';
    isOpen = false;
    hideOffline();
  }

  // サーバーにつながらないときの知らせ
  let offline = null;
  function showOffline() {
    if (!isOpen) return;
    if (frame) frame.style.display = 'none';
    if (!offline) {
      offline = document.createElement('div');
      offline.style.cssText = 'position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;';
      const box = document.createElement('div');
      box.style.cssText = 'background:#fff;border-radius:14px;padding:24px 28px;max-width:420px;text-align:center;line-height:1.7;color:#1f2328;';
      box.innerHTML = '<div style="font-size:18px;font-weight:700;margin-bottom:8px">AIアシスタントのサーバーにつながりません</div><div style="font-size:14px">インターネットにつながっているか確かめて、もう一度ためしてね。</div>';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '閉じる';
      btn.style.cssText = 'margin-top:14px;border:none;border-radius:8px;padding:10px 18px;background:#855CD6;color:#fff;font-weight:700;cursor:pointer;';
      btn.addEventListener('click', () => { closeApp(); if (frame) { frame.remove(); frame = null; frameReady = false; queued = []; } });
      box.appendChild(btn);
      offline.appendChild(box);
    }
    document.documentElement.appendChild(offline);
  }
  function hideOffline() { if (offline && offline.parentNode) offline.remove(); }

  // ---------------------------------------------------------------
  // 取りつぎ
  // ---------------------------------------------------------------
  const fromFrame = {}; // page-bridge に頼んだ id → true

  window.addEventListener('message', (ev) => {
    // サーバーの画面から（送り主と送り元を両方たしかめる）
    if (frame && ev.source === frame.contentWindow) {
      if (ev.origin !== APP_ORIGIN) return;
      const d = ev.data;
      if (!d || typeof d !== 'object') return;
      if (d.kind === 'ready') {
        frameReady = true;
        clearTimeout(loadTimer);
        frame.contentWindow.postMessage(Object.assign({ kind: 'init' }, hostInfo()), APP_ORIGIN);
        queued.splice(0).forEach((m) => frame.contentWindow.postMessage(m, APP_ORIGIN));
      } else if (d.kind === 'rpc' && typeof d.id === 'string' && typeof d.method === 'string') {
        const id = 'f_' + d.id;
        fromFrame[id] = d.id;
        window.postMessage({ source: CS, id, method: d.method, params: d.params || {} }, location.origin);
      } else if (d.kind === 'close') {
        closeApp();
      } else if (d.kind === 'peek') {
        peek();
      } else if (d.kind === 'closeTab') {
        closeApp();
        if (LEARN_TAB) { try { window.close(); } catch (e) { /* noop */ } }
      }
      return;
    }
    // Scratchの中（page-bridge.js）から
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.source !== PAGE) return;
    if (d.id && fromFrame[d.id] !== undefined) {
      const orig = fromFrame[d.id];
      delete fromFrame[d.id];
      toFrame({ kind: 'rpc-result', id: orig, result: d.result, error: d.error });
    } else if (d.event) {
      if (d.event === 'askBlock') openApp('ai');
      toFrame({ kind: 'event', source: PAGE, event: d.event, data: d.data });
    }
  });

  // 作品のページが変わったら知らせる（新しく保存してIDが付いたときなど）
  let lastPath = location.pathname;
  setInterval(() => {
    decorateMenu();
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      toFrame(Object.assign({ kind: 'path' }, hostInfo()));
    }
  }, 700);
  decorateMenu();

  // 学習用のタブでは、Scratchの準備ができたら学習の画面を開く
  if (LEARN_TAB) {
    const waitReady = setInterval(() => {
      let ready = false;
      try { ready = !!document.querySelector(config.editorReady || FALLBACK.editorReady); } catch (e) { ready = false; }
      if (ready) { clearInterval(waitReady); setTimeout(() => openApp('learn'), 800); }
    }, 500);
  }
})();
