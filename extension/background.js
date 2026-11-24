/* 見守り（日曜の教室の時間だけ）
 *  - 1分おきに、Chromeでいま見えているタブを撮ってサーバーに送る
 *  - Scratch から離れて別のページを見ていたら、その時間と見ていたページを記録する
 *  - 記録する時間かどうかはサーバーが決める（先生の管理画面で設定）。生徒としてログインしていないときは何もしない
 *  - 記録中はツールバーのアイコンに「REC」を出す
 */
const APP = 'https://block-ai-assistant.pages.dev';
const SCRATCH = /^https:\/\/scratch\.mit\.edu\//;

let cfg = null;
let cfgAt = 0;
async function getCfg() {
  if (cfg && Date.now() - cfgAt < 3 * 60e3) return cfg;
  try { cfg = await fetch(APP + '/api/monitor?action=config', { cache: 'no-store' }).then((r) => r.json()); cfgAt = Date.now(); } catch (e) { cfg = null; }
  return cfg;
}
async function token() { const { mtoken } = await chrome.storage.local.get('mtoken'); return mtoken || ''; }
async function post(body) {
  const t = await token();
  const r = await fetch(APP + '/api/monitor', {
    method: 'POST', credentials: 'include',
    headers: Object.assign({ 'content-type': 'application/json' }, t ? { authorization: 'Bearer ' + t } : {}),
    body: JSON.stringify(body)
  });
  return r.json().catch(() => ({}));
}
async function setBadge(on) {
  try {
    await chrome.action.setBadgeText({ text: on ? 'REC' : '' });
    if (on) await chrome.action.setBadgeBackgroundColor({ color: '#E5484D' });
    await chrome.action.setTitle({ title: on ? 'ブロックAIアシスタント：教室の時間なので、画面を記録しています' : 'ブロックAIアシスタント' });
  } catch (e) { /* noop */ }
}
async function isOn() {
  const c = await getCfg();
  return !!(c && c.active);
}

// ---- スクショ ----
async function shot() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || tab.windowId === undefined) return;
  let url;
  try { url = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 60 }); } catch (e) { return; } // chrome:// などは撮れない
  try {
    // 小さくして送る（横 960px）
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const w = Math.min(960, bmp.width);
    const h = Math.round(bmp.height * w / bmp.width);
    const cv = new OffscreenCanvas(w, h);
    cv.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const small = await cv.convertToBlob({ type: 'image/jpeg', quality: 0.55 });
    const buf = new Uint8Array(await small.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    url = 'data:image/jpeg;base64,' + btoa(s);
  } catch (e) { /* 小さくできなければそのまま */ }
  await post({ action: 'shot', image: url, url: tab.url || '', title: tab.title || '' });
}

// ---- Scratch から離れた記録 ----
async function current() {
  const win = await chrome.windows.getLastFocused().catch(() => null);
  if (!win || !win.focused) return { url: '', title: 'Chrome 以外の画面', other: true };
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  return tab ? { url: tab.url || '', title: tab.title || '' } : { url: '', title: '' };
}
async function check() {
  const on = await isOn();
  const { away } = await chrome.storage.session.get('away');
  const now = Date.now();
  if (!on) {
    if (away) { await chrome.storage.session.remove('away'); }
    return;
  }
  const cur = await current();
  const onScratch = SCRATCH.test(cur.url);
  const minSec = (cfg && cfg.awaySec) || 60;
  if (!onScratch) {
    if (!away) { await chrome.storage.session.set({ away: { start: now, pages: [{ at: now, url: cur.url, title: cur.title }] } }); return; }
    const last = away.pages[away.pages.length - 1];
    if (!last || last.url !== cur.url || last.title !== cur.title) away.pages.push({ at: now, url: cur.url, title: cur.title });
    await chrome.storage.session.set({ away });
    if (now - away.start >= minSec * 1000) await post({ action: 'away', start: away.start, end: now, pages: away.pages, open: true });
  } else if (away) {
    await chrome.storage.session.remove('away');
    if (now - away.start >= minSec * 1000) await post({ action: 'away', start: away.start, end: now, pages: away.pages, open: false });
  }
}

chrome.tabs.onActivated.addListener(() => { check(); });
chrome.tabs.onUpdated.addListener((id, info, tab) => { if (tab.active && (info.url || info.title)) check(); });
chrome.windows.onFocusChanged.addListener(() => { check(); });

chrome.alarms.create('tick', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== 'tick') return;
  const on = await isOn();
  await setBadge(on);
  if (!on) return;
  await check();
  await shot();
});
chrome.runtime.onStartup.addListener(async () => setBadge(await isOn()));
chrome.runtime.onInstalled.addListener(async () => setBadge(await isOn()));

// Scratch の画面（content.js）から：ログインした生徒の合言葉と、いまの状態
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'auth') {
    const t = typeof msg.token === 'string' && /^[0-9a-f]{64}$/.test(msg.token) ? msg.token : '';
    chrome.storage.local.set({ mtoken: t }).then(() => reply({ ok: true }));
    return true;
  }
  if (msg.type === 'status') {
    getCfg().then((c) => reply({ active: !!(c && c.active), label: c && c.label }));
    return true;
  }
});
