// ブロックAIアシスタント - 学習モード
// 普段のモードとは完全に分けた画面。先生の土台作品を開いた「学習用のタブ」でだけ使う。
// スライドで学ぶ → コードを書く → 「判定する」で実際に動かして自動で確かめる。
// 記録は残さない（サーバー導入後に先生の見守り画面とつなぐ）。答えは表示しない。
(function () {
  'use strict';
  if (window.BlockLearn) return;
  const HOST = window.BlockAIHost;
  const BC = window.BlockCode;
  const AI_AFTER_FAILS = 2;

  // ---------------------------------------------------------------
  // Scratchの中とのやり取り（拡張機能が取りつぐ）
  // ---------------------------------------------------------------
  let seq = 0;
  const pending = {};
  window.addEventListener('message', (ev) => {
    if (ev.source !== window.parent || ev.origin !== HOST.origin) return;
    const d = ev.data;
    if (!d || typeof d !== 'object') return;
    if (d.kind === 'rpc-result' && pending[d.id]) {
      const p = pending[d.id];
      delete pending[d.id];
      if (d.error) p.reject(new Error(d.error)); else p.resolve(d.result);
    } else if (d.kind === 'peek-end') {
      startStage();
    }
  });
  function bridge(method, params, timeout) {
    return new Promise((resolve, reject) => {
      const id = 'L' + (++seq) + '_' + Date.now();
      pending[id] = { resolve, reject };
      HOST.post({ kind: 'rpc', id, method, params: params || {} });
      setTimeout(() => {
        if (pending[id]) { delete pending[id]; reject(new Error('Scratchからの応答がありません')); }
      }, timeout || 20000);
    });
  }

  // ---------------------------------------------------------------
  // 画面
  // ---------------------------------------------------------------
  const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .root { position: fixed; inset: 0; z-index: 2147483600; display: flex; flex-direction: column; background: #E9EDF2; color: #1F2328; font-family: system-ui, -apple-system, "Hiragino Sans", "Yu Gothic UI", sans-serif; font-size: 15px; }
  .hidden { display: none !important; }
  button { font: inherit; cursor: pointer; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 16px; background: #7C4FD0; color: #fff; flex-wrap: wrap; }
  header .ttl { font-size: 17px; font-weight: 700; }
  header .crumb { font-size: 14px; opacity: .95; }
  header .hb { border: none; border-radius: 8px; padding: 8px 14px; background: #fff; color: #4B23A3; font-weight: 700; min-height: 36px; }
  header .hb.ghost { background: #9672DD; color: #fff; }
  main { flex: 1 1 auto; min-height: 0; display: flex; }
  .card { background: #fff; border-radius: 12px; }
  /* 一覧 */
  .home { flex: 1; overflow: auto; padding: 20px; }
  .home > * { max-width: 960px; margin-left: auto; margin-right: auto; }
  .home h2:not(:first-child) { margin-top: 26px; }
  .home h2 { margin: 0 auto 12px; font-size: 20px; }
  .lesson { padding: 16px 18px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 10px; max-width: 900px; }
  .lesson .lt { font-size: 17px; font-weight: 700; }
  .lesson .row { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
  .pill { border: 1.5px solid #C5CCD6; border-radius: 10px; padding: 9px 14px; background: #fff; color: #1F2328; min-height: 48px; display: flex; align-items: center; gap: 8px; text-align: left; font-size: 15px; line-height: 1.45; cursor: pointer; }
  .pill:hover { border-color: #7C4FD0; background: #FAF8FE; }
  .pill .no { flex: none; font-size: 12px; font-weight: 700; color: #555B63; background: #EEF0F3; border-radius: 6px; padding: 3px 7px; }
  .pill.done .no { background: #E3F3E8; color: #1F5A32; }
  .pill.test { border-color: #E0A43A; }
  .pill.slides { border-color: #7C4FD0; color: #4B23A3; font-weight: 700; }
  .pill.done { border-color: #2E7D46; color: #1F5A32; }
  /* スライド */
  .slides { flex: 1; overflow: auto; display: flex; justify-content: center; padding: 20px; }
  .slide { width: 100%; max-width: 980px; max-height: 100%; padding: 22px 30px 18px; display: flex; flex-direction: column; gap: 14px; overflow: hidden; }
  .slide .scroll { flex: 1 1 auto; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 14px; }
  .slide .media { flex: 1 1 auto; min-height: 150px; align-items: stretch !important; }
  .slide .media figure { min-height: 0; }
  .slide figure img { display: block; flex: 1 1 0; min-height: 0; width: 100%; object-fit: contain; object-position: center top; cursor: zoom-in; }
  .slide .media pre.code { max-height: none; }
  .zoom { position: absolute; inset: 0; z-index: 6; background: rgba(0,0,0,.6); overflow: auto; display: flex; justify-content: center; align-items: flex-start; padding: 24px; cursor: zoom-out; }
  .zoom img { max-width: 100%; background: #fff; border-radius: 10px; }
  .slide .meta { display: flex; justify-content: space-between; font-size: 13px; color: #555B63; }
  .slide h1 { margin: 0; font-size: 26px; line-height: 1.35; }
  .slide p { margin: 0; font-size: 17px; line-height: 1.8; }
  .slide .nav { flex: none; margin-top: auto; padding-top: 12px; border-top: 1px solid #EEF0F3; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .slide .keyh { font-size: 12px; color: #6B7280; }
  .dots { display: flex; gap: 8px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #C5CCD6; }
  .dot.on { background: #7C4FD0; }
  .bigbtn { border: none; border-radius: 10px; padding: 11px 26px; background: #7C4FD0; color: #fff; font-weight: 700; min-height: 48px; font-size: 16px; }
  .bigbtn.sub { background: #fff; color: #1F2328; border: 1.5px solid #C5CCD6; }
  pre.code { margin: 0; background: #1E1F22; color: #D7DAE0; border-radius: 10px; padding: 14px 16px; font-family: "BIZ UDGothic", Consolas, Menlo, monospace; font-size: 16px; line-height: 1.75; overflow: auto; white-space: pre; }
  /* 演習 */
  .ex { flex: 1; display: flex; gap: 12px; padding: 12px; min-height: 0; overflow: hidden; }
  .ex > * { min-height: 0; max-height: 100%; }
  @media (max-width: 900px) { .ex { flex-wrap: wrap; overflow: auto; } .ex > * { max-height: none; } }
  @media (max-height: 700px) { .stage { max-height: 170px; } .ex { padding: 8px; gap: 8px; } .task { padding: 12px; gap: 8px; } .judge { padding: 10px; gap: 8px; } }
  .task { flex: 1 1 280px; max-width: 330px; min-width: 0; padding: 16px; display: flex; flex-direction: column; gap: 12px; overflow: auto; }
  .task .crumb2 { font-size: 13px; color: #555B63; }
  .task h2 { margin: 0; font-size: 20px; line-height: 1.4; }
  .goals { background: #F3EFFC; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; line-height: 1.6; }
  .goals b { color: #4B23A3; }
  .hints { display: flex; flex-direction: column; gap: 6px; }
  .hint { background: #FFF6E0; border-radius: 8px; padding: 8px 10px; font-size: 14px; line-height: 1.6; color: #4A3500; }
  .tbtn { border: 1.5px solid #C5CCD6; border-radius: 8px; padding: 8px 10px; background: #fff; color: #1F2328; min-height: 44px; }
  .tbtn.hintb { border-color: #E0A43A; background: #FFF6E0; color: #6B4A00; font-weight: 700; }
  .tbtn:disabled { opacity: .55; cursor: default; }
  .edcol { flex: 999 1 440px; min-width: 0; display: flex; flex-direction: column; background: #1E1F22; border-radius: 12px; overflow: hidden; }
  .edtop { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid #2B2D31; color: #AEB4BE; font-size: 13px; gap: 8px; }
  .edtop .lang { background: #855CD6; color: #fff; border-radius: 8px; padding: 6px 12px; font-weight: 700; }
  .editor { flex: 1 1 auto; min-height: 0; display: flex; overflow: hidden; }
  .gutter { flex: none; padding: 12px 10px; background: #18191C; color: #5F6670; text-align: right; font-family: "BIZ UDGothic", Consolas, Menlo, monospace; font-size: 16px; line-height: 1.75; white-space: pre; overflow: hidden; user-select: none; }
  .edwrap { position: relative; flex: 1 1 auto; min-width: 0; overflow: hidden; }
  .edwrap pre, .edwrap textarea { position: absolute; inset: 0; margin: 0; padding: 12px 14px; font-family: "BIZ UDGothic", Consolas, Menlo, monospace; font-size: 16px; line-height: 1.75; white-space: pre; overflow: auto; tab-size: 4; border: 0; }
  .edwrap pre { color: #D7DAE0; pointer-events: none; }
  .edwrap textarea { background: transparent; color: transparent; caret-color: #F5F6F8; resize: none; outline: none; }
  .edwrap textarea::selection { background: rgba(160,130,255,.35); }
  .edfoot { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid #2B2D31; flex-wrap: wrap; }
  .eb { border: 1px solid #3A3D44; border-radius: 8px; padding: 9px 14px; background: #2B2D31; color: #D7DAE0; min-height: 44px; }
  .eb.go { border-color: #4CBF56; color: #9BE6A4; }
  .eb.stop { border-color: #E5484D; color: #FFB3B5; }
  .errline { background: rgba(229,72,77,.25); }
  .side { flex: 1 1 320px; max-width: 420px; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
  .stagebox { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
  .stage { width: 100%; aspect-ratio: 4 / 3; max-height: min(260px, 34vh); border-radius: 8px; background: #DCEFFF; object-fit: contain; display: block; }
  .judge { flex: 1 1 auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; overflow: auto; min-height: 0; }
  .jbtn { border: none; border-radius: 10px; padding: 12px; background: #2E7D46; color: #fff; font-weight: 700; font-size: 16px; min-height: 48px; }
  .jbtn:disabled { opacity: .6; cursor: default; }
  .jnote { font-size: 13px; color: #555B63; line-height: 1.6; }
  .sum { font-weight: 700; font-size: 15px; border-radius: 8px; padding: 8px 10px; background: #FDE7DD; color: #9A330A; }
  .sum.run { background: #EEF0F3; color: #374151; font-weight: 400; }
  .results { display: flex; flex-direction: column; gap: 8px; }
  .res { display: flex; gap: 8px; align-items: flex-start; font-size: 14px; line-height: 1.55; }
  .res .ic { flex: none; width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; margin-top: 1px; }
  .res.ok .ic { background: #E3F3E8; color: #2E7D46; }
  .res.ng .ic { background: #FDE7DD; color: #C2410C; }
  .res.ng .lb { font-weight: 700; color: #9A330A; }
  .res .why { display: block; font-weight: 400; color: #4A3500; background: #FFF6E0; border-radius: 6px; padding: 6px 8px; margin-top: 4px; }
  .ai { border-top: 1px dashed #C5CCD6; padding-top: 10px; display: flex; flex-direction: column; gap: 8px; }
  .ai textarea { width: 100%; min-height: 56px; border: 1.5px solid #C9B8EF; border-radius: 8px; padding: 8px; font: inherit; resize: vertical; }
  .ai .ab { border: 1.5px solid #C9B8EF; border-radius: 8px; padding: 8px; background: #fff; color: #4B23A3; font-weight: 700; min-height: 44px; }
  .ai .reply { background: #F3EFFC; border-radius: 8px; padding: 8px 10px; font-size: 14px; line-height: 1.7; white-space: pre-wrap; }
  .ai .lock { font-size: 13px; color: #555B63; }
  /* 重ねる画面 */
  .over { position: absolute; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 5; }
  .box { width: 100%; max-width: 520px; background: #fff; border-radius: 16px; padding: 26px 30px; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; }
  .box h1 { margin: 0; font-size: 30px; color: #1F5A32; }
  .box .row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .box .small { font-size: 13px; color: #555B63; line-height: 1.6; }
  /* コードの色（Scratchのブロックと同じ） */
  .k-ev { color: #FFCC33; font-weight: 700; } .k-ct { color: #FFB547; font-weight: 700; } .k-mo { color: #6AA8FF; } .k-lo { color: #B48CFF; }
  .k-sn { color: #E08AE0; } .k-se { color: #6FC8E8; } .k-op { color: #74D67E; } .k-va { color: #FFA04D; }
  .k-li { color: #FF8A5C; } .k-pe { color: #3FD9A8; } .k-fn { color: #FF7A99; } .k-st { color: #C3E88D; }
  .k-nu { color: #F5F6F8; } .k-cm { color: #6B7280; } .k-mk { color: #4A4F57; } .k-zen { color: #FF6B6F; text-decoration: underline wavy #FF6B6F; }
  .edwrap pre .k-ev, .edwrap pre .k-ct { font-weight: 400; -webkit-text-stroke: .45px currentColor; }
  `;

  const host = document.createElement('div');
  host.id = 'blockai-learn';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style>
  <div class="root hidden">
    <header>
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <span class="ttl">学習モード</span>
        <span class="crumb"></span>
      </div>
      <div style="display:flex;gap:8px">
        <button class="hb ghost go-home" type="button">一覧</button>
        <button class="hb quit" type="button">学習をやめる</button>
      </div>
    </header>
    <main>
      <section class="home"></section>
      <section class="slides hidden"><div class="slide card"></div></section>
      <section class="ex hidden">
        <div class="task card">
          <div class="crumb2"></div>
          <h2 class="ex-title"></h2>
          <div class="goals"></div>
          <div class="hints"></div>
          <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px">
            <button class="tbtn hintb" type="button">ヒントを見る</button>
            <button class="tbtn re-slides" type="button">スライドを見直す</button>
            <button class="tbtn reset" type="button">最初の状態にもどす</button>
          </div>
        </div>
        <div class="edcol">
          <div class="edtop"><span class="lang">Python</span><span class="spr"></span></div>
          <div class="editor"><div class="gutter">1</div><div class="edwrap"><pre class="hl"></pre><textarea class="code" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea></div></div>
          <div class="edfoot">
            <button class="eb go" type="button">▶ 動かしてみる</button>
            <button class="eb stop" type="button">■ 止める</button>
            <button class="eb peek" type="button">ブロックで確かめる</button>
          </div>
        </div>
        <div class="side">
          <div class="stagebox card"><img class="stage" alt="ステージ"></div>
          <div class="judge card">
            <button class="jbtn" type="button">できた！判定する</button>
            <div class="jnote">プログラムを実際に動かして、目標ができているか確かめるよ。</div>
            <div class="results"></div>
            <div class="ai">
              <div class="lock">判定で${AI_AFTER_FAILS}回うまくいかなかったら、AIにヒントを聞けるよ。</div>
              <div class="open hidden" style="display:flex;flex-direction:column;gap:8px">
                <textarea placeholder="わからないところを書いてね"></textarea>
                <button class="ab" type="button">AIにヒントを聞く</button>
                <div class="reply hidden"></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
    <div class="over clear hidden"><div class="box">
      <h1>クリア！</h1><div class="clear-title"></div>
      <div class="clear-list" style="align-self:stretch;text-align:left;display:flex;flex-direction:column;gap:6px;background:#F6F7F9;border-radius:10px;padding:12px 16px"></div>
      <div class="row"><button class="bigbtn sub again" type="button">もう一度ためす</button><button class="bigbtn next" type="button">次へ</button></div>
      <div class="small">記録は残りません（サーバー導入後は、先生の見守り画面にも表示されます）。</div>
    </div></div>
    <div class="over confirm hidden"><div class="box">
      <div style="font-size:18px;font-weight:700">学習をやめますか？</div>
      <div class="small">いまの演習で書いたコードは保存されません。このタブが閉じて、もとの作品のタブにもどります。</div>
      <div class="row"><button class="bigbtn sub no" type="button">続ける</button><button class="bigbtn yes" type="button">やめる</button></div>
    </div></div>
  </div>`;
  (document.body || document.documentElement).appendChild(host);
  const $ = (s) => root.querySelector(s);
  const el = {
    root: $('.root'), crumb: $('.crumb'), home: $('.home'), slides: $('.slides'), slide: $('.slide'), ex: $('.ex'),
    crumb2: $('.crumb2'), exTitle: $('.ex-title'), goals: $('.goals'), hints: $('.hints'), hintBtn: $('.hintb'),
    ta: $('textarea.code'), hl: $('pre.hl'), gutter: $('.gutter'), spr: $('.spr'), stage: $('.stage'),
    judgeBtn: $('.jbtn'), results: $('.results'), aiLock: $('.ai .lock'), aiOpen: $('.ai .open'), aiIn: $('.ai textarea'),
    aiBtn: $('.ai .ab'), aiReply: $('.ai .reply'), clear: $('.over.clear'), confirm: $('.over.confirm')
  };

  let course = null;
  let lesson = null;
  let slideIdx = 0;
  let ex = null;
  let exIdx = 0;
  let fails = 0;
  let hintsShown = 0;
  let busy = false;
  const cleared = new Set(); // このタブを開いているあいだだけ
  const projectCache = {};

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function hlHtml(code) {
    try {
      return BC.highlight(code, 'py', {}).map((toks) => toks.map((t) => (t.c ? '<span class="k-' + t.c + '">' + esc(t.s) + '</span>' : esc(t.s))).join('')).join('\n');
    } catch (e) { return esc(code); }
  }

  function show(which) {
    el.home.classList.toggle('hidden', which !== 'home');
    el.slides.classList.toggle('hidden', which !== 'slides');
    el.ex.classList.toggle('hidden', which !== 'ex');
    if (which !== 'ex') stopStage();
  }

  // ---------------------------------------------------------------
  // 一覧
  // ---------------------------------------------------------------
  function renderHome() {
    show('home');
    el.crumb.textContent = '';
    el.home.innerHTML = '';
    course.steps.forEach((st) => {
      const h = document.createElement('h2');
      h.textContent = st.title;
      el.home.appendChild(h);
      st.lessons.forEach((ls) => {
        const c = document.createElement('div');
        c.className = 'lesson card';
        c.innerHTML = '<div class="lt"></div><div class="row"></div>';
        c.querySelector('.lt').textContent = ls.title;
        const row = c.querySelector('.row');
        const sb = document.createElement('button');
        sb.type = 'button'; sb.className = 'pill slides'; sb.textContent = 'スライド（' + ls.slides.length + '枚）';
        sb.addEventListener('click', () => openSlides(ls, 0));
        row.appendChild(sb);
        ls.exercises.forEach((e, i) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'pill' + (cleared.has(e.id) ? ' done' : '') + (ls.exercises.length && /テスト/.test(ls.title) ? ' test' : '');
          const no = document.createElement('span');
          no.className = 'no';
          no.textContent = (cleared.has(e.id) ? '✓ ' : '') + '演習' + (i + 1);
          const tt = document.createElement('span');
          tt.textContent = e.title;
          b.append(no, tt);
          b.addEventListener('click', () => openExercise(ls, i));
          row.appendChild(b);
        });
        el.home.appendChild(c);
      });
    });
  }

  // ---------------------------------------------------------------
  // スライド
  // ---------------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    const z = el.root.querySelector('.zoom');
    if (z) { if (e.key === 'Escape' || e.key.startsWith('Arrow')) { e.preventDefault(); z.remove(); } return; }
    if (el.root.classList.contains('hidden') || el.slides.classList.contains('hidden') || !lesson || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); const b = el.slide.querySelector('.nx'); if (b) b.click(); }
    else if (e.key === 'ArrowLeft' && slideIdx > 0) { e.preventDefault(); openSlides(lesson, slideIdx - 1); }
  });
  function openSlides(ls, i) {
    lesson = ls;
    slideIdx = Math.max(0, Math.min(i, ls.slides.length - 1));
    show('slides');
    el.crumb.textContent = ls.title + '　›　スライド';
    const s = ls.slides[slideIdx];
    const last = slideIdx === ls.slides.length - 1;
    el.slide.innerHTML = '<div class="meta"><span></span><span class="cnt"></span></div><h1></h1><div class="scroll"><div class="body" style="display:flex;flex-direction:column;gap:12px"></div>' +
      '<div class="media" style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">' +
      (s.image ? '<figure style="margin:0;flex:1 1 280px;max-width:460px;display:flex;flex-direction:column;gap:6px"><figcaption style="font-size:13px;color:#555B63"></figcaption><img style="border:1px solid #D5DAE1;border-radius:10px;background:#F9F9F9" alt=""></figure>' : '') +
      (s.code ? '<pre class="code" style="flex:1 1 300px;min-width:0"></pre>' : '') + '</div></div>' +
      '<div class="nav"><div style="display:flex;align-items:center;gap:12px"><div class="dots"></div><span class="keyh">← → キーでもめくれます</span></div><div style="display:flex;gap:10px"><button class="bigbtn sub prev" type="button">戻る</button><button class="bigbtn nx" type="button"></button></div></div>';
    el.slide.querySelector('.meta span').textContent = ls.title;
    el.slide.querySelector('.cnt').textContent = 'スライド ' + (slideIdx + 1) + ' / ' + ls.slides.length;
    el.slide.querySelector('h1').textContent = s.title;
    String(s.text || '').split('\n').forEach((t) => { const p = document.createElement('p'); p.textContent = t; el.slide.querySelector('.body').appendChild(p); });
    if (s.code) el.slide.querySelector('pre.code').innerHTML = hlHtml(s.code);
    if (s.image) {
      const img = el.slide.querySelector('figure img');
      img.src = '/learn/img/' + encodeURIComponent(s.image);
      img.alt = s.caption || 'ブロックの画像';
      el.slide.querySelector('figcaption').textContent = (s.caption || 'ブロック') + '　（クリックで大きく見る）';
      img.addEventListener('click', () => {
        const z = document.createElement('div');
        z.className = 'zoom';
        const big = document.createElement('img');
        big.src = img.src; big.alt = img.alt;
        z.appendChild(big);
        z.addEventListener('click', () => z.remove());
        el.root.appendChild(z);
      });
    }
    const dots = el.slide.querySelector('.dots');
    ls.slides.forEach((_, k) => { const d = document.createElement('span'); d.className = 'dot' + (k === slideIdx ? ' on' : ''); dots.appendChild(d); });
    const prev = el.slide.querySelector('.prev');
    prev.disabled = slideIdx === 0;
    prev.style.visibility = slideIdx === 0 ? 'hidden' : 'visible';
    prev.addEventListener('click', () => openSlides(ls, slideIdx - 1));
    const nx = el.slide.querySelector('.nx');
    nx.textContent = last ? '演習へ' : '次へ';
    nx.addEventListener('click', () => (last ? openExercise(ls, 0) : openSlides(ls, slideIdx + 1)));
  }

  // ---------------------------------------------------------------
  // 演習
  // ---------------------------------------------------------------
  async function getProject(name) {
    if (!projectCache[name]) {
      const r = await fetch('/learn/' + encodeURIComponent(name), { cache: 'no-cache' });
      if (!r.ok) throw new Error('課題の作品を読みこめません');
      projectCache[name] = await r.arrayBuffer();
    }
    return projectCache[name].slice(0);
  }

  async function applyCode(sprite, code) {
    const r = BC.parse(code, 'py', {});
    if (r.error) {
      const e = new Error((r.error.line ? r.error.line + '行目：' : '') + r.error.msg);
      e.line = r.error.line;
      throw e;
    }
    const cur = await bridge('getScripts', { sprite });
    await bridge('replaceScripts', { sprite, removeTopIds: (cur.scripts || []).map((s) => s.topId), scripts: r.scripts }, 30000);
    return r;
  }

  async function openExercise(ls, i) {
    lesson = ls;
    exIdx = i;
    ex = ls.exercises[i];
    fails = 0;
    hintsShown = 0;
    show('ex');
    el.crumb.textContent = ls.title + '　›　演習' + (i + 1);
    el.crumb2.textContent = ls.title + '　›　演習 ' + (i + 1) + ' / ' + ls.exercises.length;
    el.exTitle.textContent = ex.title;
    el.goals.innerHTML = '<b>目標</b>';
    ex.goals.forEach((g, k) => { const s = document.createElement('span'); s.textContent = (k + 1) + '. ' + g; el.goals.appendChild(s); });
    el.hints.innerHTML = '';
    el.hintBtn.disabled = !ex.hints.length;
    el.hintBtn.textContent = 'ヒントを見る（0 / ' + ex.hints.length + '）';
    el.spr.textContent = 'スプライト：' + ex.sprite;
    el.results.innerHTML = '';
    el.results.parentNode.querySelector('.jnote').classList.remove('hidden');
    el.aiIn.value = '';
    el.aiReply.classList.add('hidden');
    el.aiReply.textContent = '';
    updateAi();
    el.ta.value = ex.starter[ex.sprite] || '';
    errLine = 0;
    paint();
    await prepare();
  }

  async function prepare() {
    setBusy(true, '準備中…');
    el.results.innerHTML = '<div class="jnote">課題の作品を読みこんでいます…</div>';
    try {
      await bridge('loadProject', { sb3: await getProject(ex.project) }, 40000);
      for (const sp of Object.keys(ex.starter)) {
        try {
          await applyCode(sp, ex.starter[sp]);
        } catch (e) {
          // 「エラーを直す」課題では、最初のコードがわざとまちがっている（ブロックにはしない）
          if (sp !== ex.sprite || !ex.brokenStarter) throw e;
          const cur = await bridge('getScripts', { sprite: sp });
          await bridge('replaceScripts', { sprite: sp, removeTopIds: (cur.scripts || []).map((x) => x.topId), scripts: [] });
        }
      }
      el.results.innerHTML = '';
    } catch (e) {
      el.results.innerHTML = '';
      addResult(false, '課題の準備', '読みこみに失敗しました：' + e.message + '（タブを読みこみ直してね）');
    }
    setBusy(false);
    startStage();
  }

  function setBusy(v, label) {
    busy = v;
    el.judgeBtn.disabled = v;
    el.judgeBtn.textContent = v ? (label || '確かめ中…') : 'できた！判定する';
    root.querySelectorAll('.eb, .reset').forEach((b) => { b.disabled = v; });
  }

  // ステージの絵
  let stageTimer = null;
  let stageOn = false;
  function startStage() {
    if (!ex || el.ex.classList.contains('hidden')) return;
    stageOn = true;
    clearTimeout(stageTimer);
    loopStage();
  }
  function stopStage() { stageOn = false; clearTimeout(stageTimer); }
  async function loopStage() {
    if (!stageOn) return;
    let running = false;
    try {
      const r = await bridge('stageFrame', {}, 5000);
      if (r && r.url) el.stage.src = r.url;
      running = !!(r && r.running);
    } catch (e) { /* noop */ }
    if (stageOn) stageTimer = setTimeout(loopStage, running || busy ? 120 : 700);
  }

  // コード欄
  let errLine = 0;
  function paint() {
    let html = hlHtml(el.ta.value);
    if (errLine) {
      const ls = html.split('\n');
      if (ls[errLine - 1] !== undefined) ls[errLine - 1] = '<span class="errline" style="display:inline-block;min-width:100%">' + (ls[errLine - 1] || ' ') + '</span>';
      html = ls.join('\n');
    }
    el.hl.innerHTML = html + '\n';
    const n = el.ta.value.split('\n').length;
    let g = '';
    for (let k = 1; k <= n; k++) g += k + '\n';
    el.gutter.textContent = g;
    syncScroll();
  }
  function syncScroll() {
    el.hl.scrollTop = el.ta.scrollTop;
    el.hl.scrollLeft = el.ta.scrollLeft;
    el.gutter.scrollTop = el.ta.scrollTop;
  }
  el.ta.addEventListener('input', () => { errLine = 0; paint(); });
  el.ta.addEventListener('scroll', syncScroll);
  el.ta.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    const ta = el.ta;
    const v = ta.value;
    const st = ta.selectionStart;
    const en = ta.selectionEnd;
    const ls = v.lastIndexOf('\n', st - 1) + 1;
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        const m = /^ {1,4}/.exec(v.slice(ls));
        if (m) { ta.value = v.slice(0, ls) + v.slice(ls + m[0].length); ta.selectionStart = ta.selectionEnd = Math.max(ls, st - m[0].length); }
      } else {
        ta.value = v.slice(0, st) + '    ' + v.slice(en);
        ta.selectionStart = ta.selectionEnd = st + 4;
      }
      paint();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const line = v.slice(ls, st);
      let ind = (/^ */.exec(line) || [''])[0];
      if (/:\s*$/.test(line)) ind += '    ';
      ta.value = v.slice(0, st) + '\n' + ind + v.slice(en);
      ta.selectionStart = ta.selectionEnd = st + 1 + ind.length;
      paint();
    }
  });

  // ヒント
  el.hintBtn.addEventListener('click', () => {
    if (!ex || hintsShown >= ex.hints.length) return;
    const d = document.createElement('div');
    d.className = 'hint';
    d.textContent = 'ヒント' + (hintsShown + 1) + '：' + ex.hints[hintsShown];
    el.hints.appendChild(d);
    hintsShown++;
    el.hintBtn.textContent = 'ヒントを見る（' + hintsShown + ' / ' + ex.hints.length + '）';
    el.hintBtn.disabled = hintsShown >= ex.hints.length;
  });
  $('.re-slides').addEventListener('click', () => openSlides(lesson, 0));
  $('.reset').addEventListener('click', () => { if (!busy && ex) { el.ta.value = ex.starter[ex.sprite] || ''; paint(); el.results.innerHTML = ''; prepare(); } });

  function showCodeError(e) {
    if (e.line) { errLine = e.line; paint(); }
    el.results.innerHTML = '';
    addResult(false, 'コードを読みこめなかった', e.message);
  }
  $('.eb.go').addEventListener('click', async () => {
    if (busy || !ex) return;
    try { await applyCode(ex.sprite, el.ta.value); await bridge('greenFlag'); startStage(); } catch (e) { showCodeError(e); }
  });
  $('.eb.stop').addEventListener('click', () => { bridge('stopAll').catch(() => {}); });
  $('.eb.peek').addEventListener('click', async () => {
    if (busy || !ex) return;
    try { await applyCode(ex.sprite, el.ta.value); } catch (e) { showCodeError(e); return; }
    stopStage();
    HOST.post({ kind: 'peek' });
  });

  // ---------------------------------------------------------------
  // 判定
  // ---------------------------------------------------------------
  function canonicalLines(scripts) {
    let out = BC.toCode(scripts.map((s, k) => ({ topId: 't' + k, x: 0, y: k * 100, blocks: s.blocks || s })), 'py', {});
    if (out && typeof out === 'object') out = out.text || '';
    return String(out || '').split('\n').filter((l) => l.trim() && !/^\s*#/.test(l)).map((l) => {
      const ind = (/^ */.exec(l) || [''])[0].length;
      return { text: l.trim().replace(/\s+/g, ' '), indent: Math.floor(ind / 4) };
    });
  }

  function checkCode(c, linesBySprite) {
    const lines = linesBySprite[c.sprite || ex.sprite] || [];
    const want = String(c.line).trim().replace(/\s+/g, ' ');
    const same = lines.filter((l) => l.text === want);
    if (same.some((l) => typeof c.indent !== 'number' || l.indent === c.indent)) return { ok: true };
    if (same.length) return { ok: false, msg: (c.fail ? c.fail + '　' : '') + '（行はあるけれど、字下げの深さがちがうよ）' };
    return { ok: false, msg: c.fail || '書き方を見直そう。' };
  }

  // 実際に動かした結果を調べる（ほかの課題でも使えるように、種類ごとに書く）
  function valuesOf(samples, sprite, prop, from) {
    return samples.filter((s) => s.t >= (from || 0)).map((s) => (s.sprites[sprite] ? s.sprites[sprite][prop] : undefined)).filter((v) => typeof v === 'number');
  }
  function compare(a, op, b) {
    switch (op) {
      case '>=': return a >= b;
      case '<=': return a <= b;
      case '>': return a > b;
      case '<': return a < b;
      case '!=': return a !== b;
      default: return a === b;
    }
  }
  function evalExpect(x, samples) {
    if (!samples || !samples.length) return false;
    if (x.kind === 'decrease' || x.kind === 'increase') {
      const v = valuesOf(samples, x.sprite, x.prop, x.from || 100);
      if (v.length < 2) return false;
      const d = x.kind === 'decrease' ? v[0] - Math.min(...v) : Math.max(...v) - v[0];
      return d >= (Number(x.min) || 1);
    }
    if (x.kind === 'returnAfter') {
      // 上にある → 下まで行く → また上にもどる、の順に起きたか（動かす前の位置にまどわされないように）
      const v = valuesOf(samples, x.sprite, x.prop || 'y', x.from || 0);
      const i0 = v.findIndex((n) => n > x.above);
      if (i0 < 0) return false;
      const i1 = v.findIndex((n, k) => k > i0 && n < x.below);
      return i1 >= 0 && v.some((n, k) => k > i1 && n > x.above);
    }
    if (x.kind === 'reach') {
      const v = valuesOf(samples, x.sprite, x.prop, x.from || 0);
      return v.some((n) => (typeof x.below === 'number' ? n < x.below : true) && (typeof x.above === 'number' ? n > x.above : true));
    }
    if (x.kind === 'var') {
      const last = samples[samples.length - 1];
      const raw = last.vars ? last.vars[x.name] : undefined;
      if (raw === undefined) return false;
      const n = Number(raw);
      const val = typeof x.value === 'number' ? n : String(raw);
      if (!compare(val, x.op || '==', x.value)) return false;
      if (x.multipleOf && n % x.multipleOf !== 0) return false;
      return true;
    }
    if (x.kind === 'varSteps') {
      // 変数の増え方：増えるたびに step の倍数ずつ増えているか（最後は min 以上）
      const v = samples.map((sm) => Number(sm.vars ? sm.vars[x.name] : NaN)).filter((n) => !Number.isNaN(n));
      if (!v.length || v[v.length - 1] < (Number(x.min) || 1)) return false;
      for (let k = 1; k < v.length; k++) { const d = v[k] - v[k - 1]; if (d !== 0 && (d < 0 || d % x.step !== 0)) return false; }
      return true;
    }
    if (x.kind === 'said') {
      return samples.some((s) => s.sprites[x.sprite] && String(s.sprites[x.sprite].say || '').includes(x.text));
    }
    if (x.kind === 'final') {
      const last = samples[samples.length - 1];
      const sp = last.sprites[x.sprite];
      return !!sp && typeof sp[x.prop] === 'number' && compare(sp[x.prop], x.op || '==', x.value);
    }
    if (x.kind === 'visible') {
      const last = samples[samples.length - 1];
      return !!(last.sprites[x.sprite] && last.sprites[x.sprite].visible === !!x.value);
    }
    return false;
  }

  function addResult(ok, label, why) {
    const d = document.createElement('div');
    d.className = 'res ' + (ok ? 'ok' : 'ng');
    d.innerHTML = '<span class="ic">' + (ok ? '✓' : '✕') + '</span><span class="lb"></span>';
    d.querySelector('.lb').textContent = label;
    if (!ok && why) { const w = document.createElement('span'); w.className = 'why'; w.textContent = why; d.querySelector('.lb').appendChild(w); }
    el.results.appendChild(d);
    return d;
  }

  let lastResults = [];
  el.judgeBtn.addEventListener('click', judge);
  async function judge() {
    if (busy || !ex) return;
    setBusy(true, '動かして確かめ中…');
    el.results.innerHTML = '<div class="sum run">動かして確かめています…</div>';
    el.results.parentNode.querySelector('.jnote').classList.add('hidden');
    lastResults = [];
    const linesBySprite = {};
    let parsed = null;
    try {
      parsed = await applyCode(ex.sprite, el.ta.value);
    } catch (e) {
      addResult(false, 'コードを読みこめなかった', e.message);
      if (e.line) { errLine = e.line; paint(); }
      lastResults.push({ ok: false, label: 'コードを読みこめなかった', why: e.message });
      return finish(false);
    }
    try {
      linesBySprite[ex.sprite] = canonicalLines(parsed.scripts);
      Object.keys(ex.starter).forEach((sp) => { if (sp !== ex.sprite) linesBySprite[sp] = canonicalLines(BC.parse(ex.starter[sp], 'py', {}).scripts); });
    } catch (e) { /* noop */ }
    let all = true;
    startStage();
    for (const c of ex.checks) {
      let r;
      if (c.type === 'code') {
        r = checkCode(c, linesBySprite);
      } else if (c.type === 'run') {
        try {
          const out = await bridge('runTest', { ms: c.ms, setup: c.setup, keys: c.keys, sampleMs: 100 }, (Number(c.ms) || 3000) + 15000);
          const okRun = (c.expect || []).every((x) => evalExpect(x, out.samples));
          r = { ok: okRun, msg: okRun ? '' : c.fail };
        } catch (e) {
          r = { ok: false, msg: '動かして確かめられませんでした：' + e.message };
        }
      } else {
        continue;
      }
      addResult(r.ok, c.label, r.msg);
      lastResults.push({ ok: r.ok, label: c.label, why: r.msg || '' });
      if (!r.ok) all = false;
    }
    // 判定のために隠したスプライトを、元にもどす
    const hidden = new Set();
    ex.checks.forEach((c) => (c.setup || []).forEach((op) => { if (op.sprite && op.visible === false) hidden.add(op.sprite); }));
    if (hidden.size) {
      try { await bridge('runTest', { ms: 200, flag: false, setup: [...hidden].map((sp) => ({ sprite: sp, visible: true, at: 0 })) }, 8000); } catch (e) { /* noop */ }
    }
    return finish(all);
  }
  function finish(all) {
    setBusy(false);
    const run = el.results.querySelector('.sum.run');
    if (run) {
      const ng = lastResults.filter((r) => !r.ok).length;
      if (all) run.remove();
      else { run.className = 'sum'; run.textContent = 'まだできていないところが ' + ng + ' つあるよ'; }
    }
    if (all) {
      cleared.add(ex.id);
      showClear();
    } else {
      fails++;
      updateAi();
      const target = fails === AI_AFTER_FAILS ? el.aiOpen : el.results;
      try { target.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* noop */ }
    }
  }

  function showClear() {
    $('.clear-title').textContent = ex.title;
    const list = $('.clear-list');
    list.innerHTML = '';
    lastResults.forEach((r) => { const d = document.createElement('div'); d.textContent = '✓ ' + r.label; d.style.color = '#1F5A32'; list.appendChild(d); });
    const hasNext = exIdx + 1 < lesson.exercises.length;
    $('.clear .next').textContent = hasNext ? '次の演習へ' : '一覧にもどる';
    el.clear.classList.remove('hidden');
  }
  $('.clear .again').addEventListener('click', () => el.clear.classList.add('hidden'));
  $('.clear .next').addEventListener('click', () => {
    el.clear.classList.add('hidden');
    if (exIdx + 1 < lesson.exercises.length) openExercise(lesson, exIdx + 1); else renderHome();
  });

  // ---------------------------------------------------------------
  // AIのヒント（判定で2回うまくいかなかったら）
  // ---------------------------------------------------------------
  function updateAi() {
    const open = fails >= AI_AFTER_FAILS;
    el.aiOpen.classList.toggle('hidden', !open);
    el.aiLock.textContent = open ? 'AIにヒントを聞けるよ。' : '判定で' + AI_AFTER_FAILS + '回うまくいかなかったら、AIにヒントを聞けるよ。（あと' + (AI_AFTER_FAILS - fails) + '回）';
  }
  el.aiBtn.addEventListener('click', async () => {
    if (!ex || fails < AI_AFTER_FAILS || el.aiBtn.disabled) return;
    const q = el.aiIn.value.trim() || 'どこを直せばいいかわかりません';
    el.aiBtn.disabled = true;
    el.aiReply.classList.remove('hidden');
    el.aiReply.textContent = '考えています…';
    const system = [
      'あなたは、Scratchを1年ほど経験した小学校高学年の子どもがPythonを学ぶときの、ヒント係です。',
      '絶対に答えのコードを書かないでください（1行も、一部分も書かない）。',
      '次に見るべき行や、考え方のヒントを、2〜4文の短い日本語で伝えてください。漢字は小学校高学年で習う程度にします。',
      '名前や住所など、個人のことは聞かないでください。課題と関係ない話には、課題にもどるようにやさしく伝えてください。'
    ].join('\n');
    const content = '【課題】' + ex.title + '\n【目標】\n' + ex.goals.map((g) => '・' + g).join('\n') +
      '\n【判定の結果】\n' + lastResults.map((r) => (r.ok ? '○ ' : '× ') + r.label + (r.why ? '（' + r.why + '）' : '')).join('\n') +
      '\n【子どものコード（スプライト：' + ex.sprite + '）】\n' + el.ta.value.slice(0, 4000) + '\n【子どもの質問】\n' + q.slice(0, 500);
    const res = await new Promise((resolve) => {
      try { window.chrome.runtime.sendMessage({ type: 'claude', body: { max_tokens: 1500, system, messages: [{ role: 'user', content }] } }, resolve); } catch (e) { resolve({ ok: false, error: e.message }); }
    });
    el.aiBtn.disabled = false;
    if (!res || !res.ok) {
      const m = res && res.error === 'NO_KEY' ? 'AIの設定（教室コード）がまだです。先生に設定してもらってね。' : 'AIとの通信でエラーが出ました。少し待ってもう一度ためしてね。';
      el.aiReply.textContent = m;
      return;
    }
    let text = (res.data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    text = text.replace(/```[\s\S]*?```/g, '（コードの部分は表示しません）');
    el.aiReply.textContent = text || '（返事がありませんでした）';
  });

  // ---------------------------------------------------------------
  // 開く・やめる
  // ---------------------------------------------------------------
  $('.go-home').addEventListener('click', () => { if (!busy) renderHome(); });
  $('.quit').addEventListener('click', () => el.confirm.classList.remove('hidden'));
  $('.confirm .no').addEventListener('click', () => el.confirm.classList.add('hidden'));
  $('.confirm .yes').addEventListener('click', () => {
    el.confirm.classList.add('hidden');
    stopStage();
    bridge('stopAll').catch(() => {});
    HOST.post({ kind: 'closeTab' });
  });

  async function open() {
    el.root.classList.remove('hidden');
    if (!course) {
      el.home.innerHTML = '<div class="jnote" style="padding:20px">読みこみ中…</div>';
      try {
        const r = await fetch('/learn/course.json', { cache: 'no-cache' });
        course = await r.json();
      } catch (e) {
        el.home.innerHTML = '<div class="jnote" style="padding:20px">課題を読みこめませんでした。インターネットにつながっているか確かめてね。</div>';
        return;
      }
      renderHome();
    } else if (!el.ex.classList.contains('hidden')) {
      startStage();
    }
  }

  window.BlockLearn = { open, evalExpect, canonicalLines, checkCode };
})();
