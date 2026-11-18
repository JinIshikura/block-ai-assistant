const fs = require('fs');
const { JSDOM } = require('jsdom');
const E = '/home/claude/block-ai-assistant/extension/';
const ok = (c, l) => { console.log((c ? 'OK  ' : 'NG  ') + l); if (!c) process.exitCode = 1; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const cfg = { menu: { bar: '[class*="menu-bar_main-menu"]', item: '[class*="menu-bar_menu-bar-item"]', hide: [], buttons: [{ label: 'AIに聞く', view: 'ai' }, { label: 'コードで見る', view: 'code' }] }, learn: { baseProject: '123456', label: '学習', tabButtons: [{ label: '学習の画面', view: 'learn' }] }, editorReady: '.blocklyWorkspace' };
function page(url) {
  const dom = new JSDOM('<!doctype html><body><div class="menu-bar_main-menu_x"></div><div class="blocklyWorkspace"></div></body>', { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.chrome = { runtime: { getManifest: () => ({ version: '0.12.0' }) } };
  w.fetch = async () => ({ ok: true, json: async () => cfg });
  w.opened = [];
  w.open = (u, n) => { w.opened.push([u, n]); return null; };
  w.eval(fs.readFileSync(E + 'content.js', 'utf8'));
  return w;
}
(async () => {
  const a = page('https://scratch.mit.edu/projects/9/editor');
  await wait(900);
  const btns = [...a.document.querySelectorAll('.block-ai-menu-btn')];
  ok(btns.map((b) => b.textContent).join(',') === 'AIに聞く,コードで見る,学習', 'ふつうのタブ：「学習」ボタンが加わる');
  btns[2].click();
  ok(a.opened[0] && a.opened[0][0] === 'https://scratch.mit.edu/projects/123456/editor#blockai=learn', '「学習」で先生の土台作品を別タブで開く: ' + (a.opened[0] || [])[0]);
  ok(!a.document.querySelector('iframe'), '自分の作品のタブには何も読みこまない');
  const b = page('https://scratch.mit.edu/projects/123456/editor#blockai=learn');
  await wait(2200);
  const bb = [...b.document.querySelectorAll('.block-ai-menu-btn')].map((x) => x.textContent);
  ok(bb.join(',') === '学習の画面', '学習用のタブ：普段のボタンは出ない: ' + bb.join(','));
  const fr = b.document.querySelector('iframe');
  ok(fr && fr.style.display === 'block', '学習用のタブでは自動で学習の画面を開く');
  process.exit();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
