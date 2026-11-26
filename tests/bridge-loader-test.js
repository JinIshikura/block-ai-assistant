// page-bridge の読みこみ方のテスト：node tests/bridge-loader-test.js
//  サーバーの版が読めればそれを使い、読めなければ拡張機能の中の版で動く。2つのファイルは同じ中身
const fs = require('fs');
const { JSDOM } = require('jsdom');
const R = '/home/claude/block-ai-assistant/';
const ok = (c, l) => { console.log((c ? 'OK  ' : 'NG  ') + l); if (!c) process.exitCode = 1; };
const src = fs.readFileSync(R + 'extension/page-bridge.js', 'utf8');
ok(src === fs.readFileSync(R + 'public/bridge/page-bridge.js', 'utf8'), 'サーバーの版と拡張機能の版が同じ（tools で同期）');
function make() {
  const dom = new JSDOM('<!doctype html><head></head><body></body>', { url: 'https://scratch.mit.edu/projects/1/editor', runScripts: 'outside-only' });
  return dom.window;
}
(async () => {
  // 1) サーバーの版が読めない → 手元の版で動く
  let w = make();
  w.eval(src);
  const sc = w.document.querySelector('script[src^="https://block-ai-assistant.pages.dev/bridge/page-bridge.js"]');
  ok(!!sc && !w.__blockAiBridge, 'まずサーバーの版を読みにいく');
  sc.onerror();
  ok(w.__blockAiBridge === true, '読めなければ、手元の版で動く');
  // 2) サーバーの版が読めた → 手元の版は動かない（二重に動かない）
  w = make();
  w.eval(src);
  const sc2 = w.document.querySelector('script[src^="https://block-ai-assistant.pages.dev/"]');
  w.__blockAiBridge = true; // サーバーの版が動いた
  let replies = 0; w.addEventListener('message', () => { replies++; });
  sc2.onload();
  ok(w.__blockAiBridge === true, 'サーバーの版が動いたら、それを使う');
  process.exit();
})();
