/**
 * ブロックAIアシスタント 会話記録用 Apps Script
 *
 * 使い方（くわしくは README.md の「会話の記録」）
 *  1. Googleスプレッドシートを新しく作る
 *  2. メニュー「拡張機能」→「Apps Script」を開き、このコードを全部貼りつける
 *  3. 下の TOKEN を好きな合言葉に変える（拡張機能の設定にも同じものを入れる）
 *  4. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *     実行ユーザー：自分 ／ アクセスできるユーザー：全員 → デプロイ
 *  5. 表示された「ウェブアプリのURL」を拡張機能の設定に貼る
 */

const TOKEN = 'ここに合言葉を書く';

const HEADERS = ['日時', '種類', 'PC', '作品番号', 'レベル', 'モード', '生徒のメッセージ', 'AIの返事', 'AIが使った機能', 'エラー'];
const TYPE_NAMES = { talk: '会話', undo: '元にもどす', quiz: 'クイズ', challenge: 'チャレンジ', code: 'コード', test: 'テスト' };
const MAX_CELL = 5000;

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return out('BAD');
  }
  if (!data || data.token !== TOKEN) return out('NG');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet();
    const rows = (data.rows || []).map((r) => [
      r.time ? new Date(r.time) : new Date(),
      TYPE_NAMES[r.type] || r.type || '',
      cut(r.pc), cut(r.project), cut(r.level), cut(r.mode),
      cut(r.student), cut(r.ai), cut(r.tools), cut(r.errors)
    ]);
    if (rows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
    }
  } finally {
    lock.releaseLock();
  }
  return out('OK');
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('ログ');
  if (!sheet) {
    sheet = ss.insertSheet('ログ');
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#EDE7FB');
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidths(7, 2, 360);
    sheet.getRange('A:A').setNumberFormat('yyyy/mm/dd hh:mm');
    sheet.getRange('G:H').setWrap(true);
  }
  return sheet;
}

function cut(v) {
  const s = v === undefined || v === null ? '' : String(v);
  // 先頭が = + - @ だと数式あつかいされるので、文字として入れる
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s;
  return safe.length > MAX_CELL ? safe.slice(0, MAX_CELL) + '…' : safe;
}

function out(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.TEXT);
}
