// ポータルと先生の管理画面で使う「生徒 → 記録表」のむすびつけ
(function () {
'use strict';
// =====================================================================
// ▼記録表：[表示名, スプレッドシートのID, ログインIDの読み方（ローマ字）...]
//   ログインした生徒の「名前」か「ID」が、表示名や読み方と合えば、その人の記録表になる
// =====================================================================
var S = 'https://docs.google.com/spreadsheets/d/';
var SHEETS = [
  ['ネフー','17_dPGQ0PaELXv--U7yjO6LcsKOdLt2StURE_oZPZugE','nefu','nehu'],
  ['みどりー','1LoznsKM-tdSY5M-HJb1T0ThOdQKeGePxQREeXkd-TWA','midori'],
  ['ゴロー','1wRVnMi2SpdT6JHJxYSy_8m83pxfwV4KqC4SNIFvWWo0','goro'],
  ['イクー','1zaqi8tlBt6LJwi675EsP-u365f7rhlxtB_cauGBZ_1Y','iku'],
  ['あっきー','1fUEiajN_Hi-8UkcwCouDBYtymB30HyZm1lb84TxQUPs','akki','aki'],
  ['こうー','1M8MPhvFCgLLBYnPdPzp8SQHvErf5WThBngxlyL5EsYM','kou','koh'],
  ['たのー','1BzxidGDatmRYlYB7QeshfvQZpqbprkS3XGsEx9acxDU','tano'],
  ['レジー','1KuGujnvlH-kIWZydbKMsKyp5EJITmBpGKbv5gzRWjhQ','reji','rezi','regi','reggie'],
  ['こちー','1e3EG1NqxmbGg9_UqpfbQunsuJVbLk4k60s1-ZBnP1WE','kochi','koti'],
  ['いよぐん','1R8kzdQH-2RhAga6ADWNkRmkLEJy9ZbZlME95kT1mFbQ','iyogun','iyo'],
  ['ライトー','1Acaoh0Qe8c1eZHLk03S1mroGj2aY4yct7vDscQ4btUs','raito','light','right'],
  ['Vin','1o0XOJtq7g8SNal0OhA5Zn1pWBcJV1iytUON_ivjGGNo','vin','bin'],
  ['だいー','18iKAad1mH3iKVhQiwOpmw5gXM2fKxWS_zX4wbEQp1ao','dai'],
  ['うなー','18BPnN6XAySCul5nzCDsJLwqicN6SYkIWM0LJOvIvyLQ','una'],
  ['ゼンー','1BLRGIwC4rOhsoL1ONp27rfffRD9RQOd-XyGdeWYM6Lc','zen']
];
// ▼うまく合わないときだけ：{ 'ログインID': '表示名' } で直接むすびつける（例：'k07': 'ゴロー'）
var LINKS = {
  akki: 'あっきー',
  iku: 'イクー',
  iyogun: 'いよぐん',
  kou: 'こうー',
  una: 'うなー',
  vin: 'Vin'
};

// ---------------------------------------------------------------------
// 名前のゆれをそろえる（カタカナ→ひらがな、のばし棒・記号・数字・さん/くん を消す）
function norm(s) {
  s = String(s || '').normalize('NFKC').toLowerCase();
  s = s.replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  s = s.replace(/(さん|くん|ちゃん|君)$/, '');
  return s.replace(/[\sー〜~\-_.・0-9]/g, '');
}
function findSheet(user) {
  if (!user) return null;
  var id = String(user.id || '').toLowerCase();
  if (LINKS[id]) return SHEETS.find(function (r) { return r[0] === LINKS[id]; }) || null;
  var name = norm(user.name);
  var idLetters = id.replace(/[^a-z]/g, '');
  var best = null, score = 0;
  SHEETS.forEach(function (r) {
    var key = norm(r[0]);
    var sc = 0;
    if (name && name === key) sc = 100;
    else if (name.length >= 2 && key.length >= 2 && (name.indexOf(key) === 0 || key.indexOf(name) === 0)) sc = 60;
    r.slice(2).forEach(function (a) {
      if (idLetters === a) sc = Math.max(sc, 90);
      else if (a.length >= 3 && idLetters.indexOf(a) === 0) sc = Math.max(sc, 50);
      if (name === a) sc = Math.max(sc, 90);
    });
    if (sc > score) { score = sc; best = r; }
  });
  return best;
}
var sheetUrl = function (r) { return S + r[1] + '/edit'; };

window.PortalSheets = { SHEETS: SHEETS, LINKS: LINKS, norm: norm, findSheet: findSheet, sheetUrl: sheetUrl };
})();
