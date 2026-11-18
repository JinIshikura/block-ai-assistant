// ブロックAIアシスタント - 設定画面

const DEFAULTS = {
  classCode: '',
  model: 'claude-sonnet-5-5',
  levelCap: 3,
  timeLimitOn: true,
  days: [0],          // 0=日曜
  start: '13:00',
  end: '16:40',
  passwordHash: '',
  memoMode: 'full',
  dailyLimit: 0,
  voiceInput: false,
  priceIn: 2,
  priceOut: 10,
  priceCw: 2.5,
  priceCr: 0.1,
  yen: '',
  logOn: false,
  logUrl: '',
  logToken: '',
  pcName: '',
  unlockHash: 'c998e949a65f9c170d8dc645e1f4758c5cc27bea7122b386c8593640f12b22f5'
};
const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

const $ = (id) => document.getElementById(id);

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function renderDays(selected) {
  const box = $('days');
  box.innerHTML = '';
  DAY_NAMES.forEach((name, i) => {
    const l = document.createElement('label');
    const c = document.createElement('input');
    c.type = 'checkbox';
    c.value = String(i);
    c.checked = selected.includes(i);
    l.appendChild(c);
    l.appendChild(document.createTextNode(name));
    box.appendChild(l);
  });
}

function fill(s) {
  $('classCode').value = s.classCode || '';
  $('model').value = s.model;
  document.querySelectorAll('input[name=cap]').forEach((r) => { r.checked = Number(r.value) === Number(s.levelCap); });
  $('timeOn').checked = !!s.timeLimitOn;
  renderDays(s.days || []);
  $('start').value = s.start;
  document.querySelectorAll('input[name=memoMode]').forEach((r) => { r.checked = r.value === (s.memoMode || 'full'); });
  $('dailyLimit').value = s.dailyLimit || 0;
  $('voiceInput').checked = !!s.voiceInput;
  $('pIn').value = s.priceIn; $('pOut').value = s.priceOut; $('pCw').value = s.priceCw; $('pCr').value = s.priceCr;
  $('yen').value = s.yen || '';
  renderUsage(s);
  $('logOn').checked = !!s.logOn;
  $('logUrl').value = s.logUrl || '';
  $('logToken').value = s.logToken || '';
  $('pcName').value = s.pcName || '';
  $('end').value = s.end;
}

async function load() {
  const s = Object.assign({}, DEFAULTS, await chrome.storage.local.get(Object.keys(DEFAULTS)));
  if (s.passwordHash) {
    $('lockCard').classList.remove('hidden');
    $('unlockBtn').onclick = async () => {
      const h = await sha256($('unlockPw').value);
      if (h === s.passwordHash) {
        $('lockCard').classList.add('hidden');
        $('settings').classList.remove('hidden');
        fill(s);
      } else {
        $('unlockMsg').textContent = 'パスワードがちがいます';
      }
    };
    $('unlockPw').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('unlockBtn').click(); });
  } else {
    $('settings').classList.remove('hidden');
    fill(s);
  }
}

$('saveBtn').onclick = async () => {
  const cap = document.querySelector('input[name=cap]:checked');
  const days = Array.from(document.querySelectorAll('#days input:checked')).map((c) => Number(c.value));
  const data = {
    classCode: $('classCode').value.trim(),
    model: $('model').value,
    levelCap: cap ? Number(cap.value) : 3,
    timeLimitOn: $('timeOn').checked,
    days,
    start: $('start').value || DEFAULTS.start,
    end: $('end').value || DEFAULTS.end,
    memoMode: (document.querySelector('input[name=memoMode]:checked') || {}).value || 'full',
    dailyLimit: Math.max(0, Math.floor(Number($('dailyLimit').value) || 0)),
    voiceInput: $('voiceInput').checked,
    priceIn: Number($('pIn').value) || 0,
    priceOut: Number($('pOut').value) || 0,
    priceCw: Number($('pCw').value) || 0,
    priceCr: Number($('pCr').value) || 0,
    yen: $('yen').value.trim(),
    logOn: $('logOn').checked,
    logUrl: $('logUrl').value.trim(),
    logToken: $('logToken').value,
    pcName: $('pcName').value.trim()
  };
  if (data.logOn && !/^https:\/\/script\.google\.com\//.test(data.logUrl)) {
    const m = $('saveMsg');
    m.textContent = '記録のURLが正しくありません（https://script.google.com/ で始まるURL）';
    m.className = 'msg ng';
    return;
  }
  if ($('unlockPwNew').value) {
    data.unlockHash = await sha256($('unlockPwNew').value);
    $('unlockPwNew').value = '';
  }
  if ($('clearPw').checked) {
    data.passwordHash = '';
  } else if ($('newPw').value) {
    data.passwordHash = await sha256($('newPw').value);
  }
  await chrome.storage.local.set(data);
  const m = $('saveMsg');
  m.textContent = '保存しました';
  m.className = 'msg ok';
  $('newPw').value = '';
  $('clearPw').checked = false;
  setTimeout(() => { m.textContent = ''; }, 2500);
  renderUsage(Object.assign({}, DEFAULTS, await chrome.storage.local.get(Object.keys(DEFAULTS))));
};

load();

$('testBtn').onclick = () => {
  const m = $('testMsg');
  m.textContent = '送信中…';
  m.className = 'msg';
  chrome.runtime.sendMessage({ type: 'logTest', url: $('logUrl').value.trim(), token: $('logToken').value, pc: $('pcName').value.trim() }, (res) => {
    if (res && res.ok) { m.textContent = '送れました。スプレッドシートを確認してください'; m.className = 'msg ok'; }
    else { m.textContent = '送れませんでした：' + ((res && res.error) || '不明なエラー'); m.className = 'msg ng'; }
  });
};

async function renderUsage(s) {
  const { usageDays = {} } = await chrome.storage.local.get('usageDays');
  const days = Object.keys(usageDays).sort().reverse().slice(0, 14);
  const box = $('usageTable');
  if (!days.length) { box.textContent = 'まだ記録がありません。'; return; }
  const cost = (d) => ((d.in || 0) * s.priceIn + (d.out || 0) * s.priceOut + (d.cw || 0) * s.priceCw + (d.cr || 0) * s.priceCr) / 1e6;
  const yen = Number(s.yen) || 0;
  const money = (usd) => (yen ? Math.round(usd * yen).toLocaleString() + '円' : '$' + usd.toFixed(3));
  const n = (x) => (x || 0).toLocaleString();
  const now = new Date();
  const month = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const mDays = Object.keys(usageDays).filter((k) => k.startsWith(month));
  const sum = mDays.reduce((a, k) => { const d = usageDays[k]; ['q', 'req', 'in', 'out', 'cw', 'cr'].forEach((f) => { a[f] = (a[f] || 0) + (d[f] || 0); }); return a; }, {});
  const row = (label, d, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + label + '</td><td>' + n(d.q) + '</td><td>' + n(d.req) + '</td><td>' + n(d.in) + '</td><td>' + n(d.out) + '</td><td>' + n(d.cr) + '</td><td>' + n(d.cw) + '</td><td>' + money(cost(d)) + '</td></tr>';
  box.innerHTML = '<table class="u"><tr><th>日付</th><th>質問</th><th>呼び出し</th><th>入力</th><th>出力</th><th>キャッシュ読み</th><th>キャッシュ書き</th><th>料金めやす</th></tr>' +
    row('今月の合計', sum, 'sum') + days.map((k) => row(k, usageDays[k])).join('') + '</table>';
}
