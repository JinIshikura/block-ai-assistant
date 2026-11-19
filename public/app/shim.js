// ブロックAIアシスタント（サーバー版）
// 拡張機能だったころの chrome.storage / chrome.runtime の代わりをする。
// ・設定や会話はこのPCのブラウザ（localStorage）に保存
// ・AIとの通信は同じサーバーの /api/claude を通す（APIキーはサーバーだけが持つ）
// ・Scratchのページ（拡張機能）とは postMessage でやり取りする
(function () {
  'use strict';

  const HOST_ORIGIN = 'https://scratch.mit.edu';
  const PREFIX = 'blockai:';
  const DEFAULT_MODEL = 'claude-sonnet-5-5';

  // ---------------------------------------------------------------
  // 保存（chrome.storage.local の代わり）
  // ---------------------------------------------------------------
  const changeListeners = [];
  function allKeys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
    }
    return out;
  }
  function readKeys(keys) {
    const out = {};
    let list;
    let defaults = null;
    if (keys == null) list = allKeys();
    else if (typeof keys === 'string') list = [keys];
    else if (Array.isArray(keys)) list = keys;
    else { defaults = keys; list = Object.keys(keys); }
    list.forEach((k) => {
      const raw = localStorage.getItem(PREFIX + k);
      if (raw != null) {
        try { out[k] = JSON.parse(raw); } catch (e) { /* 壊れた値は無視 */ }
      } else if (defaults && k in defaults) {
        out[k] = defaults[k];
      }
    });
    return out;
  }
  function fire(changes) {
    changeListeners.forEach((fn) => { try { fn(changes, 'local'); } catch (e) { /* noop */ } });
  }
  const storage = {
    get(keys, cb) {
      const out = readKeys(keys);
      if (typeof cb === 'function') setTimeout(() => cb(out), 0);
      return Promise.resolve(out);
    },
    set(obj, cb) {
      const changes = {};
      Object.keys(obj || {}).forEach((k) => {
        try {
          localStorage.setItem(PREFIX + k, JSON.stringify(obj[k]));
          changes[k] = { newValue: obj[k] };
        } catch (e) {
          // 容量オーバー：古い会話を消してから、もう一度だけ試す
          dropOldChats();
          try { localStorage.setItem(PREFIX + k, JSON.stringify(obj[k])); changes[k] = { newValue: obj[k] }; } catch (e2) { /* あきらめる */ }
        }
      });
      fire(changes);
      if (typeof cb === 'function') setTimeout(cb, 0);
      return Promise.resolve();
    },
    remove(keys, cb) {
      const list = typeof keys === 'string' ? [keys] : (keys || []);
      const changes = {};
      list.forEach((k) => { localStorage.removeItem(PREFIX + k); changes[k] = { newValue: undefined }; });
      fire(changes);
      if (typeof cb === 'function') setTimeout(cb, 0);
      return Promise.resolve();
    }
  };
  function dropOldChats() {
    const chats = allKeys().filter((k) => k.startsWith('chat:'));
    chats.slice(0, Math.ceil(chats.length / 2)).forEach((k) => localStorage.removeItem(PREFIX + k));
  }
  // 設定画面（同じサーバーの別の枠）で変えたときも知らせる
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith(PREFIX)) fire({ [e.key.slice(PREFIX.length)]: { newValue: undefined } });
  });

  // ---------------------------------------------------------------
  // AIとの通信（サーバーの /api/claude を通す）
  // ---------------------------------------------------------------
  async function withEffort(req) {
    const { noEffort, effort } = await storage.get(['noEffort', 'effort']);
    if (noEffort || req.output_config) return req;
    return Object.assign({}, req, { output_config: { effort: effort || 'medium' } });
  }
  function effortRejected(msg) { return /output_config|effort/i.test(String(msg || '')); }

  async function post(req) {
    const { classCode } = await storage.get('classCode');
    const A = window.BlockAuth;
    const headers = { 'content-type': 'application/json', 'x-class-code': classCode || '' };
    if (A && A.token()) headers.authorization = 'Bearer ' + A.token();
    return fetch('/api/claude', {
      method: 'POST',
      headers,
      body: JSON.stringify(req)
    });
  }

  function serverError(status, m) {
    if (status === 401) {
      const A = window.BlockAuth;
      if (A && A.enabled) { A.require(); return new Error('ログインが切れました。もう一度ログインしてね。'); }
      return new Error('NO_KEY');
    }
    if (status === 503) return new Error('サーバーにAIのキーが登録されていません（先生へ：Cloudflareの設定を確認してください）');
    if (status === 429) return new Error('いまAIが混み合っています。少し待ってからためしてね。');
    return new Error(m || ('HTTP ' + status));
  }

  async function callClaude(body, retried) {
    const { model } = await storage.get('model');
    const req = await withEffort(Object.assign({}, body, { model: model || DEFAULT_MODEL }));
    const res = await post(req);
    let data = null;
    try { data = await res.json(); } catch (e) { /* noop */ }
    if (!res.ok) {
      const m = data && data.error && data.error.message;
      if (res.status === 400 && req.output_config && !retried && effortRejected(m)) {
        await storage.set({ noEffort: true });
        return callClaude(body, true);
      }
      throw serverError(res.status, m);
    }
    recordUsage(data.usage);
    return data;
  }

  async function streamClaude(body, onText, retried) {
    const { model } = await storage.get('model');
    const req = await withEffort(Object.assign({}, body, { model: model || DEFAULT_MODEL, stream: true }));
    const res = await post(req);
    if (!res.ok || !res.body) {
      let data = null;
      try { data = await res.json(); } catch (e) { /* noop */ }
      const m = data && data.error && data.error.message;
      if (res.status === 400 && req.output_config && !retried && effortRejected(m)) {
        await storage.set({ noEffort: true });
        return streamClaude(body, onText, true);
      }
      throw serverError(res.status, m);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const blocks = [];
    const jsonParts = {};
    let stopReason = null;
    const usage = {};
    const handle = (ev) => {
      if (ev.type === 'message_start' && ev.message && ev.message.usage) Object.assign(usage, ev.message.usage);
      else if (ev.type === 'content_block_start') {
        blocks[ev.index] = Object.assign({}, ev.content_block);
        if (blocks[ev.index].type === 'text') blocks[ev.index].text = blocks[ev.index].text || '';
        if (blocks[ev.index].type === 'tool_use') jsonParts[ev.index] = '';
        if (blocks[ev.index].type === 'thinking') { blocks[ev.index].thinking = blocks[ev.index].thinking || ''; blocks[ev.index].signature = blocks[ev.index].signature || ''; }
      } else if (ev.type === 'content_block_delta') {
        const b = blocks[ev.index];
        if (!b) return;
        if (ev.delta.type === 'text_delta') { b.text += ev.delta.text; onText(ev.delta.text); }
        else if (ev.delta.type === 'input_json_delta') jsonParts[ev.index] += ev.delta.partial_json || '';
        else if (ev.delta.type === 'thinking_delta') b.thinking = (b.thinking || '') + (ev.delta.thinking || '');
        else if (ev.delta.type === 'signature_delta') b.signature = (b.signature || '') + (ev.delta.signature || '');
      } else if (ev.type === 'content_block_stop') {
        const b = blocks[ev.index];
        if (b && b.type === 'tool_use') {
          try { b.input = jsonParts[ev.index] ? JSON.parse(jsonParts[ev.index]) : {}; } catch (e) { b.input = {}; }
        }
      } else if (ev.type === 'message_delta') {
        if (ev.delta && ev.delta.stop_reason) stopReason = ev.delta.stop_reason;
        if (ev.usage) Object.assign(usage, ev.usage);
      } else if (ev.type === 'error') {
        throw new Error((ev.error && ev.error.message) || 'AIの返事でエラーが出ました');
      }
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const json = line.slice(5).trim();
        if (!json || json === '[DONE]') continue;
        let ev;
        try { ev = JSON.parse(json); } catch (e) { continue; }
        handle(ev);
      }
    }
    recordUsage(usage);
    return { content: blocks.filter(Boolean), stop_reason: stopReason, usage };
  }

  // ---------------------------------------------------------------
  // 使った量の記録（日ごと）
  // ---------------------------------------------------------------
  function dayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  let usageChain = Promise.resolve();
  function bumpUsage(delta) {
    usageChain = usageChain.then(async () => {
      const { usageDays = {} } = await storage.get('usageDays');
      const k = dayKey();
      const day = usageDays[k] || { q: 0, req: 0, in: 0, out: 0, cw: 0, cr: 0 };
      for (const key in delta) day[key] = (day[key] || 0) + (delta[key] || 0);
      usageDays[k] = day;
      Object.keys(usageDays).sort().slice(0, -90).forEach((x) => delete usageDays[x]);
      await storage.set({ usageDays });
    }).catch(() => {});
    return usageChain;
  }
  function recordUsage(u) {
    if (!u) return;
    bumpUsage({ req: 1, in: u.input_tokens || 0, out: u.output_tokens || 0, cw: u.cache_creation_input_tokens || 0, cr: u.cache_read_input_tokens || 0 });
  }

  // ---------------------------------------------------------------
  // 会話の記録（Googleスプレッドシート）
  // ---------------------------------------------------------------
  const MAX_QUEUE = 300;
  let flushing = false;
  async function queueLog(row) {
    const { logQueue = [] } = await storage.get('logQueue');
    logQueue.push(row);
    while (logQueue.length > MAX_QUEUE) logQueue.shift();
    await storage.set({ logQueue });
    await flushLogs();
  }
  async function flushLogs() {
    if (flushing) return;
    flushing = true;
    try {
      const { logQueue = [], logOn, logUrl, logToken } = await storage.get(['logQueue', 'logOn', 'logUrl', 'logToken']);
      if (!logOn || !logUrl || !logQueue.length) return;
      const batch = logQueue.slice(0, 50);
      await postRows(batch, logUrl, logToken);
      const { logQueue: now = [] } = await storage.get('logQueue');
      await storage.set({ logQueue: now.slice(batch.length) });
    } catch (e) {
      // 送れなかった：次の機会に送り直す
    } finally {
      flushing = false;
    }
  }
  async function postRows(rows, url, token) {
    if (!/^https:\/\/script\.google\.com\//.test(url || '')) throw new Error('URLが Apps Script のものではありません');
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: token || '', rows }) });
    const text = (await res.text()).trim();
    if (!res.ok) throw new Error('HTTP ' + res.status);
    if (text !== 'OK') throw new Error(text === 'NG' ? '合言葉がちがいます' : '返事がおかしいです：' + text.slice(0, 80));
  }

  // ---------------------------------------------------------------
  // 先生用の設定（同じ枠の中に重ねて開く）
  // ---------------------------------------------------------------
  function openOptions() {
    if (window.top !== window && window.parent !== window && window.name === 'blockai-options') return;
    if (document.getElementById('blockai-options')) return;
    const wrap = document.createElement('div');
    wrap.id = 'blockai-options';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;';
    const box = document.createElement('div');
    box.style.cssText = 'width:min(920px,96vw);height:min(92vh,960px);background:#fff;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;';
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#855CD6;color:#fff;font-weight:700;';
    bar.textContent = '先生用の設定';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '閉じる';
    close.style.cssText = 'border:none;border-radius:8px;padding:8px 14px;background:#fff;color:#4b23a3;font-weight:700;cursor:pointer;';
    close.addEventListener('click', () => wrap.remove());
    bar.appendChild(close);
    const fr = document.createElement('iframe');
    fr.name = 'blockai-options';
    fr.src = 'options.html';
    fr.style.cssText = 'flex:1;border:0;width:100%;';
    box.appendChild(bar);
    box.appendChild(fr);
    wrap.appendChild(box);
    document.body.appendChild(wrap);
  }

  // ---------------------------------------------------------------
  // chrome.runtime の代わり
  // ---------------------------------------------------------------
  async function handleMessage(msg) {
    if (!msg || typeof msg !== 'object') return { ok: false };
    if (msg.type === 'claude') {
      try { return { ok: true, data: await callClaude(msg.body) }; } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
    }
    if (msg.type === 'countQuestion') { await bumpUsage({ q: 1 }); return { ok: true }; }
    if (msg.type === 'log') { try { await queueLog(msg.row); return { ok: true }; } catch (e) { return { ok: false }; } }
    if (msg.type === 'logTest') {
      try {
        await postRows([{ time: new Date().toISOString(), type: 'test', pc: msg.pc || '', project: '', level: '', mode: '', student: 'テスト送信', ai: '設定画面からのテストです', tools: '', errors: '' }], msg.url, msg.token);
        return { ok: true };
      } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
    }
    if (msg.type === 'openOptions') {
      try { (window.parent && window.parent.BlockAIOpenOptions || openOptions)(); } catch (e) { openOptions(); }
      return { ok: true };
    }
    return { ok: false };
  }

  function makePort() {
    const msgL = [];
    const discL = [];
    let closed = false;
    const emit = (m) => { if (!closed) msgL.forEach((fn) => { try { fn(m); } catch (e) { /* noop */ } }); };
    return {
      onMessage: { addListener: (fn) => msgL.push(fn) },
      onDisconnect: { addListener: (fn) => discL.push(fn) },
      postMessage(msg) {
        streamClaude(msg.body, (text) => emit({ t: 'text', text }))
          .then((message) => emit({ t: 'done', message }))
          .catch((e) => emit({ t: 'error', error: String((e && e.message) || e) }));
      },
      disconnect() { closed = true; }
    };
  }

  const runtime = {
    id: 'web',
    lastError: undefined,
    sendMessage(msg, cb) {
      handleMessage(msg).then((r) => { if (typeof cb === 'function') cb(r); });
    },
    connect() { return makePort(); },
    openOptionsPage() { openOptions(); }
  };

  const shim = { storage: { local: storage, onChanged: { addListener: (fn) => changeListeners.push(fn) } }, runtime };
  try { window.chrome = shim; } catch (e) { /* noop */ }
  if (window.chrome !== shim) {
    try { Object.defineProperty(window, 'chrome', { value: shim, configurable: true, writable: true }); } catch (e) { /* noop */ }
  }
  window.BlockAIOpenOptions = openOptions;

  // ---------------------------------------------------------------
  // Scratchのページ（拡張機能）とのやり取り
  // ---------------------------------------------------------------
  const info = { path: '/', href: '', ext: '', caps: null };
  const hostListeners = [];
  window.addEventListener('message', (ev) => {
    if (ev.source !== window.parent || ev.origin !== HOST_ORIGIN) return;
    const d = ev.data;
    if (!d || typeof d !== 'object') return;
    if (d.kind === 'init' || d.kind === 'open' || d.kind === 'path') {
      if (d.path) info.path = d.path;
      if (d.href) info.href = d.href;
      if (d.ext) info.ext = d.ext;
      if (d.caps) info.caps = d.caps;
    }
    hostListeners.forEach((fn) => { try { fn(d); } catch (e) { /* noop */ } });
  });
  window.BlockAIHost = {
    origin: HOST_ORIGIN,
    info,
    embedded: window.parent !== window,
    post(msg) { if (window.parent !== window) window.parent.postMessage(msg, HOST_ORIGIN); },
    on(fn) { hostListeners.push(fn); }
  };
})();
