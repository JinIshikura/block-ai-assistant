// 「説明していないコードを演習で使っていないか」のテスト：node tests/learn-taught-test.js
//  スライド（コードと本文）に出てきた命令・文法だけを、そのあとの演習（最初のコード・模範解答・ヒント）で使っているかを調べる
const fs = require('fs');
const R = '/home/claude/block-ai-assistant/';
const course = JSON.parse(fs.readFileSync(R + 'public/learn/course.json', 'utf8'));
const answers = JSON.parse(fs.readFileSync(R + 'tests/answers.json', 'utf8'));
const ok = (c, l) => { console.log((c ? 'OK  ' : 'NG  ') + l); if (!c) process.exitCode = 1; };
const KW = ['while', 'for', 'in', 'if', 'elif', 'else', 'True', 'False', 'and', 'or', 'not'];
function tokens(code) {
  const out = new Set();
  String(code).split('\n').forEach((line) => {
    // 文字列とコメントを消す
    let s = '';
    let q = '';
    for (const ch of line) {
      if (q) { if (ch === q) q = ''; continue; }
      if (ch === '"' || ch === "'") { q = ch; s += ' "" '; continue; }
      if (ch === '#') break;
      s += ch;
    }
    let m;
    const re = /@([A-Za-z_]+)|\.([A-Za-z_]+)\s*\(|\b([A-Za-z_][A-Za-z0-9_]*)\s*\(|\b([A-Za-z_]+)\b/g;
    while ((m = re.exec(s))) {
      if (m[1]) out.add('@' + m[1]);
      else if (m[2]) out.add('.' + m[2]);
      else if (m[3]) { if (!/^script\d*$/.test(m[3])) out.add(m[3]); }
      else if (KW.includes(m[4])) out.add(m[4]);
    }
    (s.match(/==|!=|<=|>=|[<>]|\[|(?<![=!<>])=(?!=)|[+\-*/]/g) || []).forEach((o) => out.add(o === '-' ? '-' : o));
  });
  out.delete('-');
  return out;
}
// 本文の中の「name(」も説明したことにする
const textTokens = (t) => new Set((String(t).match(/@?[A-Za-z_][A-Za-z0-9_]*(?=\()/g) || []).concat((String(t).match(/@[a-z_]+/g) || [])));
const taught = new Set();
let checked = 0;
course.steps.forEach((st) => st.lessons.forEach((l) => {
  l.slides.forEach((s) => {
    if (s.code && !s.plain) tokens(s.code).forEach((t) => taught.add(t));
    textTokens(s.text).forEach((t) => taught.add(t));
    if (s.code && !s.plain) textTokens(s.code).forEach((t) => taught.add(t));
  });
  l.exercises.forEach((e) => {
    const used = new Set([...tokens(e.starter[e.sprite]), ...tokens(answers[e.id] || ''), ...[].concat(e.hints || []).flatMap((h) => [...textTokens(h)])]);
    const miss = [...used].filter((t) => !taught.has(t));
    ok(miss.length === 0, e.id + '（' + l.title + '）' + (miss.length ? ' 説明していないコード: ' + miss.join(' ') : ''));
    checked++;
  });
}));
console.log(checked + ' 問を調べました');
