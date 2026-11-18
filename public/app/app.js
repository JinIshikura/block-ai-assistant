// ブロックAIアシスタント - 画面（サーバー版）
// Scratchのページに埋めこまれた枠の中で動く。Scratchの読み書きは拡張機能（つなぎ役）に頼む。
// 会話、ツール実行、コード変換、ブロックへの印を担当。
(function () {
  'use strict';
  if (window.__blockAiUI) return;
  window.__blockAiUI = true;

  const CS = 'block-ai-cs';
  const PAGE = 'block-ai-page';
  const MAX_TOOL_ROUNDS = 6;

  const DEFAULTS = {
    levelCap: 3,
    timeLimitOn: true,
    days: [0],
    start: '13:00',
    end: '16:40',
    level: 2,
    // 時間外でもAIを使えるようにする先生用パスワード（SHA-256。設定画面で変更可）
    unlockHash: 'c998e949a65f9c170d8dc645e1f4758c5cc27bea7122b386c8593640f12b22f5',
    unlockUntil: 0,
    // 会話の記録（Googleスプレッドシート）
    logOn: false,
    logUrl: '',
    pcName: '',
    // 子どもが窓で選ぶもの
    kotoba: 'normal',     // normal / furigana / hiragana
    autoRead: false,      // 返事を自動で読み上げ
    // 先生が設定画面で決めるもの
    voiceInput: false,    // 音声入力（Chromeの音声認識はGoogleに音声を送る）
    memoMode: 'full',     // 作品の「AIメモ」リストに残すもの：off / memo / full
    codeLang: 'dncl',     // コードタブの書き方：dncl / py
    codeFont: 15,         // コードの文字の大きさ
    stageFolded: false,   // 全画面のステージをたたむ
    dailyLimit: 0         // 1日の質問回数の上限（0=なし）
  };
  let settings = Object.assign({}, DEFAULTS);

  // ---------------------------------------------------------------
  // Scratchページ側（page-bridge.js）とのやり取り
  // ---------------------------------------------------------------
  let seq = 0;
  const pending = {};
  const HOST = window.BlockAIHost;
  const fromHost = (ev) => ev.source === window.parent && ev.origin === HOST.origin;
  function hostPath() { return (HOST && HOST.info.path) || '/'; }
  window.addEventListener('message', (ev) => {
    if (!fromHost(ev)) return;
    const d = ev.data;
    if (!d || d.kind !== 'rpc-result' || !pending[d.id]) return;
    const p = pending[d.id];
    delete pending[d.id];
    if (d.error) p.reject(new Error(d.error)); else p.resolve(d.result);
  });

  function bridge(method, params, timeout) {
    return new Promise((resolve, reject) => {
      const id = 'r' + (++seq) + '_' + Date.now();
      pending[id] = { resolve, reject };
      HOST.post({ kind: 'rpc', id, method, params: params || {} });
      setTimeout(() => {
        if (pending[id]) {
          delete pending[id];
          reject(new Error('Scratchからの応答がありません'));
        }
      }, timeout || 20000);
    });
  }

  // 拡張機能を更新・再読み込みすると、開いたままのタブでは chrome.* が使えなくなる（ページの再読み込みが必要）
  function alive() {
    try { return !!(chrome && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local); } catch (e) { return false; }
  }

  function save(obj) {
    if (!alive()) return;
    try { chrome.storage.local.set(obj); } catch (e) { /* noop */ }
  }

  // 返事を少しずつ受けとる（background と port でつなぐ）。うまくいかなければ一度に受けとる
  function askClaudeStream(body, onText) {
    if (!alive()) return Promise.reject(new Error('RELOAD'));
    return new Promise((resolve, reject) => {
      let port;
      let finished = false;
      let full = '';
      try {
        port = chrome.runtime.connect({ name: 'claude-stream' });
      } catch (e) {
        askClaude(body).then(resolve, reject);
        return;
      }
      port.onMessage.addListener((m) => {
        if (m.t === 'text') {
          full += m.text;
          try { onText(full); } catch (e) { /* noop */ }
        } else if (m.t === 'done') {
          finished = true;
          resolve(m.message);
          try { port.disconnect(); } catch (e) { /* noop */ }
        } else if (m.t === 'error') {
          finished = true;
          reject(new Error(m.error));
          try { port.disconnect(); } catch (e) { /* noop */ }
        }
      });
      port.onDisconnect.addListener(() => {
        void chrome.runtime.lastError;
        if (!finished) reject(new Error('通信が切れました'));
      });
      port.postMessage({ body });
    });
  }

  function askClaude(body) {
    return new Promise((resolve, reject) => {
      // 拡張機能を更新したあと、ページを読みこみ直していないと chrome.runtime が使えなくなる
      if (!alive()) return reject(new Error('RELOAD'));
      try {
        chrome.runtime.sendMessage({ type: 'claude', body }, (res) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (!res) return reject(new Error('応答がありません'));
          if (!res.ok) return reject(new Error(res.error));
          resolve(res.data);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  // ---------------------------------------------------------------
  // 設定
  // ---------------------------------------------------------------
  function loadSettings() {
    return new Promise((resolve) => {
      if (!alive()) return resolve();
      try {
        chrome.storage.local.get(Object.keys(DEFAULTS), (s) => {
          settings = Object.assign({}, DEFAULTS, s || {});
          resolve();
        });
      } catch (e) {
        resolve();
      }
    });
  }
  try {
    chrome.storage.onChanged.addListener(() => { loadSettings().then(renderControls).catch(() => {}); });
  } catch (e) { /* noop */ }

  function currentLevel() {
    return Math.max(1, Math.min(Number(settings.level) || 2, Number(settings.levelCap) || 3));
  }

  function toMin(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }

  function unlockedNow() {
    return Date.now() < (Number(settings.unlockUntil) || 0);
  }

  function endOfToday() {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function allowedNow() {
    return inTimeWindow() || unlockedNow();
  }

  function inTimeWindow() {
    if (!settings.timeLimitOn) return true;
    const now = new Date();
    if (!(settings.days || []).includes(now.getDay())) return false;
    const m = now.getHours() * 60 + now.getMinutes();
    const s = toMin(settings.start);
    const e = toMin(settings.end);
    if (s === null || e === null) return true;
    return m >= s && m < e;
  }

  function timeText() {
    const names = ['日', '月', '火', '水', '木', '金', '土'];
    const d = (settings.days || []).slice().sort().map((i) => names[i]).join('・');
    return (d ? d + '曜 ' : '') + settings.start + '〜' + settings.end;
  }

  // ---------------------------------------------------------------
  // AIへの指示
  // ---------------------------------------------------------------
  const LEVEL_NAMES = ['ヒント', 'いっしょに', 'おまかせ'];
  const LEVEL_DESC = [
    '考え方のヒントだけ。ブロックは自分で探して組むよ。',
    '使うブロックを教えるよ。ならべるのは自分でやってみよう。',
    'AIがブロックやスプライトを作って、何をしたか説明するよ。'
  ];

  function systemPrompt(level, mode) {
    const common = [
      'あなたは、小学生・中学生がScratch（スクラッチ）でプログラミングするのを手伝うAIアシスタントです。',
      '',
      '# 話し方と安全',
      '- 相手は子どもです。やさしく、短い文で話してください。むずかしい漢字や言葉はなるべく使わないでください。',
      '- 1回の返事は、ふだんは3〜5文くらいにしてください。',
      '- あなたはAIです。人間のふりはしないでください。',
      '- Scratch・プログラミング・作品づくりに関係ない話題には、やさしく断って、作品の話にもどしてください。',
      '- 名前・住所・学校名・電話番号・メールなどの個人情報を聞かないでください。書かれたら、ネットに個人情報を書かないように、やさしく注意してください。',
      '- こわい内容、暴力的な内容、大人向けの内容は扱わないでください。',
      '- 子どもが自分で考えて作ることを大切にしてください。できたところは具体的にほめてください。',
      '',
      '# ブロックの呼び方',
      '- ブロックのことを話すときは、日本語版Scratchで表示される名前を「」でかこんで書いてください（例：「10歩動かす」「ずっと」「もし〜なら」）。',
      '- 使ってほしいブロックを見せたいときは [[block:opcode|表示名]] と書くと、画面に色つきのブロックとして表示されます。例：[[block:motion_movesteps|10歩動かす]] [[block:control_forever|ずっと]]',
      '- opcode、#ID、英語のフィールド名などの内部の言葉は、子どもへの文章には書かないでください。',
      '',
      '# 作品の情報',
      '- メッセージの前に【作品の今の様子】として、全スプライトのスクリプト（Scratch 3.0のopcodeで表記）、変数、いまの位置などが付きます。',
      '- 各ブロックの最後の「#文字列」はブロックのIDです。道具（tool）で使います。',
      '- 「実行中のスクリプト数」やスプライトの状態は、バグの原因さがしのヒントになります。',
      '- look_stage でステージの絵を見られます。見た目にかかわる相談やバグでは、必要に応じて使ってください。',
      '- 値に【全角数字あり】と付いている入力は、子どもがまちがえて全角（１２３）で入力したものです。全角の数字は数として計算されないことが多く、バグの原因になります。見つけたら、半角（123）で入れ直すようにやさしく教えてください（画面では赤い太字で表示されています）。'
    ];

    const levelRules = {
      1: [
        '# いまのレベル：Lv1 ヒント',
        '- 考え方のヒントだけを伝えてください。答えのブロックの組み方は言わないでください。',
        '- [[block:...]] は使わないでください。ブロックの色やカテゴリー（「動き」「制御」など）までは言ってもかまいません。',
        '- 質問を返して、子どもが自分で気づけるようにしてください。',
        '- 使える道具は look_stage（ステージの絵を見る）だけです。'
      ],
      2: [
        '# いまのレベル：Lv2 いっしょに',
        '- 使うブロックは [[block:...]] で見せてかまいません。ただし、ならべ方の完全な答えは言わず、子どもが組めるように順番のヒントを出してください。',
        '- 場所を見せたいとき（バグの原因など）は highlight_blocks で印をつけてください。',
        '- 画面の様子をたしかめたいときは look_stage が使えます。',
        '- 作品のブロックを自分で変えることはできません。'
      ],
      3: [
        '# いまのレベル：Lv3 おまかせ',
        '- add_script / replace_script / delete_script を使って、ブロックを組んだり直したりしてかまいません。create_sprite / add_costume でスプライト・コスチューム・背景も作れます。',
        '- 変えたあとは、何をどう変えたか、なぜそうしたかを子どもにわかる言葉で短く説明してください。',
        '- 場所を見せたいときは highlight_blocks も使えます。',
        '- 子どもが作ったスクリプトを大きく作りかえるのは、たのまれたときだけにしてください。足りない部分を足す・まちがいを直す、を基本にしてください。'
      ]
    }[level];

    const modeRules = mode === 'debug' ? [
      '# いまのモード：バグを調べる',
      '- 子どもの説明と【作品の今の様子】から、うまく動かない原因を考えてください。',
      '- 原因が見つかったら、どのスプライトのどのブロックが原因かをはっきり伝えてください。',
      '- 原因がはっきりしないときは、たしかめる方法（変数を表示する、ブロックを1つずつ動かす など）を提案してください。'
    ] : [
      '# いまのモード：相談する',
      '- やりたいことの実現方法や、次にすることを一緒に考えてください。'
    ];

    const blockFormat = level === 3 ? [
      '',
      '# 道具で使うブロックの書き方（add_script / replace_script の blocks）',
      '- スクリプトは、上から順のブロックの配列です。各ブロックは {"opcode": "...", "inputs": {...}, "fields": {...}}。',
      '- opcode・入力名・フィールド名は Scratch 3.0（project.json）のものを正確に使ってください。',
      '- 入力の値：数 {"num": 10}／文字 {"text": "こんにちは"}／色 {"color": "#ff0000"}／',
      '  メニュー {"menu": {"opcode": "sensing_touchingobjectmenu", "field": "TOUCHINGOBJECTMENU", "value": "かべ"}}／',
      '  ブロックを入れる {"block": {...}}／C型ブロックの中身 {"stack": [ ... ]}（SUBSTACK, SUBSTACK2）。',
      '- フィールドの値：ふつうは文字列（例 "KEY_OPTION": "space"）。変数は {"variable": "スコア"}、リストは {"list": "名前"}、メッセージは {"broadcast": "スタート"}。ない変数・メッセージは自動で作られます。',
      '- メッセージを送るブロックの入力は {"menu": {"opcode": "event_broadcast_menu", "field": "BROADCAST_OPTION", "broadcast": "スタート"}}。',
      '- メニューの特別な値：マウスのポインター "_mouse_"、端 "_edge_"、どこかの場所 "_random_"、自分 "_myself_"。',
      '- 自作ブロック（procedures_）は使えません。',
      '- 例（スペースキーでジャンプ）：',
      '[{"opcode":"event_whenkeypressed","fields":{"KEY_OPTION":"space"}},',
      ' {"opcode":"control_repeat","inputs":{"TIMES":{"num":10},"SUBSTACK":{"stack":[{"opcode":"motion_changeyby","inputs":{"DY":{"num":10}}}]}}},',
      ' {"opcode":"control_repeat","inputs":{"TIMES":{"num":10},"SUBSTACK":{"stack":[{"opcode":"motion_changeyby","inputs":{"DY":{"num":-10}}}]}}}]',
      '- 例（かべに触れたら跳ね返る判定を、ずっと の中に入れる）：',
      '{"opcode":"control_forever","inputs":{"SUBSTACK":{"stack":[{"opcode":"motion_movesteps","inputs":{"STEPS":{"num":10}}},',
      ' {"opcode":"control_if","inputs":{"CONDITION":{"block":{"opcode":"sensing_touchingobject","inputs":{"TOUCHINGOBJECTMENU":{"menu":{"opcode":"sensing_touchingobjectmenu","field":"TOUCHINGOBJECTMENU","value":"かべ"}}}}},',
      ' "SUBSTACK":{"stack":[{"opcode":"motion_turnright","inputs":{"DEGREES":{"num":180}}}]}}}]}}}',
      '- 既存のスクリプトを直すときは、できるだけ edit_blocks で必要なところだけ直してください（ブロックの挿入・移動・削除・入力の値や項目の変更）。子どもが並べた場所や形をこわさないためです。大きく作りかえるときだけ replace_script を使ってください。',
      '- edit_blocks の例：「もし」を「ずっと」の中に移す {"op":"move","block":"<もしのID>","after":"<ずっとの中の最後のブロックID>"}／歩数を5にする {"op":"set_input","block":"<ID>","input":"STEPS","value":{"num":5}}／C型の中の先頭に入れる {"op":"insert","into":{"block":"<ID>","input":"SUBSTACK"},"blocks":[...]}。',
      '- 道具がエラーを返したら、内容を読んで書き方を直してもう一度ためしてください。',
      '',
      '# スプライト・コスチューム・背景の作り方（create_sprite / add_costume）',
      '- 見た目はSVGでかきます。形は <svg xmlns="http://www.w3.org/2000/svg" width="W" height="H" viewBox="0 0 W H"> ... </svg>。',
      '- スプライトは 40〜150 くらいの大きさ、背景は width="480" height="360" にしてください。絵の中心がスプライトの中心になります。',
      '- 使うのは path, rect, circle, ellipse, polygon, polyline, line, g と色（fill, stroke）だけにしてください。画像の読みこみ・スクリプト・外部へのリンクは使えません。',
      '- 子どもが見てわかる、シンプルでかわいい絵にしてください。有名なキャラクターやロゴのまねはせず、オリジナルの絵にしてください。',
      '- 歩くアニメーションなどは、少しずつちがう絵を add_costume で足してください。',
      '- 作ったスプライトには、たのまれたらスクリプトも add_script で付けてください（スプライト名は作ったときの名前。同じ名前があると自動で別の名前になるので、道具の結果に出た名前を使ってください）。',
      '- 子どもが自分で絵をかきたがっているときは、作らずに「コスチューム」タブでのかき方をヒントとして伝えてください。',
      '',
      '# 変数・リストと表示（manage_variable / set_monitor）',
      '- 変数・リストの作成・名前変更・削除・値の変更は manage_variable、ステージへの表示・非表示や表示のしかた（ふつう／大きい／スライダー）は set_monitor を使ってください。',
      '- ブロックで使われている変数は消せません。消すときは先にスクリプトを直してください。',
      '',
      '# スプライト・音の操作',
      '- 名前の変更 rename_sprite、複製 duplicate_sprite、削除 delete_sprite、コスチューム（背景）の削除 delete_costume が使えます。削除は子どもがはっきりたのんだときだけにしてください。',
      '- 音は add_sound で作れます。効果音は preset、曲は notes（音の高さと長さ）で作ります。作ったら「〇〇の音を鳴らす」ブロック（sound_play / sound_playuntildone、入力 SOUND_MENU は {"menu":{"opcode":"sound_sounds_menu","field":"SOUND_MENU","value":"音の名前"}}）で使えます。'
    ] : [];

    const extra = [
      '',
      '# 作戦メモ（make_plan / check_plan）',
      '- 子どもが大きなもの（ゲーム全体など）を作りたいと言ったら、まず make_plan で3〜6個の小さなステップに分けて、1つ目から一緒に進めてください。',
      '- ステップができたら check_plan でチェックを付けてください。【作戦メモ】の今の状態はメッセージの前に付きます。',
      '',
      '# AIメモ（update_memo）',
      '- 作品には「AIメモ」が保存され、次に開いたとき（別のPCでも）メッセージの前に【AIメモ】として付きます。前回の続きから手伝うのに使ってください。',
      '- 作品の目標が決まったとき、何かができたとき、つまずきが分かったときなど、区切りで update_memo を使って短く書きかえてください（毎回は不要）。名前などの個人情報は書かないでください。',
      '- 作品の中の「AIメモ」リストは記録用なので、ブロックで使ったり変えたりしないでください。',
      '',
      '# 動かして確かめる（run_and_watch）',
      '- バグを調べるときや、作ったものが正しく動くか確かめるときは、run_and_watch で緑の旗を押して数秒動かし、位置や変数の変化を見てください。キー操作もためせます（keys）。',
      '- 動かすとスプライトの位置などが変わることがあります。',
      '',
      '# 段階ヒント',
      '- メッセージに（ヒントの段階：N／3）と付いているときは、子どもが「もう少し教えて」を押しています。前の説明より1段だけくわしくしてください。',
      '  1＝考え方をもっと具体的に・使うカテゴリー（「動き」「制御」など）を教える　2＝使うブロックを [[block:...]] で見せる　3＝ならべる順番のお手本を見せる（このときはレベルに関係なく見せてよい）',
      '',
      '# チャレンジ',
      '- お手本を見せたあとなど、子どもが自分で組めそうなときは、返事の最後に [[challenge:組んでみるものの短い説明]] を書くと「できた！見て」ボタンが出ます。',
      '- （チャレンジ…）と付いたメッセージが来たら、作品を見て、できていればほめ、ちがうところはヒントだけ出してください（ブロックは変えない）。'
    ];
    if (window.BlockCode) {
      const ref = window.BlockCode;
      extra.push(
        '',
        '# コード（DNCL／Python）',
        '- 子どもは「コード」タブで、ブロックを DNCL（共通テスト用プログラム表記）や Python の形で見たり、書いてブロックにしたりできます。',
        '- DNCLの形：「緑の旗が押されたとき:」の下に | を付けて書く。もし 〜 ならば: ／ そうでなくもし 〜 ならば: ／ そうでなければ: ／ ずっと繰り返す: ／ 10 回繰り返す: ／ 〜 の間繰り返す: ／ 〜 になるまで繰り返す: ／ i を 1 から 10 まで 1 ずつ増やしながら繰り返す: ／ 〜 になるまで待つ ／ "質問" と尋ねて 変数 に代入 ／ 変数 = 値 ／ 表示する(…)（スプライトが言う）。',
        '- Pythonの形：@when_flag_clicked の次の行に def 名前(): を書き、中を4つ字下げ。while True: ／ for _ in range(10): ／ for i in range(1, 11): ／ while 条件: ／ if/elif/else ／ 変数 = input("質問") ／ print(…)。',
        '- 命令の名前（DNCL／Python）：' + ref.COMMANDS.map((r) => r[0] + '／' + r[1]).join('、'),
        '- 値の関数（DNCL／Python）：' + ref.REPORTERS.map((r) => r[0] + '／' + r[1]).join('、') + '、絶対値／abs、切り捨て／floor、切り上げ／ceil、平方根／sqrt',
        '- メニューの値は日本語で書く（"マウスのポインター" "端" "スペース" "すべて" など）。比較は == != < > <= >=、論理は and or not。',
        '- Scratchにない計算は「関数」として使える：べき乗(a, b)／a ** b・pow、最大(a, b)／max、最小(a, b)／min、a // b（切り捨てのわり算）。中身は作品の「定義ブロック」として自動で作られ、答えは変数「〇〇の答え」に入る。コードの先頭の「# 使える関数」に、そのスプライトで使える関数が出る。',
        '- 子どもが def を書く必要はない。ない関数を使うと「AIに作ってもらう」ボタンが出て、定義ブロックが作られる。',
        '- Pythonでは input() を式の中でも使える（n = int(input("数は？")) など）。int() float() str() は形だけ（Scratchは数と文字を自動で変える）。random()（0以上1未満）・randint(a, b)・time.sleep(秒) も使える。import random／time／math は書いても無視される。f文字列は使えない（print("答え", x) と書く）。',
        '- DNCLは共通テストの書き方に合わせてある：÷（わり算の商）、%（余り）、**（べき乗）、x = 【外部からの入力】、整数(…)、乱数()、要素数(リスト名)、kosu = 3 , kingaku = 300（1行に複数の代入）。≧ ≦ ≠ ← かつ または は使えない（>= <= != = and or を使う）。',
        '- 配列はScratchのリストになる：Data = [3, 18, 29]（空にして順に追加）、Data[i]（添字は0から。コードの先頭に「# 添字は1から」と書くと1から）、Data[i] = x、要素数(Data)。Pythonでは data.append(x)／insert(i, x)／pop()／remove(x)／clear()、len(data)、x in data、data[-1]（最後）、del data[i] も使える。文字の変数 s[i] は「i+1 文字目」。2次元の配列はまだ使えない。'
      );
    }
    if (level === 3) {
      extra.push(
        '',
        '# ふりかえりクイズ',
        '- ブロックを作ったり直したりしたときは、返事の最後に1問だけ3択クイズを出してください。形は [[quiz:問題|選択肢1|選択肢2|選択肢3|正解の番号|ひとこと解説]]（区切りは |、正解の番号は1〜3）。',
        '- 例：[[quiz:「ずっと」の中のブロックはどうなる？|1回だけ動く|くりかえし動く|動かない|2|ずっとくりかえすから、何回も動くよ]]'
      );
    }
    const kotoba = {
      hiragana: ['', '# ことば', '- この子は低学年です。漢字を使わず、ひらがなとカタカナだけで書いてください（ブロックの名前は画面の表示どおり）。文はとても短くしてください。'],
      furigana: ['', '# ことば', '- 漢字には ｜漢字《かんじ》 の形でふりがなを付けてください（例：｜動《うご》き）。ブロックの名前の中の漢字にも付けてください。']
    }[settings.kotoba] || [];
    return common.concat([''], levelRules, [''], modeRules, blockFormat, extra, kotoba).join('\n');
  }

  function toolsFor(level) {
    const sprite = { type: 'string', description: 'スプライト名。ステージは "Stage"。' };
    const blocks = { type: 'array', items: { type: 'object' }, description: 'スクリプトのブロック（上から順）。書き方はシステムの説明のとおり。' };
    const highlightTool = {
      name: 'highlight_blocks',
      description: '作品のブロックに印をつけて、子どもに場所を見せる。バグの原因の場所などを示すときに使う。',
      input_schema: {
        type: 'object',
        properties: {
          sprite,
          block_ids: { type: 'array', items: { type: 'string' }, description: '印をつけるブロックのID（#のあとの文字列）。' },
          note: { type: 'string', description: 'ブロックの横に出す短い言葉（15文字くらいまで）。例：「ここが原因かも」' }
        },
        required: ['sprite', 'block_ids', 'note']
      }
    };
    const editTools = [
      {
        name: 'add_script',
        description: 'スプライトに新しいスクリプトを追加する。',
        input_schema: { type: 'object', properties: { sprite, blocks }, required: ['sprite', 'blocks'] }
      },
      {
        name: 'replace_script',
        description: '既存のスクリプト1つを、新しいスクリプトに置きかえる（直すときに使う）。',
        input_schema: {
          type: 'object',
          properties: { sprite, top_block_id: { type: 'string', description: '置きかえるスクリプトの先頭ブロックのID。' }, blocks },
          required: ['sprite', 'top_block_id', 'blocks']
        }
      },
      {
        name: 'delete_script',
        description: '既存のスクリプト1つを消す。',
        input_schema: {
          type: 'object',
          properties: { sprite, top_block_id: { type: 'string', description: '消すスクリプトの先頭ブロックのID。' } },
          required: ['sprite', 'top_block_id']
        }
      }
    ];
    editTools.push(
      {
        name: 'create_sprite',
        description: '新しいスプライトを作る。見た目（コスチューム）はSVGでかく。',
        input_schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'スプライトの名前（日本語でよい）。' },
            svg: { type: 'string', description: 'コスチュームのSVG。書き方はシステムの説明のとおり。' },
            costume_name: { type: 'string', description: 'コスチュームの名前（省略可）。' },
            x: { type: 'number', description: 'ステージ上のx（-240〜240、省略で0）。' },
            y: { type: 'number', description: 'ステージ上のy（-180〜180、省略で0）。' },
            size: { type: 'number', description: '大きさ%（省略で100）。' }
          },
          required: ['name', 'svg']
        }
      },
      {
        name: 'add_costume',
        description: 'スプライトにコスチュームを追加する（アニメーション用など）。sprite に "Stage" を指定すると背景を追加する。',
        input_schema: {
          type: 'object',
          properties: {
            sprite,
            name: { type: 'string', description: 'コスチューム（背景）の名前。' },
            svg: { type: 'string', description: 'SVG。書き方はシステムの説明のとおり。' },
            switch_to: { type: 'boolean', description: '追加したコスチュームに切りかえるか（省略でtrue）。' }
          },
          required: ['sprite', 'name', 'svg']
        }
      }
    );
    editTools.push(
      {
        name: 'manage_variable',
        description: '変数・リストを作る／名前を変える／消す／値を変える。',
        input_schema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['create', 'rename', 'delete', 'set_value'] },
            kind: { type: 'string', enum: ['variable', 'list'], description: '変数か、リストか（省略で変数）。' },
            name: { type: 'string', description: '変数・リストの名前。' },
            new_name: { type: 'string', description: 'rename のときの新しい名前。' },
            value: { description: 'create / set_value のときの値。リストは文字列の配列。' },
            sprite: { type: 'string', description: 'create のとき：「このスプライトのみ」にするスプライト名（省略で「すべてのスプライト用」）。ほかのとき：さがすスプライト（省略可）。' }
          },
          required: ['action', 'name']
        }
      },
      {
        name: 'set_monitor',
        description: '変数・リストをステージに表示する／かくす。表示のしかた（ふつう・大きい・スライダー）や場所も変えられる。',
        input_schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '変数・リストの名前。' },
            kind: { type: 'string', enum: ['variable', 'list'], description: '省略で変数。' },
            sprite: { type: 'string', description: '「このスプライトのみ」の変数のときはスプライト名。' },
            visible: { type: 'boolean', description: '表示するならtrue、かくすならfalse。' },
            mode: { type: 'string', enum: ['default', 'large', 'slider'], description: '変数の表示のしかた：default=ふつう、large=大きい、slider=スライダー。' },
            x: { type: 'number', description: 'ステージ左上からの位置（0〜480）。' },
            y: { type: 'number', description: 'ステージ左上からの位置（0〜360）。' },
            slider_min: { type: 'number' },
            slider_max: { type: 'number' },
            width: { type: 'number', description: 'リストの表示の幅。' },
            height: { type: 'number', description: 'リストの表示の高さ。' }
          },
          required: ['name', 'visible']
        }
      }
    );
    const spriteName = { type: 'string', description: 'スプライト名。' };
    editTools.push(
      {
        name: 'rename_sprite',
        description: 'スプライトの名前を変える。',
        input_schema: { type: 'object', properties: { sprite: spriteName, new_name: { type: 'string' } }, required: ['sprite', 'new_name'] }
      },
      {
        name: 'delete_sprite',
        description: 'スプライトを消す（子どもがはっきりたのんだときだけ）。',
        input_schema: { type: 'object', properties: { sprite: spriteName }, required: ['sprite'] }
      },
      {
        name: 'duplicate_sprite',
        description: 'スプライトを複製する（スクリプト・コスチューム・音ごと）。',
        input_schema: {
          type: 'object',
          properties: { sprite: spriteName, new_name: { type: 'string', description: '新しい名前（省略可）。' }, x: { type: 'number' }, y: { type: 'number' } },
          required: ['sprite']
        }
      },
      {
        name: 'delete_costume',
        description: 'コスチュームを消す。sprite に "Stage" で背景を消す。最後の1つは消せない。',
        input_schema: { type: 'object', properties: { sprite, name: { type: 'string', description: 'コスチューム（背景）の名前。' } }, required: ['sprite', 'name'] }
      },
      {
        name: 'add_sound',
        description: '効果音やメロディを作って、スプライト（または "Stage"）に音として追加する。preset か notes のどちらかを使う。',
        input_schema: {
          type: 'object',
          properties: {
            sprite,
            name: { type: 'string', description: '音の名前。' },
            preset: { type: 'string', enum: ['jump', 'coin', 'laser', 'explosion', 'powerup', 'hit', 'beep', 'click', 'win', 'lose'], description: '用意された効果音：jump=ジャンプ、coin=コイン、laser=ビーム、explosion=ばくはつ、powerup=パワーアップ、hit=ぶつかる、beep=ピッ、click=カチッ、win=クリア、lose=ゲームオーバー。' },
            notes: {
              type: 'array',
              description: 'メロディ。例 [{"note":"C5","beats":1},{"rest":true,"beats":0.5},{"note":"G5","beats":2}]。note は C4〜C7 など（#・b可）。',
              items: { type: 'object' }
            },
            tempo: { type: 'number', description: 'メロディの速さ（BPM、省略で120）。' },
            wave: { type: 'string', enum: ['square', 'triangle', 'sine', 'sawtooth'], description: '音色：square=ピコピコ、triangle=やわらか、sine=すんだ音、sawtooth=するどい。' }
          },
          required: ['sprite', 'name']
        }
      },
      {
        name: 'delete_sound',
        description: '音を消す。',
        input_schema: { type: 'object', properties: { sprite, name: { type: 'string' } }, required: ['sprite', 'name'] }
      }
    );
    const lookTool = {
      name: 'look_stage',
      description: 'ステージの絵（画面）を撮って見る。見た目のバグや、スプライトの重なり・位置をたしかめるときに使う。run_seconds を指定すると、緑の旗を押してその秒数だけ動かしたあとの絵を撮る。',
      input_schema: {
        type: 'object',
        properties: {
          run_seconds: { type: 'number', description: '緑の旗を押して動かす秒数（0〜10）。0か省略なら、いまの画面をそのまま撮る。' },
          stop_after: { type: 'boolean', description: '撮ったあと止めるか（省略でtrue）。' }
        }
      }
    };
    const runTool = {
      name: 'run_and_watch',
      description: '緑の旗を押して作品を数秒動かし、スプライトの位置・向き・コスチューム・セリフ・変数の変化を時間ごとに記録する。キーを押す操作もためせる。',
      input_schema: {
        type: 'object',
        properties: {
          seconds: { type: 'number', description: '動かす秒数（0.5〜10、省略で3）。' },
          interval: { type: 'number', description: '記録する間かく（秒、省略で0.5）。' },
          sprites: { type: 'array', items: { type: 'string' }, description: '記録するスプライト名（省略で全部）。' },
          variables: { type: 'array', items: { type: 'string' }, description: '記録する変数名（省略で全部）。' },
          keys: { type: 'array', items: { type: 'object' }, description: '押すキー。例 [{"key":"right","at":1,"hold":0.5},{"key":"space","at":2}]。key は space/right/left/up/down/a など。' },
          take_picture: { type: 'boolean', description: '最後にステージの絵も撮るか。' }
        }
      }
    };
    const planTools = [
      {
        name: 'make_plan',
        description: '大きな目標を小さなステップに分けた「作戦メモ」を作って、子どもの画面に表示する（前のメモは置きかわる）。',
        input_schema: {
          type: 'object',
          properties: { title: { type: 'string', description: '目標（例：迷路ゲーム）。' }, steps: { type: 'array', items: { type: 'string' }, description: '3〜6個の短いステップ。' } },
          required: ['title', 'steps']
        }
      },
      {
        name: 'check_plan',
        description: '作戦メモのステップにチェックを付ける（外す）。',
        input_schema: {
          type: 'object',
          properties: { step: { type: 'number', description: 'ステップの番号（1から）。' }, done: { type: 'boolean', description: 'できたらtrue（省略でtrue）。' } },
          required: ['step']
        }
      }
    ];
    editTools.unshift({
      name: 'edit_blocks',
      description: 'スクリプトの一部だけを直す。operations を順番に行い、1つでも失敗したら何も変えない。',
      input_schema: {
        type: 'object',
        properties: {
          sprite,
          operations: {
            type: 'array',
            description: '操作のリスト。op の種類：' +
              'insert（新しいブロックを入れる：blocks と、after／before／into のどれか。どれもなければ新しいスクリプトとして置く）、' +
              'move（今あるブロックを動かす：block と after／before／into。with_following:true でうしろのブロックもいっしょに）、' +
              'delete（ブロックを1つ消す。中身ごと消え、うしろはつなぎ直す）、' +
              'set_input（入力を変える：block, input, value。value は {"num":5} や {"block":{...}}）、' +
              'set_field（項目を変える：block, field, value）。' +
              'after／before はブロックID、into は {"block":"ID","input":"SUBSTACK"}（C型の中の先頭）。',
            items: { type: 'object' }
          }
        },
        required: ['sprite', 'operations']
      }
    });
    planTools.push({
      name: 'update_memo',
      description: '作品に保存される「AIメモ」を書きかえる。次にこの作品を開いたとき（別のPCでも）、続きから手伝うために使う。',
      input_schema: {
        type: 'object',
        properties: {
          lines: { type: 'array', items: { type: 'string' }, description: '短いメモ（全部で8行まで）。作品の目標、できたこと、次にやること、つまずいたところ など。' }
        },
        required: ['lines']
      }
    });
    const base = [lookTool, runTool].concat(planTools);
    if (level === 1) return base;
    if (level === 2) return base.concat([highlightTool]);
    return base.concat([highlightTool], editTools);
  }

  // ---------------------------------------------------------------
  // 画面（Shadow DOM）
  // ---------------------------------------------------------------
  const STYLE = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; font-family: "Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", "Meiryo", sans-serif; color: #1F2433; }
  .fab { position: fixed; width: 56px; height: 56px; border-radius: 50%; border: none; background: #855CD6; color: #fff; cursor: pointer; pointer-events: auto; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,.25); }
  .fab:hover { background: #7349C9; }
  .panel { position: fixed; pointer-events: auto; background: #fff; border: 1px solid #CDBDF0; border-radius: 14px; box-shadow: 0 8px 28px rgba(60,40,120,.22); display: flex; flex-direction: column; overflow: hidden; }
  .head { padding: 8px 10px 10px 14px; background: #F4EFFD; border-bottom: 1px solid #E2D8F7; display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .title { font-weight: 700; font-size: 15px; color: #4B2596; }
  .icon-btn { width: 36px; height: 36px; border: none; background: transparent; color: #4A5163; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 8px; }
  .icon-btn:hover { background: #E7DEF8; }
  .note { font-size: 12px; color: #4A5163; line-height: 1.5; }
  .levels { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 4px; }
  .lv { min-height: 34px; border-radius: 8px; font-family: inherit; font-size: 13px; cursor: pointer; padding: 2px 4px; background: #fff; color: #1F2433; border: 1px solid #C7CEDB; white-space: nowrap; }
  .lv .no { font-size: 11px; margin-right: 3px; }
  .lv .nm { font-size: 13px; font-weight: 700; }
  .lv.on { background: #855CD6; color: #fff; border-color: #855CD6; }
  .lv:disabled { opacity: .45; cursor: not-allowed; }
  .tabs { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); background: #E7DEF8; padding: 3px; border-radius: 8px; }
  .tab { min-height: 32px; border: none; border-radius: 6px; background: transparent; color: #4A5163; font-size: 13px; font-family: inherit; cursor: pointer; }
  .tab.on { background: #fff; color: #1F2433; font-weight: 700; }
  .msgs { flex: 1; min-height: 0; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 12px; background: #FBFCFE; }
  .me { align-self: flex-end; max-width: 85%; background: #855CD6; color: #fff; padding: 9px 12px; border-radius: 12px 12px 4px 12px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
  .ai { align-self: flex-start; max-width: 94%; background: #F7F8FB; border: 1px solid #E3E8EE; padding: 10px 12px; border-radius: 12px 12px 12px 4px; font-size: 14px; line-height: 1.75; word-break: break-word; display: flex; flex-direction: column; gap: 8px; }
  .ai .txt { white-space: pre-wrap; }
  .chip { display: inline-block; padding: 2px 9px; margin: 2px 1px; border-radius: 6px; font-size: 13px; font-weight: 700; line-height: 1.6; }
  .act { align-self: flex-start; font-size: 12px; color: #136B3A; background: #EAF7EF; border: 1px solid #BFE5CC; padding: 4px 10px; border-radius: 999px; }
  .err { align-self: stretch; font-size: 13px; color: #8A1C14; background: #FDECEA; border: 1px solid #F5C2BC; padding: 8px 10px; border-radius: 8px; line-height: 1.6; }
  .think { align-self: flex-start; font-size: 13px; color: #4A5163; }
  .undo-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-top: 6px; border-top: 1px dashed #D3DAE3; }
  .undo-note { font-size: 12px; color: #136B3A; font-weight: 700; }
  .btn { min-height: 38px; padding: 0 12px; border: 1px solid #C7CEDB; background: #fff; border-radius: 8px; font-size: 13px; font-family: inherit; color: #1F2433; cursor: pointer; }
  .btn:hover { background: #F4F6FA; }
  .foot { padding: 8px 12px 8px; border-top: 1px solid #E3E8EE; display: flex; flex-direction: column; gap: 6px; background: #fff; flex-shrink: 0; }
  .disclose { font-size: 11px; color: #4A5163; line-height: 1.4; }
  .quick { display: flex; flex-wrap: nowrap; gap: 6px; overflow-x: auto; scrollbar-width: thin; }
  .q { flex-shrink: 0; white-space: nowrap; min-height: 30px; padding: 0 10px; border: 1px solid #C7CEDB; background: #fff; border-radius: 999px; font-size: 12px; font-family: inherit; color: #1F2433; cursor: pointer; }
  .q:hover { background: #F4EFFD; }
  .inrow { display: flex; gap: 6px; }
  textarea { flex: 1; min-width: 0; min-height: 56px; max-height: 160px; resize: none; padding: 10px; border: 1px solid #C7CEDB; border-radius: 8px; font-size: 14px; font-family: inherit; line-height: 1.5; }
  textarea:focus { outline: 2px solid #855CD6; outline-offset: 0; border-color: #855CD6; }
  .send { width: 48px; min-height: 56px; align-self: stretch; border: none; border-radius: 8px; background: #855CD6; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .send:disabled, .q:disabled, textarea:disabled { opacity: .5; cursor: not-allowed; }
  .linkbtn { border: none; background: none; color: #4A5163; font-size: 12px; font-family: inherit; cursor: pointer; text-decoration: underline; padding: 0; }
  .closed-time { font-size: 13px; color: #6B3E00; background: #FFF4E5; border: 1px solid #F0B46A; padding: 8px 10px; border-radius: 8px; line-height: 1.6; }
  .unlock-row { display: flex; gap: 6px; margin-top: 6px; }
  .unlock-pw { flex: 1; min-width: 0; min-height: 38px; padding: 0 10px; border: 1px solid #C7CEDB; border-radius: 8px; font-size: 13px; font-family: inherit; }
  .unlock-msg { font-size: 12px; color: #8A1C14; min-height: 0; }
  .unlocked-note { font-size: 12px; color: #136B3A; background: #EAF7EF; border: 1px solid #BFE5CC; padding: 3px 10px; border-radius: 8px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; }
  .prefs { display: flex; flex-direction: column; gap: 6px; padding: 6px 2px 0; }
  .pref-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #4A5163; }
  .pref-label { min-width: 3em; }
  .chk input { margin: 0; }
  .seg3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 4px; flex: 1; }
  .kb { min-height: 30px; border: 1px solid #C7CEDB; background: #fff; border-radius: 6px; font-size: 12px; font-family: inherit; cursor: pointer; color: #1F2433; }
  .kb.on { background: #855CD6; border-color: #855CD6; color: #fff; font-weight: 700; }
  .plan { flex-shrink: 0; border-bottom: 1px solid #E2D8F7; background: #FFFCF2; }
  .plan-head { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 8px; border: none; background: transparent; padding: 8px 14px; font-family: inherit; font-size: 13px; font-weight: 700; color: #6B4A00; cursor: pointer; text-align: left; }
  .plan-count { font-weight: 400; font-size: 12px; }
  .plan-list { margin: 0; padding: 0 14px 8px 34px; display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow-y: auto; }
  .plan-list li { font-size: 13px; line-height: 1.5; }
  .plan-list label { display: flex; gap: 6px; align-items: flex-start; cursor: pointer; }
  .plan-list input { margin-top: 3px; }
  .plan-list .done span { text-decoration: line-through; color: #6B7280; }
  .plan.closed .plan-list { display: none; }
  .quota { font-size: 12px; color: #4A5163; }
  .mic { width: 44px; min-height: 56px; border: 1px solid #C7CEDB; border-radius: 8px; background: #fff; color: #4A5163; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .mic.on { background: #FDECEA; border-color: #D9480F; color: #D9480F; }
  .ai-tools { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .speak { border: none; background: transparent; color: #4A5163; cursor: pointer; padding: 2px; display: flex; align-items: center; gap: 2px; font-size: 11px; font-family: inherit; }
  .speak:hover { color: #855CD6; }
  .hint-btn { min-height: 32px; padding: 0 12px; border: 1px solid #855CD6; color: #5A2FB0; background: #fff; border-radius: 999px; font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer; }
  .hint-btn:hover { background: #F4EFFD; }
  .quiz, .challenge { border: 1px solid #E2D8F7; background: #fff; border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 6px; margin-top: 4px; white-space: normal; }
  .quiz-q, .challenge-t { font-weight: 700; font-size: 13px; }
  .quiz-opts { display: flex; flex-direction: column; gap: 4px; }
  .quiz-opt { text-align: left; min-height: 34px; padding: 4px 10px; border: 1px solid #C7CEDB; background: #fff; border-radius: 8px; font-size: 13px; font-family: inherit; cursor: pointer; color: #1F2433; }
  .quiz-opt.right { background: #EAF7EF; border-color: #1F9D55; font-weight: 700; }
  .quiz-opt.wrong { background: #FDECEA; border-color: #D9480F; }
  .quiz-res { font-size: 13px; }
  .challenge { background: #FFFCF2; border-color: #F0D58C; }
  ruby rt { font-size: 0.6em; color: #4A5163; }
  .toptabs { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); background: #E7DEF8; padding: 3px; border-radius: 8px; }
  .tt { min-height: 32px; padding: 0 12px; border: none; border-radius: 6px; background: transparent; color: #4A5163; font-size: 13px; font-family: inherit; cursor: pointer; white-space: nowrap; }
  .tt.on { background: #fff; color: #4B2596; font-weight: 700; }
  .codeview { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .code-top { padding: 8px 12px; background: #F4EFFD; border-bottom: 1px solid #E2D8F7; display: flex; flex-direction: column; gap: 6px; }
  .langs { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 4px; }
  .lang { min-height: 44px; border: 1px solid #C7CEDB; border-radius: 8px; background: #fff; color: #1F2433; font-family: inherit; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .lang b { font-size: 13px; } .lang span { font-size: 10px; }
  .lang.on { background: #855CD6; border-color: #855CD6; color: #fff; }
  .code-sprite { font-size: 12px; color: #4A5163; }
  .editor { flex: 1; min-height: 0; display: flex; background: #FBFCFE; border-bottom: 1px solid #E3E8EE; position: relative; }
  .gutter { margin: 0; padding: 10px 6px 10px 10px; min-width: 2.2em; text-align: right; color: #8A93A6; background: #F4F6FA; font-family: "Noto Sans Mono", "Menlo", "Consolas", "Osaka-Mono", "MS Gothic", monospace; font-size: 13px; line-height: 22px; overflow: hidden; user-select: none; white-space: pre; }
  .gutter .bad { color: #fff; background: #D9480F; border-radius: 3px; padding: 0 3px; }
  textarea.code { flex: 1; min-width: 0; border: none; outline: none; resize: none; padding: 10px; margin: 0; background: transparent; color: #1F2433; font-family: "Noto Sans Mono", "Menlo", "Consolas", "Osaka-Mono", "MS Gothic", monospace; font-size: 13px; line-height: 22px; white-space: pre; overflow: auto; tab-size: 4; min-height: 0; max-height: none; border-radius: 0; }
  textarea.code:focus { outline: 2px solid #855CD6; outline-offset: -2px; }
  .code-msg { margin: 8px 12px 0; padding: 8px 10px; border-radius: 8px; font-size: 13px; line-height: 1.6; }
  .code-msg.err { background: #FDECEA; border: 1px solid #F5C2BC; color: #8A1C14; }
  .code-msg.ok { background: #EAF7EF; border: 1px solid #BFE5CC; color: #136B3A; }
  .code-msg.info { background: #FFF8E1; border: 1px solid #F0D58C; color: #6B4A00; }
  .code-msg button { margin-left: 8px; }
  .code-foot { padding: 8px 12px 10px; display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
  .code-btns { display: flex; flex-wrap: wrap; gap: 6px; }
  .cbtn { min-height: 40px; padding: 0 12px; border: 1px solid #C7CEDB; background: #fff; border-radius: 8px; font-size: 13px; font-family: inherit; color: #1F2433; cursor: pointer; }
  .cbtn.primary { background: #855CD6; border-color: #855CD6; color: #fff; font-weight: 700; }
  .cbtn.try-run { border-color: #4CBF56; color: #2E7D32; font-weight: 700; }
  .cbtn.try-run.stop { background: #E5484D; border-color: #E5484D; color: #fff; }
  .cbtn:disabled { opacity: .5; cursor: not-allowed; }
  .code-note { font-size: 11px; color: #4A5163; line-height: 1.5; }
  .hl-box { position: fixed; border: 3px solid #D9480F; border-radius: 8px; pointer-events: none; }
  .hl-callout { position: fixed; pointer-events: auto; background: #FFF4E5; border: 2px solid #D9480F; color: #6B2A00; padding: 6px 8px 6px 10px; border-radius: 10px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(0,0,0,.15); max-width: 260px; }
  .hl-callout button { border: none; background: transparent; color: #6B2A00; cursor: pointer; font-size: 16px; line-height: 1; padding: 2px 4px; }

  /* ===== 全画面 ===== */
  .panel.full { inset: 0; border: none; border-radius: 0; box-shadow: none; background: #E9EEF2; }
  .topbar { height: 52px; flex-shrink: 0; background: #855CD6; color: #fff; display: flex; align-items: center; gap: 14px; padding: 0 14px; }
  .brand { font-weight: 700; font-size: 16px; white-space: nowrap; }
  .views { display: flex; background: rgba(255,255,255,.2); border-radius: 10px; padding: 3px; gap: 2px; }
  .views .tt { color: #fff; background: transparent; min-height: 32px; padding: 0 14px; border-radius: 8px; font-size: 14px; }
  .views .tt.on { background: #fff; color: #5A2FB0; font-weight: 700; }
  .topbar .code-sprite { margin-left: auto; font-size: 13px; color: #fff; opacity: .95; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .back { flex-shrink: 0; min-height: 36px; padding: 0 14px; border: none; border-radius: 8px; background: #fff; color: #5A2FB0; font-weight: 700; font-size: 14px; font-family: inherit; cursor: pointer; }
  .back:hover { background: #F4EFFD; }
  .main { flex: 1; min-height: 0; display: flex; gap: 12px; padding: 12px; }
  .codecol { flex: 1.55; min-width: 0; display: flex; flex-direction: column; background: #fff; border: 1px solid #D5DBE5; border-radius: 12px; overflow: hidden; }
  .side { flex: 1; min-width: 320px; display: flex; flex-direction: column; gap: 12px; }
  .stagebox { flex-shrink: 0; background: #fff; border: 1px solid #D5DBE5; border-radius: 12px; padding: 8px; }
  .stage-frame { width: 100%; aspect-ratio: 4 / 3; max-height: max(96px, min(30vh, 300px, calc(100vh - 520px))); margin: 0 auto; background: #fff; border: 1px solid #E3E7EE; border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  .stage-img { max-width: 100%; max-height: 100%; display: block; }
  .stage-cap { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding-top: 6px; font-size: 12px; color: #4A5163; }
  .sbtn { white-space: nowrap; min-height: 32px; padding: 0 10px; border: 1px solid #C7CEDB; border-radius: 8px; background: #fff; font-size: 13px; font-family: inherit; cursor: pointer; color: #1F2433; }
  .sbtn.flag { color: #2E7D32; border-color: #4CBF56; font-weight: 700; }
  .sbtn.stop { color: #C62828; border-color: #E5484D; font-weight: 700; }
  .stage-state { margin-left: auto; font-weight: 700; color: #2E7D32; }
  .sbtn.fold { min-height: 28px; font-size: 12px; color: #4A5163; }
  .stagebox.folded .stage-frame { display: none; }
  .stagebox.folded .stage-cap { padding-top: 0; }
  .chatcol .head .tabs { flex: 1; }
  .chatcol .head { padding: 8px 10px; }
  .chatcol .disclose { font-size: 11px; }
  .chatcol { flex: 1; min-height: 0; display: flex; flex-direction: column; background: #fff; border: 1px solid #D5DBE5; border-radius: 12px; overflow: hidden; }
  .panel.v-code .chatcol { display: none; }
  .panel.v-code .side { flex: 0 0 min(560px, 42vw); }
  .panel.v-code .stage-frame { max-height: calc(100vh - 170px); }
  .panel.v-ai .codecol { display: none; }
  .panel.v-ai .side { flex-direction: row; }
  .panel.v-ai .stagebox { flex: 0 0 42%; align-self: flex-start; }
  .panel.v-ai .stage-frame { max-height: none; }
  /* コード欄 */
  .code-top { flex-direction: row; align-items: center; justify-content: space-between; }
  .langs { display: flex; gap: 6px; }
  .lang { min-height: 38px; padding: 0 14px; flex-direction: row; gap: 6px; }
  .lang span { font-size: 11px; opacity: .85; }
  .fs { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #4A5163; }
  .fsb { min-width: 34px; min-height: 30px; border: 1px solid #C7CEDB; border-radius: 6px; background: #fff; font-weight: 700; font-family: inherit; cursor: pointer; color: #1F2433; }
  .editor { --fs: 15px; --lh: 26px; }
  .gutter { font-size: var(--fs); line-height: var(--lh); padding: 12px 10px 12px 12px; min-width: 3em; }
  .edwrap { flex: 1; min-width: 0; position: relative; overflow: hidden; }
  .edwrap .hl, .edwrap textarea.code { position: absolute; inset: 0; margin: 0; padding: 12px 16px; border: none; font-family: "Noto Sans Mono CJK JP", "Noto Sans Mono", "Menlo", "Consolas", "Osaka-Mono", "MS Gothic", monospace; font-size: var(--fs); line-height: var(--lh); white-space: pre; tab-size: 4; letter-spacing: 0; font-variant-ligatures: none; }
  .gutter { font-family: "Noto Sans Mono CJK JP", "Noto Sans Mono", "Menlo", "Consolas", "Osaka-Mono", "MS Gothic", monospace; }
  .edwrap .hl { overflow: hidden; pointer-events: none; color: #1F2433; }
  .edwrap .hl code { display: block; font: inherit; will-change: transform; }
  .edwrap textarea.code { color: transparent; -webkit-text-fill-color: transparent; caret-color: #1F2433; background: transparent; overflow: auto; }
  .edwrap textarea.code::selection { background: rgba(133,92,214,.28); -webkit-text-fill-color: transparent; }
  .edwrap textarea.code:focus { outline: none; }
  .editor:focus-within { box-shadow: inset 0 0 0 2px #855CD6; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; padding: 7px 12px; border-top: 1px solid #E3E7EE; font-size: 12px; color: #4A5163; }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; }
  .edwrap .hl .ln { display: block; min-height: var(--lh); }
  .edwrap .hl .ln.bad { background: rgba(229,72,77,.14); }
  .legend .zl { color: #E5484D; font-weight: 700; }
  /* 色（白い背景：DNCL） */
  .k-ev { color: #A87600; font-weight: 700; } .k-ct { color: #C76E00; font-weight: 700; } .k-mo { color: #2F6FD6; } .k-lo { color: #7A4CD9; } .k-sn { color: #B03FB0; }
  .k-se { color: #23839F; } .k-op { color: #2E8F38; } .k-va { color: #D96A00; } .k-li { color: #D9531A; } .k-pe { color: #0B8F6A; } .k-fn { color: #DB3B63; font-weight: 700; }
  .k-st { color: #4A5163; } .k-nu { color: #1F2433; } .k-cm { color: #8A93A3; } .k-mk { color: #B8C0CC; }
  .k-zen { color: #E5484D !important; font-weight: 700; text-decoration: underline wavy #E5484D; }
  /* Python：黒っぽい背景 */
  .codecol.dark { background: #1E1F22; border-color: #2B2D31; }
  .codecol.dark .code-top { background: #26282C; border-color: #2B2D31; }
  .codecol.dark .lang { background: #2B2D31; border-color: #3A3D44; color: #D7DAE0; }
  .codecol.dark .lang.on { background: #855CD6; border-color: #855CD6; color: #fff; }
  .codecol.dark .fs { color: #AEB4BE; } .codecol.dark .fsb { background: #2B2D31; border-color: #3A3D44; color: #D7DAE0; }
  .codecol.dark .editor { background: #1E1F22; border-color: #2B2D31; }
  .codecol.dark .gutter { background: #18191C; color: #5F6670; }
  .codecol.dark .edwrap .hl { color: #D7DAE0; }
  .codecol.dark .edwrap textarea.code { caret-color: #F5F6F8; }
  .codecol.dark .edwrap textarea.code::selection { background: rgba(160,130,255,.35); }
  .codecol.dark .legend { border-color: #2B2D31; color: #AEB4BE; }
  .codecol.dark .code-foot { background: #1E1F22; } .codecol.dark .code-note { color: #8F96A3; }
  .codecol.dark .cbtn { background: #2B2D31; border-color: #3A3D44; color: #D7DAE0; }
  .codecol.dark .cbtn.primary { background: #855CD6; border-color: #855CD6; color: #fff; }
  .codecol.dark .cbtn.try-run { color: #7EE08A; border-color: #4CBF56; }
  .codecol.dark .cbtn.try-run.stop { background: #E5484D; border-color: #E5484D; color: #fff; }
  .codecol.dark .k-ev { color: #FFCC33; } .codecol.dark .k-ct { color: #FFB547; } .codecol.dark .k-mo { color: #6AA8FF; } .codecol.dark .k-lo { color: #B48CFF; }
  .codecol.dark .k-sn { color: #E08AE0; } .codecol.dark .k-se { color: #6FC8E8; } .codecol.dark .k-op { color: #74D67E; } .codecol.dark .k-va { color: #FFA04D; }
  .codecol.dark .k-li { color: #FF8A5C; } .codecol.dark .k-pe { color: #3FD9A8; } .codecol.dark .k-fn { color: #FF7A99; } .codecol.dark .k-st { color: #C3E88D; }
  .codecol.dark .k-nu { color: #F5F6F8; } .codecol.dark .k-cm { color: #6B7280; } .codecol.dark .k-mk { color: #4A4F57; }
  .codecol.dark .k-zen { color: #FF6B6B !important; text-decoration-color: #FF6B6B; }
  .spr { display: flex; align-items: center; gap: 6px; margin-left: auto; font-size: 13px; color: #fff; white-space: nowrap; }
  .sprite-sel { max-width: 180px; min-height: 32px; border: none; border-radius: 8px; padding: 0 8px; font-size: 14px; font-family: inherit; color: #1F2433; background: #fff; }
  .topbar .code-sprite { margin-left: 8px; }
  .stage-frame { position: relative; cursor: pointer; }
  .stage-frame:focus { outline: 3px solid #855CD6; outline-offset: 1px; }
  .stage-ask { position: absolute; left: 8px; right: 8px; bottom: 8px; background: #fff; border: 2px solid #855CD6; border-radius: 10px; padding: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.18); display: flex; flex-direction: column; gap: 6px; cursor: default; }
  .stage-ask .sq { font-size: 14px; font-weight: 700; color: #4B2596; }
  .sa-row { display: flex; gap: 6px; }
  .sa-in { flex: 1; min-width: 0; min-height: 34px; border: 1px solid #C7CEDB; border-radius: 8px; padding: 0 10px; font-size: 15px; font-family: inherit; }
  /* 太字は文字の幅が変わることがあるので、色分けの上では線の太さで強調する（カーソルがずれないように） */
  .edwrap .hl .k-ev, .edwrap .hl .k-ct, .edwrap .hl .k-fn, .edwrap .hl .k-zen { font-weight: 400 !important; -webkit-text-stroke: 0.45px currentColor; }
  /* 画面の高さが低いPC（ノートPCなど）では、相談の欄が狭くならないように詰める */
  @media (max-height: 760px) {
    .panel.full .quick { display: none; }
    .panel.full .disclose { font-size: 10px; line-height: 1.3; }
    .panel.full .inrow textarea { min-height: 44px; }
    .panel.full .send, .panel.full .mic { min-height: 44px; }
    .panel.full .chatcol .head { padding: 6px 8px; gap: 4px; }
    .panel.full .lv { min-height: 30px; }
    .panel.full .tab { min-height: 28px; }
    .panel.full .main { padding: 8px; gap: 8px; }
    .panel.full .side { gap: 8px; }
    .panel.full .code-note { display: none; }
    .panel.full .legend { padding: 4px 12px; }
  }
  .hidden { display: none !important; }
  `;

  const ICON_CHAT = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"></path><path d="M9 11h.01"></path><path d="M12 11h.01"></path><path d="M15 11h.01"></path></svg>';
  const ICON_X = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"></path><path d="M18 6L6 18"></path></svg>';
  const ICON_WIDE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 7l-5 5 5 5"></path><path d="M16 7l5 5-5 5"></path></svg>';
  const ICON_GEAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path></svg>';
  const ICON_MIC = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path></svg>';
  const ICON_SPEAK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z"></path><path d="M15.5 8.5a5 5 0 0 1 0 7"></path><path d="M18.5 5.5a9 9 0 0 1 0 13"></path></svg>';
  const ICON_SEND = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path></svg>';

  const host = document.createElement('div');
  host.id = 'block-ai-assistant-root';
  const root = host.attachShadow({ mode: 'open' });
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(STYLE);
    root.adoptedStyleSheets = [sheet];
  } catch (e) {
    const st = document.createElement('style');
    st.textContent = STYLE;
    root.appendChild(st);
  }

  const layer = document.createElement('div');
  layer.className = 'layer';
  layer.innerHTML = `
    <button class="fab hidden" aria-label="AIアシスタントを開く">${ICON_CHAT}</button>
    <div class="hl-layer"></div>
    <section class="panel full hidden" aria-label="AIアシスタント">
      <header class="topbar">
        <span class="brand">ブロックAIアシスタント</span>
        <div class="views" role="tablist" aria-label="表示">
          <button class="tt" data-view="both" role="tab">コード ＋ AI</button>
          <button class="tt" data-view="code" role="tab">コードだけ</button>
          <button class="tt" data-view="ai" role="tab">AIだけ</button>
        </div>
        <label class="spr">スプライト <select class="sprite-sel" aria-label="スプライトをえらぶ"></select></label>
        <span class="code-sprite"></span>
        <button class="back close" type="button">✕ Scratchにもどる</button>
      </header>
      <div class="main">
        <div class="codecol">
          <div class="code-top">
            <div class="langs" role="group" aria-label="書き方">
              <button class="lang on" data-lang="dncl"><b>DNCL</b><span>共通テスト用</span></button>
              <button class="lang" data-lang="py"><b>Python</b><span>本物の言語</span></button>
            </div>
            <div class="fs"><span>文字の大きさ</span><button class="fsb" data-d="-1" aria-label="文字を小さく">A−</button><button class="fsb" data-d="1" aria-label="文字を大きく">A＋</button></div>
          </div>
          <div class="editor">
            <pre class="gutter" aria-hidden="true"></pre>
            <div class="edwrap">
              <pre class="hl" aria-hidden="true"></pre>
              <textarea class="code" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="コード"></textarea>
            </div>
          </div>
          <div class="legend" aria-hidden="true"></div>
          <div class="code-msg hidden"></div>
          <div class="code-foot">
            <div class="code-btns">
              <button class="cbtn primary to-blocks">ブロックにする</button>
              <button class="cbtn try-run">▶ ためしに動かす</button>
              <button class="cbtn from-blocks">ブロックから読みこむ</button>
              <button class="cbtn copy-code">コピー</button>
              <button class="cbtn ask-code">AIに聞く</button>
            </div>
            <div class="code-note">「ブロックにする」で、このスプライトのスクリプトが置きかわります（「元にもどす」で戻せます）。「ためしに動かす」は作品を変えずに動きだけ見られます。Tabで字下げ、Enterで次の行も同じ深さ。</div>
          </div>
        </div>
        <div class="side">
          <div class="stagebox">
            <div class="stage-frame" tabindex="0" title="クリックやキーでも動かせます">
              <img class="stage-img" alt="ステージ" draggable="false">
              <div class="stage-ask hidden">
                <div class="sq"></div>
                <div class="sa-row"><input class="sa-in" type="text" placeholder="答えを書いて Enter" autocomplete="off"><button class="sbtn sa-ok" type="button">OK</button></div>
              </div>
            </div>
            <div class="stage-cap">
              <button class="sbtn flag" type="button" title="緑の旗">▶ 緑の旗</button>
              <button class="sbtn stop" type="button" title="止める">■ 止める</button>
              <span class="stage-state"></span>
              <button class="sbtn fold" type="button" aria-expanded="true">▲ たたむ</button>
            </div>
          </div>
          <div class="chatcol">
            <div class="head">
        <div class="levels" role="group" aria-label="手伝いのレベル"></div>
        <div class="row">
          <div class="tabs">
            <button class="tab" data-mode="chat">相談する</button>
            <button class="tab" data-mode="debug">バグを調べる</button>
          </div>
          <div class="row" style="gap:2px;flex-shrink:0">
            <button class="linkbtn newchat" type="button">新しい会話</button>
            <button class="icon-btn gear" aria-label="表示のせってい" title="ことば・読み上げ">${ICON_GEAR}</button>
          </div>
        </div>
        <div class="prefs hidden">
          <div class="pref-row"><span class="pref-label">ことば</span>
            <div class="seg3">
              <button class="kb" data-k="normal">ふつう</button>
              <button class="kb" data-k="furigana">ふりがな</button>
              <button class="kb" data-k="hiragana">ひらがな</button>
            </div>
          </div>
          <label class="pref-row chk"><input type="checkbox" class="autoread">返事を自動で読み上げる</label>
        </div>
            </div>
            <div class="plan hidden">
              <button class="plan-head" type="button"><span class="plan-title"></span><span class="plan-count"></span></button>
              <ol class="plan-list"></ol>
            </div>
            <div class="msgs" aria-live="polite"></div>
            <div class="foot">
              <div class="closed-time hidden">
                <div class="ct-text"></div>
                <div class="unlock-row">
                  <input class="unlock-pw" type="password" aria-label="先生用パスワード" placeholder="先生用パスワード" autocomplete="off">
                  <button class="btn unlock-btn" type="button">解除</button>
                </div>
                <div class="unlock-msg"></div>
              </div>
              <div class="unlocked-note hidden"><span>パスワードで解除中（今日まで）</span>
                <button class="linkbtn relock" type="button">ロックに戻す</button>
              </div>
              <div class="quick">
                <button class="q" data-q="debug">動かない原因を調べて</button>
                <button class="q" data-q="next">次は何をすればいい？</button>
                <button class="q" data-q="praise">作品を見て</button>
              </div>
              <div class="quota hidden"></div>
              <div class="inrow">
                <button class="mic hidden" aria-label="声で入力" title="声で入力">${ICON_MIC}</button>
                <textarea rows="2" aria-label="AIへのメッセージ" placeholder="こまっていることを書いてね（Enterで送る／Shift＋Enterで改行）"></textarea>
                <button class="send" aria-label="送信">${ICON_SEND}</button>
              </div>
              <div class="disclose">AIのアシスタントです（人ではありません）。まちがえることもあるよ。名前や住所は書かないでね。</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
  root.appendChild(layer);
  (document.body || document.documentElement).appendChild(host);

  const $ = (sel) => layer.querySelector(sel);
  const fab = $('.fab');
  const panel = $('.panel');
  const msgs = $('.msgs');
  const input = $('.inrow textarea');
  const sendBtn = $('.send');
  const hlLayer = $('.hl-layer');

  let open = false;
  let view = 'both'; // both（コード＋AI）/ code / ai
  let mode = 'chat';
  let busy = false;
  let history = [];
  let editorRect = null;

  // ---------------------------------------------------------------
  // 位置合わせ（コードを置く場所の右側に出す）
  // ---------------------------------------------------------------
  // 枠の中では、いつも全画面で表示する（Scratchのボタンは拡張機能が出す）
  function layout() {
    checkProjectChange();
    fab.classList.add('hidden');
    hlLayer.classList.add('hidden');
    panel.classList.toggle('hidden', !open);
  }

  // Scratchの上のバーがはみ出さないように、「チュートリアル」「Debug」をかくす
  const HIDE_MENU = ['チュートリアル', 'Tutorials', 'Debug', 'デバッグ', 'でばっぐ', 'ちゅーとりある'];
  function hideMenuItems() {
    const bar = document.querySelector('[class*="menu-bar_main-menu"]');
    if (!bar) return;
    bar.querySelectorAll('[class*="menu-bar_menu-bar-item"]').forEach((el) => {
      if (el.dataset.blockAiHidden) return;
      const t = (el.textContent || '').trim();
      if (HIDE_MENU.includes(t)) { el.style.display = 'none'; el.dataset.blockAiHidden = '1'; }
    });
  }

  function addMenuButton() {
    const bar = document.querySelector('[class*="menu-bar_main-menu"]');
    if (!bar || bar.querySelector('.block-ai-menu-btn')) return;
    const b = document.createElement('button');
    b.className = 'block-ai-menu-btn';
    b.type = 'button';
    b.textContent = 'AIに聞く';
    b.style.cssText = 'margin:0 4px;height:32px;padding:0 10px;border:none;border-radius:8px;background:#fff;color:#5A2FB0;font-weight:700;font-size:13px;cursor:pointer;align-self:center;font-family:inherit;white-space:nowrap;flex-shrink:0;';
    b.addEventListener('click', () => { if (view === 'code') setView('both'); setOpen(true); });
    bar.appendChild(b);
    const cb = document.createElement('button');
    cb.className = 'block-ai-menu-btn block-ai-code-btn';
    cb.type = 'button';
    cb.textContent = 'コードで見る';
    cb.style.cssText = b.style.cssText;
    cb.addEventListener('click', () => { if (view === 'ai') setView('both'); setOpen(true); });
    bar.appendChild(cb);
  }

  function setOpen(v) {
    // ためしに動かしている途中で閉じたら、止めて元にもどす（Scratchの画面で作業した分を消さないため）
    if (!v && codeState.trial) endTrial('全画面を閉じたので、止めて元にもどしたよ。');
    open = v;
    layout();
    if (!v) HOST.post({ kind: 'close' });
    if (open) {
      renderControls();
      if (!loadedKey) restoreOrGreet();
      if (!alive()) addReload();
      if (view !== 'ai') loadCode(true);
      if (view === 'ai') setTimeout(() => input.focus(), 50);
      stageLoop();
    }
  }

  fab.addEventListener('click', () => setOpen(true));
  $('.close').addEventListener('click', () => setOpen(false));
  window.addEventListener('resize', layout);
  setInterval(layout, 700);

  // ---------------------------------------------------------------
  // コードタブ（ブロック ⇄ DNCL／Python）
  // ---------------------------------------------------------------
  const BC = window.BlockCode;
  const codeCol = layer.querySelector('.codecol');
  const hlPre = layer.querySelector('pre.hl');
  const editorEl = layer.querySelector('.editor');
  const codeTa = layer.querySelector('textarea.code');
  const gutter = layer.querySelector('.gutter');
  const codeMsg = layer.querySelector('.code-msg');
  const codeState = { sprite: '', used: [], sig: '', dirty: false, loading: false, errLine: 0, reloadArmed: 0, functions: {}, trial: null, lists: [], base: 0 };
  // 配列の添字（0から／1から）は作品ごとに覚えておく
  function baseKey() { return 'arrayBase:' + hostPath().replace(/\/editor\/?$/, ''); }
  let baseLoadedFor = '';
  function loadBase() {
    const k = baseKey();
    if (baseLoadedFor === k || !alive()) return Promise.resolve();
    return new Promise((res) => {
      try {
        chrome.storage.local.get('arrayBase', (r) => { const m = (r && r.arrayBase) || {}; codeState.base = m[k] === 1 ? 1 : 0; baseLoadedFor = k; res(); });
      } catch (e) { res(); }
    });
  }
  function saveBase(b) {
    codeState.base = b === 1 ? 1 : 0;
    if (!alive()) return;
    try { chrome.storage.local.get('arrayBase', (r) => { const m = (r && r.arrayBase) || {}; m[baseKey()] = codeState.base; chrome.storage.local.set({ arrayBase: m }); }); } catch (e) { /* noop */ }
  }
  const codeOpts = () => ({ functions: codeState.functions, lists: codeState.lists, base: codeState.base });
  const LANG_NAME = { dncl: 'DNCL（共通テスト用プログラム表記）', py: 'Python' };
  const codeLang = () => (settings.codeLang === 'py' ? 'py' : 'dncl');

  function setView(v) {
    if (!['both', 'code', 'ai'].includes(v)) v = 'both';
    const was = view;
    view = v;
    panel.classList.toggle('v-code', v === 'code');
    panel.classList.toggle('v-ai', v === 'ai');
    layer.querySelectorAll('.tt').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
    layer.querySelectorAll('.lang').forEach((b) => b.classList.toggle('on', b.dataset.lang === codeLang()));
    applyTheme();
    layout();
    if (v !== 'ai' && open && (was === 'ai' || !codeState.sig)) loadCode(true);
    if (v === 'ai' && open) setTimeout(() => input.focus(), 50);
  }

  // ---- 色分け・テーマ・文字の大きさ ----
  const LEGEND = [['ev', 'イベント', '#FFBF00'], ['ct', '制御', '#FFAB19'], ['mo', '動き', '#4C97FF'], ['lo', '見た目', '#9966FF'], ['sn', '音', '#CF63CF'],
    ['se', '調べる', '#5CB1D6'], ['op', '演算', '#59C059'], ['va', '変数', '#FF8C1A'], ['li', 'リスト', '#FF661A'], ['pe', 'ペン', '#0FBD8C'], ['fn', '関数（定義ブロック）', '#FF6680']];
  (function buildLegend() {
    const lg = layer.querySelector('.legend');
    LEGEND.forEach((x) => {
      const sp = document.createElement('span');
      const i = document.createElement('i');
      i.style.background = x[2];
      sp.appendChild(i);
      sp.appendChild(document.createTextNode(x[1]));
      lg.appendChild(sp);
    });
    const z = document.createElement('span');
    z.className = 'zl';
    z.textContent = '１０ ＝ 全角（まちがい）';
    lg.appendChild(z);
  })();

  function applyTheme() {
    codeCol.classList.toggle('dark', codeLang() === 'py');
  }

  function applyFont() {
    const fs = Math.max(12, Math.min(24, Number(settings.codeFont) || 15));
    editorEl.style.setProperty('--fs', fs + 'px');
    editorEl.style.setProperty('--lh', Math.round(fs * 1.7) + 'px');
    syncScroll();
  }
  layer.querySelectorAll('.fsb').forEach((b) => b.addEventListener('click', () => {
    settings.codeFont = Math.max(12, Math.min(24, (Number(settings.codeFont) || 15) + Number(b.dataset.d)));
    save({ codeFont: settings.codeFont });
    applyFont();
  }));

  let paintQueued = false;
  function paintCode() {
    paintQueued = false;
    const rows = BC.highlight ? BC.highlight(codeTa.value, codeLang(), codeOpts()) : codeTa.value.split('\n').map((l) => [{ c: '', s: l }]);
    const code = document.createElement('code');
    rows.forEach((toks, i) => {
      const ln = document.createElement('div');
      ln.className = 'ln' + (i + 1 === codeState.errLine ? ' bad' : '');
      toks.forEach((t) => {
        if (!t.c) { ln.appendChild(document.createTextNode(t.s)); return; }
        const sp = document.createElement('span');
        sp.className = 'k-' + t.c;
        sp.textContent = t.s;
        ln.appendChild(sp);
      });
      if (!toks.length) ln.appendChild(document.createTextNode('\u200b'));
      code.appendChild(ln);
    });
    hlPre.innerHTML = '';
    hlPre.appendChild(code);
    syncScroll();
  }
  function queuePaint() {
    if (paintQueued) return;
    paintQueued = true;
    requestAnimationFrame(paintCode);
  }
  function syncScroll() {
    const c = hlPre.firstChild;
    if (c) c.style.transform = 'translate(' + (-codeTa.scrollLeft) + 'px,' + (-codeTa.scrollTop) + 'px)';
    gutter.scrollTop = codeTa.scrollTop;
  }
  layer.querySelectorAll('.tt').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

  function updateGutter() {
    const count = Math.max(1, codeTa.value.split('\n').length);
    gutter.innerHTML = '';
    for (let i = 1; i <= count; i++) {
      if (i === codeState.errLine) {
        const sp = document.createElement('span');
        sp.className = 'bad';
        sp.textContent = String(i);
        gutter.appendChild(sp);
      } else gutter.appendChild(document.createTextNode(String(i)));
      if (i < count) gutter.appendChild(document.createTextNode('\n'));
    }
    gutter.scrollTop = codeTa.scrollTop;
    queuePaint();
  }
  codeTa.addEventListener('scroll', syncScroll);

  // 上書きの確認用：動かしただけ（位置だけ）の変化は数えない
  function editSig(d) {
    return d.sprite + '|' + JSON.stringify((d.scripts || []).map((sc) => JSON.stringify(sc.blocks)).sort());
  }

  function codeMessage(kind, text, button) {
    codeMsg.className = 'code-msg ' + kind;
    codeMsg.textContent = text;
    if (button) codeMsg.appendChild(button);
    codeMsg.classList.toggle('hidden', !text);
  }

  function renderCode(data, keepMsg) {
    codeState.functions = data.functions || {};
    codeState.lists = data.lists || [];
    const r = BC.toCode(data.scripts, codeLang(), codeOpts());
    codeTa.value = r.text;
    codeState.sprite = data.sprite;
    codeState.used = r.used;
    codeState.sig = data.sprite + '|' + JSON.stringify(data.scripts);
    codeState.esig = editSig(data);
    codeState.dirty = false;
    codeState.errLine = 0;
    layer.querySelector('.code-sprite').textContent = '書き方：' + LANG_NAME[codeLang()];
    fillSprites(data);
    updateGutter();
    if (!keepMsg) {
      if (r.skipped.length) codeMessage('info', 'コードにできないブロック（自作ブロックや、「〜とき」がないブロックのかたまりなど）があるスクリプトが ' + r.skipped.length + ' 個あります。それはブロックのまま残ります。');
      else codeMessage('', '');
    }
  }

  async function loadCode(force, keepMsg) {
    if (codeState.loading) return;
    if (!force && codeState.dirty) return;
    codeState.loading = true;
    try {
      await loadBase();
      const data = await bridge('getScripts', {}, 5000);
      if (!force && codeState.dirty) return;
      const sig = data.sprite + '|' + JSON.stringify(data.scripts);
      if (force || sig !== codeState.sig) renderCode(data, keepMsg);
      else { codeState.functions = data.functions || {}; codeState.lists = data.lists || []; }
    } catch (e) {
      codeMessage('err', 'スクリプトを読みこめませんでした（' + e.message + '）');
    } finally {
      codeState.loading = false;
    }
  }
  // ブロックが変わったら（別のスプライトを選んだときも）、コードも新しくする。書きかえ中は変えない
  setInterval(() => { if (open && view !== 'ai' && !codeState.dirty && !busy && !codeState.trial) loadCode(false, true); }, 1500);

  // どこも選んでいないときの Ctrl/Cmd+Z が、コード欄を勝手に元にもどさないようにする
  let beforeHistory = null;
  const codeFocused = () => codeTa.getRootNode().activeElement === codeTa;
  codeTa.addEventListener('beforeinput', (e) => {
    if (/^history(Undo|Redo)$/.test(e.inputType || '') && !codeFocused()) { beforeHistory = codeTa.value; e.preventDefault(); }
  });
  codeTa.addEventListener('input', (e) => {
    if (/^history(Undo|Redo)$/.test(e.inputType || '') && !codeFocused()) {
      if (beforeHistory !== null) { codeTa.value = beforeHistory; queuePaint(); }
      beforeHistory = null;
      return;
    }
    codeState.dirty = true;
    if (codeState.errLine) { codeState.errLine = 0; }
    if (codeMsg.classList.contains('err')) codeMessage('', '');
    updateGutter();
  });

  function lineStart(text, pos) { return text.lastIndexOf('\n', pos - 1) + 1; }

  codeTa.addEventListener('keydown', (e) => {
    e.stopPropagation(); // Scratchのショートカットに反応させない
    const unit = codeLang() === 'py' ? '    ' : '| ';
    const v = codeTa.value;
    const st = codeTa.selectionStart;
    const en = codeTa.selectionEnd;
    if (e.key === 'Tab') {
      e.preventDefault();
      const ls = lineStart(v, st);
      if (e.shiftKey) {
        const line = v.slice(ls);
        const m = codeLang() === 'py' ? /^ {1,4}/.exec(line) : /^(\| |\|)/.exec(line);
        if (m) {
          codeTa.value = v.slice(0, ls) + v.slice(ls + m[0].length);
          codeTa.selectionStart = codeTa.selectionEnd = Math.max(ls, st - m[0].length);
        }
      } else {
        codeTa.value = v.slice(0, ls) + unit + v.slice(ls);
        codeTa.selectionStart = st + unit.length;
        codeTa.selectionEnd = en + unit.length;
      }
      codeTa.dispatchEvent(new Event('input'));
      return;
    }
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      const ls = lineStart(v, st);
      const line = v.slice(ls, st);
      let prefix = codeLang() === 'py' ? /^ */.exec(line)[0] : /^[|｜└⎿│ 　]*/.exec(line)[0].replace(/[└⎿]/g, '|');
      const body = line.replace(/#.*$/, '').trim();
      if (/[:：]$/.test(body)) prefix += unit;
      const ins = '\n' + prefix;
      codeTa.value = v.slice(0, st) + ins + v.slice(en);
      codeTa.selectionStart = codeTa.selectionEnd = st + ins.length;
      codeTa.dispatchEvent(new Event('input'));
    }
  });
  codeTa.addEventListener('keyup', (e) => e.stopPropagation());

  function showCodeError(err) {
    codeState.errLine = err.line;
    updateGutter();
    codeMessage('err', err.line + '行目：' + err.msg);
    // その行へ移動
    const lines = codeTa.value.split('\n');
    let pos = 0;
    for (let i = 0; i < err.line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
    codeTa.focus();
    codeTa.selectionStart = pos;
    codeTa.selectionEnd = pos + (lines[err.line - 1] || '').length;
    const lh = parseFloat(getComputedStyle(codeTa).lineHeight) || 22;
    codeTa.scrollTop = Math.max(0, (err.line - 3) * lh);
  }

  layer.querySelectorAll('.lang').forEach((b) => b.addEventListener('click', () => {
    const to = b.dataset.lang;
    const from = codeLang();
    if (to === from) return;
    if (codeState.dirty) {
      // 書きかえた内容をたもったまま、書き方だけ変える
      const r = BC.parse(codeTa.value, from, codeOpts());
      if (r.error) { showCodeError(r.error); codeMessage('err', 'いまのコードにまちがいがあるので切りかえられません。' + r.error.line + '行目：' + r.error.msg); return; }
      if (r.base !== codeState.base) saveBase(r.base);
      settings.codeLang = to;
      save({ codeLang: to });
      const out = BC.toCode(r.scripts.map((sc, i) => ({ topId: 'new' + i, blocks: sc.blocks })), to, codeOpts());
      codeTa.value = out.text;
      codeState.errLine = 0;
      updateGutter();
      layer.querySelectorAll('.lang').forEach((x) => x.classList.toggle('on', x.dataset.lang === to));
      applyTheme();
      layer.querySelector('.code-sprite').textContent = '書き方：' + LANG_NAME[to] + '（書きかえ中）';
      codeMessage('info', '書きかえ中のコードを ' + LANG_NAME[to] + ' に切りかえました。まだブロックにはなっていません。');
      return;
    }
    settings.codeLang = to;
    save({ codeLang: to });
    layer.querySelectorAll('.lang').forEach((x) => x.classList.toggle('on', x.dataset.lang === to));
    applyTheme();
    loadCode(true);
  }));

  // コードを読む。知らない関数なら「AIに作ってもらう」ボタンを出す
  function parseCode() {
    const r = BC.parse(codeTa.value, codeLang(), codeOpts());
    if (!r.error && r.base !== codeState.base) saveBase(r.base);
    if (r.error) {
      showCodeError(r.error);
      if (r.error.extra && r.error.extra.kind === 'unknown_function') {
        const fb = document.createElement('button');
        fb.className = 'cbtn primary';
        fb.textContent = '「' + r.error.extra.name + '」をAIに作ってもらう';
        fb.addEventListener('click', () => makeFunctionByAI(r.error.extra, fb));
        codeMessage('err', r.error.line + '行目：' + r.error.msg + '　Scratchにない計算は、AIが「定義ブロック」として作れます。', fb);
      }
      return null;
    }
    return r;
  }

  // 使った関数のうち、まだ作品にない用意済みのもの（べき乗・最大・最小）を定義ブロックにする
  async function defineMissing(used) {
    const made = [];
    for (const name of used || []) {
      if (codeState.functions[name]) continue;
      const bi = BC.builtinFunction(name);
      if (!bi) throw new Error('関数「' + name + '」がありません');
      await bridge('defineFunction', { sprite: codeState.sprite, name: bi.name, params: bi.params, body: bi.body }, 15000);
      codeState.functions[name] = { params: bi.params };
      made.push(name);
    }
    return made;
  }

  let forceOverwrite = false;
  layer.querySelector('.to-blocks').addEventListener('click', async () => {
    if (busy || codeState.trial) return;
    const lang = codeLang();
    const r = parseCode();
    if (!r) return;
    const btn = layer.querySelector('.to-blocks');
    // コードを読みこんだあとに、ブロックのほうが変わっていないか（AIや自分がブロックを直したなど）
    if (!forceOverwrite) {
      try {
        const now = await bridge('getScripts', {}, 5000);
        if (codeState.esig && editSig(now) !== codeState.esig) {
          const ob = document.createElement('button');
          ob.className = 'cbtn primary';
          ob.textContent = 'それでも上書きする';
          ob.addEventListener('click', () => { forceOverwrite = true; btn.click(); });
          codeMessage('info', 'コードを読みこんだあとに、ブロックのほうが変わっています。上書きすると、その変更は消えます（「元にもどす」で戻せます）。', ob);
          return;
        }
      } catch (e) { /* noop */ }
    }
    forceOverwrite = false;
    btn.disabled = true;
    try {
      const token = (await bridge('snapshot')).token;
      const made = await defineMissing(r.used);
      const res = await bridge('replaceScripts', { sprite: codeState.sprite, removeTopIds: codeState.used, scripts: r.scripts }, 30000);
      const ub = document.createElement('button');
      ub.className = 'cbtn';
      ub.textContent = '元にもどす';
      ub.addEventListener('click', async () => {
        ub.disabled = true;
        try { await bridge('undo', { token }); codeMessage('ok', '元にもどしました。'); loadCode(true, true); } catch (e) { codeMessage('err', '元にもどせませんでした（' + e.message + '）'); }
      });
      codeMessage('ok', 'ブロックにしたよ！（' + r.scripts.length + 'スクリプト' + (res.created.length ? '、新しく作った：' + res.created.join('、') : '') +
        (made.length ? '、定義ブロック：' + made.join('、') : '') + '）', ub);
      codeState.dirty = false;
      await loadCode(true, true);
      sendLog({ type: 'code', student: codeTa.value.slice(0, 3000), ai: '', tools: 'ブロックにする（' + LANG_NAME[lang] + '）', errors: '' });
    } catch (e) {
      codeMessage('err', 'ブロックにできませんでした：' + e.message);
    } finally {
      btn.disabled = false;
    }
  });

  // ためしに動かす：いまのコードで緑の旗を押し、止まったら（または止めたら）元にもどす
  const tryBtn = layer.querySelector('.try-run');
  async function endTrial(msg) {
    const t = codeState.trial;
    if (!t) return;
    codeState.trial = null;
    clearInterval(t.timer);
    try { await bridge('stopAll'); } catch (e) { /* noop */ }
    try { await bridge('undo', { token: t.token }); } catch (e) { codeMessage('err', '元にもどせませんでした（' + e.message + '）'); }
    tryBtn.textContent = '▶ ためしに動かす';
    tryBtn.classList.remove('stop');
    layer.querySelector('.to-blocks').disabled = false;
    codeMessage('ok', msg || '止めて、元にもどしたよ。作品は変わっていません。');
  }
  tryBtn.addEventListener('click', async () => {
    if (codeState.trial) { endTrial(); return; }
    if (busy) return;
    const r = parseCode();
    if (!r) return;
    if (!r.scripts.some((sc) => sc.blocks[0] && sc.blocks[0].opcode === 'event_whenflagclicked')) {
      codeMessage('info', '「緑の旗が押されたとき」で始まるスクリプトがないので、ためしに動かせません。');
      return;
    }
    tryBtn.disabled = true;
    try {
      const token = (await bridge('snapshot')).token;
      codeState.trial = { token, timer: 0, start: Date.now() };
      try {
        const saveFns = Object.assign({}, codeState.functions);
        await defineMissing(r.used);
        codeState.functions = saveFns;
        await bridge('replaceScripts', { sprite: codeState.sprite, removeTopIds: codeState.used, scripts: r.scripts }, 30000);
        await bridge('greenFlag');
      } catch (e) {
        await endTrial('ためしに動かせませんでした：' + e.message);
        codeMessage('err', 'ためしに動かせませんでした：' + e.message);
        return;
      }
      tryBtn.textContent = '■ 止めて元にもどす';
      tryBtn.classList.add('stop');
      layer.querySelector('.to-blocks').disabled = true;
      codeMessage('info', 'ためしに動かしています。終わると自動で元にもどります（ずっと動くときは「止めて元にもどす」を押してね）。');
      codeState.trial.timer = setInterval(async () => {
        const t = codeState.trial;
        if (!t) return;
        try {
          const n = (await bridge('threadCount')).n;
          if (n === 0 && Date.now() - t.start > 600) endTrial('動き終わったので、元にもどしたよ。作品は変わっていません。');
        } catch (e) { /* noop */ }
      }, 500);
    } finally {
      tryBtn.disabled = false;
    }
  });

  // 知らない関数を、AIに定義ブロックとして作ってもらう
  async function makeFunctionByAI(info, btn) {
    if (busy) return;
    if (!alive()) { addReload(); return; }
    if (!allowedNow()) { codeMessage('err', 'いまはAIを使えない時間です。'); return; }
    btn.disabled = true;
    btn.textContent = 'AIが作っています…';
    const sys = [
      'あなたは、Scratchの「定義ブロック」に変換するための関数を書くアシスタントです。',
      '子どもがコードの中で「' + info.name + '」という関数を引数 ' + info.argc + ' 個で使いました。名前から意味を考えて、その関数をPythonで1つだけ書いてください。',
      '# きまり（必ず守る）',
      '- 返事は ```python と ``` でかこんだコードだけ。説明は書かない。',
      '- 1行目は def ' + info.name + '(引数1, 引数2…): の形。引数は ' + info.argc + ' 個。引数名は a, b, c のように短く。',
      '- 使えるのは：変数 = 式、while 条件:、for _ in range(n):、for i in range(a, b):、if / elif / else、return。',
      '- return は関数のいちばん最後に1回だけ。途中で return しない（答えは変数に入れておき、最後に return する）。',
      '- 引数に値を入れない（必要なら別の変数にコピーする）。自分自身を呼ばない。print や input は使わない。',
      '- 使える計算：+ - * / % ** //、abs()、floor()、ceil()、sqrt()、round()、比較 == != < > <= >=、and or not。リストや文字列のメソッドは使えない。',
      '- 使える関数：' + Object.keys(Object.assign({ べき乗: 1, 最大: 1, 最小: 1 }, codeState.functions)).join('、') + '（Pythonでは pow / max / min も可）。',
      '- 真偽を返す関数は、本当なら 1、ちがえば 0 を返す。'
    ].join('\n');
    const msgsA = [{ role: 'user', content: '関数「' + info.name + '」（引数 ' + info.argc + ' 個）を書いてください。' }];
    try {
      let fn = null;
      let lastErr = '';
      for (let tryNo = 0; tryNo < 2 && !fn; tryNo++) {
        const res = await askClaude({ max_tokens: 1500, system: sys, messages: msgsA });
        const text = res.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
        const m = /```(?:python|py)?\s*\n([\s\S]*?)```/.exec(text);
        const code = (m ? m[1] : text).trim();
        const c = BC.compileFunction(code, { functions: codeState.functions });
        if (!c.error && c.name === info.name && c.params.length === info.argc) { fn = Object.assign(c, { code }); break; }
        lastErr = c.error ? c.error.line + '行目：' + c.error.msg : '名前か引数の数がちがいます';
        msgsA.push({ role: 'assistant', content: text }, { role: 'user', content: 'そのコードは変換できませんでした（' + lastErr + '）。きまりを守って書き直してください。' });
      }
      if (!fn) throw new Error('AIの書いた関数を定義ブロックにできませんでした（' + lastErr + '）');
      const token = (await bridge('snapshot')).token;
      // AIが作った定義ブロックは「ブロックのほうが変わった」に数えない（ほかの変化がなかったときだけ）
      let pre = null;
      try { pre = editSig(await bridge('getScripts', {}, 5000)); } catch (e) { /* noop */ }
      await defineMissing(fn.used);
      await bridge('defineFunction', { sprite: codeState.sprite, name: fn.name, params: fn.params, body: fn.body }, 15000);
      try { if (pre && pre === codeState.esig) codeState.esig = editSig(await bridge('getScripts', {}, 5000)); } catch (e) { /* noop */ }
      codeState.functions[fn.name] = { params: fn.params };
      const ub = document.createElement('button');
      ub.className = 'cbtn';
      ub.textContent = '元にもどす';
      ub.addEventListener('click', async () => {
        ub.disabled = true;
        try { await bridge('undo', { token }); delete codeState.functions[fn.name]; codeMessage('ok', '元にもどしました。'); } catch (e) { codeMessage('err', '元にもどせませんでした（' + e.message + '）'); }
      });
      codeMessage('ok', '定義ブロック「' + fn.name + '」を作ったよ！ 中身はブロックの画面で見られます。もう一度「ブロックにする」か「ためしに動かす」を押してね。', ub);
      sendLog({ type: 'code', student: codeTa.value.slice(0, 2000), ai: fn.code, tools: '関数を作る（' + fn.name + '）', errors: '' });
      try { chrome.runtime.sendMessage({ type: 'countQuestion' }, () => { void chrome.runtime.lastError; renderQuota(); }); } catch (e) { /* noop */ }
    } catch (e) {
      codeMessage('err', e.message === 'RELOAD' ? 'ページを読みこみ直してください。' : e.message);
    }
  }

  layer.querySelector('.from-blocks').addEventListener('click', () => {
    if (codeState.dirty && Date.now() - codeState.reloadArmed > 4000) {
      codeState.reloadArmed = Date.now();
      codeMessage('info', '書きかえたコードは消えて、いまのブロックの内容になります。よければ、もう一度「ブロックから読みこむ」を押してね。');
      return;
    }
    codeState.reloadArmed = 0;
    loadCode(true);
  });

  layer.querySelector('.copy-code').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(codeTa.value);
      codeMessage('ok', 'コピーしたよ');
    } catch (e) {
      codeTa.select();
      codeMessage('info', 'コードを選んだので、Ctrl＋C（Macは⌘＋C）でコピーしてね');
    }
  });

  layer.querySelector('.ask-code').addEventListener('click', () => {
    if (busy) return;
    const lang = codeLang();
    const err = codeMsg.classList.contains('err') ? codeMsg.textContent : '';
    const code = codeTa.value.slice(0, 6000);
    if (view === 'code') setView('both');
    send('このコードについて教えて', {
      hidden: '（「コード」タブで、スプライト「' + codeState.sprite + '」のスクリプトを ' + LANG_NAME[lang] + ' で見ています。' +
        (codeState.dirty ? 'まだブロックにしていない書きかえ中のコードです。' : '') + '\n```\n' + code + '\n```\n' +
        (err ? 'いま出ているメッセージ：' + err + '\n' : '') +
        'このコードの意味や書き方を、子どもにわかるように説明してください。まちがいがあれば、どこをどう直せばいいかを教えてください。ブロックは変えないでください）',
      toolLevel: 2
    });
  });


  // ---------------------------------------------------------------
  // 全画面のステージ表示（動いているときはこまめに、止まっているときはゆっくり更新）
  // ---------------------------------------------------------------
  const stageImg = layer.querySelector('.stage-img');
  const stageState = layer.querySelector('.stage-state');
  let stageRunning = false;
  async function stageLoop() {
    if (stageRunning) return;
    stageRunning = true;
    try {
      while (open && alive()) {
        let running = false;
        try {
          const f = await bridge('stageFrame', {}, 3000);
          if (f && f.url) stageImg.src = f.url;
          running = !!(f && f.running);
          if (f && f.question !== undefined && (f.question === null) === askShown) showQuestion(f.question);
        } catch (e) { /* noop */ }
        stageState.textContent = codeState.trial ? '● ためしに動かし中' : (running ? '● 動いています' : '');
        await new Promise((r) => setTimeout(r, running || codeState.trial ? 150 : 1000));
      }
    } finally {
      stageRunning = false;
    }
  }
  layer.querySelector('.sbtn.fold').addEventListener('click', (e) => {
    const box = layer.querySelector('.stagebox');
    const f = !box.classList.contains('folded');
    box.classList.toggle('folded', f);
    e.currentTarget.textContent = f ? '▼ ステージを見る' : '▲ たたむ';
    e.currentTarget.setAttribute('aria-expanded', String(!f));
    save({ stageFolded: f });
  });
  layer.querySelector('.sbtn.flag').addEventListener('click', () => { if (!codeState.trial) bridge('greenFlag').catch(() => {}); });
  layer.querySelector('.sbtn.stop').addEventListener('click', () => { if (codeState.trial) endTrial(); else bridge('stopAll').catch(() => {}); });


  // ---- 全画面のステージ：質問に答える・クリック・キー ----
  const stageFrameEl = layer.querySelector('.stage-frame');
  const askBox = layer.querySelector('.stage-ask');
  const askQ = layer.querySelector('.stage-ask .sq');
  const askIn = layer.querySelector('.sa-in');
  let askShown = false;
  function showQuestion(q) {
    if (q === null || q === undefined) {
      askShown = false;
      askBox.classList.add('hidden');
      return;
    }
    askQ.textContent = q ? '質問：' + q : 'スプライトが質問しています。答えを書いてね';
    if (!askShown) { askIn.value = ''; askShown = true; }
    askBox.classList.remove('hidden');
    if (open && view !== 'code') setTimeout(() => askIn.focus(), 30);
  }
  function sendAnswer() {
    const t = askIn.value;
    showQuestion(null);
    bridge('answerQuestion', { text: t }).catch(() => {});
  }
  layer.querySelector('.sa-ok').addEventListener('click', sendAnswer);
  askIn.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); sendAnswer(); }
  });
  askIn.addEventListener('keyup', (e) => e.stopPropagation());
  window.addEventListener('message', (ev) => {
    if (!fromHost(ev)) return;
    const d = ev.data;
    if (!d || d.source !== PAGE || d.event !== 'question') return;
    showQuestion(d.data ? d.data.q : null);
  });
  const stagePos = (e) => {
    const r = stageImg.getBoundingClientRect();
    return { fx: (e.clientX - r.left) / Math.max(1, r.width), fy: (e.clientY - r.top) / Math.max(1, r.height) };
  };
  let lastMove = 0;
  stageImg.addEventListener('mousedown', (e) => { e.preventDefault(); stageFrameEl.focus(); bridge('stageMouse', Object.assign(stagePos(e), { isDown: true })).catch(() => {}); });
  stageImg.addEventListener('mouseup', (e) => { bridge('stageMouse', Object.assign(stagePos(e), { isDown: false })).catch(() => {}); });
  stageImg.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - lastMove < 60) return;
    lastMove = now;
    bridge('stageMouse', stagePos(e)).catch(() => {});
  });
  const heldKeys = new Set();
  stageFrameEl.addEventListener('keydown', (e) => {
    if (e.target !== stageFrameEl) return;
    e.preventDefault();
    if (heldKeys.has(e.key)) return;
    heldKeys.add(e.key);
    bridge('stageKey', { key: e.key, isDown: true }).catch(() => {});
  });
  stageFrameEl.addEventListener('keyup', (e) => {
    if (e.target !== stageFrameEl) return;
    heldKeys.delete(e.key);
    bridge('stageKey', { key: e.key, isDown: false }).catch(() => {});
  });
  stageFrameEl.addEventListener('blur', () => {
    heldKeys.forEach((k) => bridge('stageKey', { key: k, isDown: false }).catch(() => {}));
    heldKeys.clear();
  });
  // 全画面のときは、キーをScratchのブロック画面に伝えない（見えないところでブロックが消えたり、元にもどったりしないように）
  ['keydown', 'keyup', 'keypress'].forEach((type) => layer.addEventListener(type, (e) => { if (open) e.stopPropagation(); }));
  // 全画面の何もないところをクリックしたあと（入力欄の外）にキーを押したときも、Scratchのブロック画面には伝えない
  ['keydown', 'keyup', 'keypress'].forEach((type) => window.addEventListener(type, (e) => {
    if (open && e.target !== host && !(e.composedPath && e.composedPath().includes(host))) e.stopPropagation();
  }, true));

  // ---- スプライトをえらぶ ----
  const spriteSel = layer.querySelector('.sprite-sel');
  function fillSprites(data) {
    const list = (data && data.sprites) || [];
    const key = list.map((x) => x.id + ':' + x.name).join('|') + '#' + (data && data.targetId);
    if (spriteSel.dataset.key === key) return;
    spriteSel.dataset.key = key;
    spriteSel.innerHTML = '';
    list.forEach((x) => {
      const o = document.createElement('option');
      o.value = x.id;
      o.textContent = x.name === 'Stage' ? 'ステージ' : x.name;
      if (x.id === data.targetId) o.selected = true;
      spriteSel.appendChild(o);
    });
    spriteSel.dataset.current = data.targetId || '';
  }
  spriteSel.addEventListener('change', async () => {
    const id = spriteSel.value;
    if (codeState.trial) { spriteSel.value = spriteSel.dataset.current; codeMessage('info', 'ためしに動かしている間は、スプライトを変えられません。'); return; }
    if (codeState.dirty) {
      spriteSel.value = spriteSel.dataset.current;
      const b = document.createElement('button');
      b.className = 'cbtn';
      b.textContent = '書きかえを捨てて切りかえる';
      b.addEventListener('click', async () => { codeState.dirty = false; spriteSel.value = id; await bridge('selectSprite', { id }).catch(() => {}); loadCode(true); });
      codeMessage('info', 'まだブロックにしていない書きかえがあります。先に「ブロックにする」を押すか、捨てて切りかえてね。', b);
      return;
    }
    try { await bridge('selectSprite', { id }); } catch (e) { codeMessage('err', 'スプライトを切りかえられませんでした（' + e.message + '）'); }
    loadCode(true);
  });
  // ---------------------------------------------------------------
  // レベル・モード・時間
  // ---------------------------------------------------------------
  function renderControls() {
    const lvBox = $('.levels');
    lvBox.innerHTML = '';
    const cap = Number(settings.levelCap) || 3;
    const cur = currentLevel();
    [1, 2, 3].forEach((n) => {
      const b = document.createElement('button');
      b.className = 'lv' + (n === cur ? ' on' : '');
      b.disabled = n > cap;
      b.title = n > cap ? '先生が使えないように設定しています' : '';
      b.innerHTML = '<span class="no"></span><span class="nm"></span>';
      b.querySelector('.no').textContent = 'Lv' + n;
      b.querySelector('.nm').textContent = LEVEL_NAMES[n - 1];
      if (n <= cap) b.title = LEVEL_DESC[n - 1];
      b.addEventListener('click', () => {
        if (!alive()) { addReload(); return; }
        settings.level = n;
        save({ level: n });
        renderControls();
        addAct('Lv' + n + ' ' + LEVEL_NAMES[n - 1] + '：' + LEVEL_DESC[n - 1]);
      });
      lvBox.appendChild(b);
    });
    layer.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.mode === mode));

    renderMic();
    renderQuota();
    $('.disclose').textContent = 'AIのアシスタントです（人ではありません）。まちがえることもあるよ。名前や住所は書かないでね。' +
      (settings.logOn && settings.logUrl ? '会話は先生が読むことがあるよ。' : '');
    const ok = allowedNow();
    const ct = $('.closed-time');
    ct.classList.toggle('hidden', ok);
    $('.ct-text').textContent = ok ? '' : '今はAIを使えない時間です（' + timeText() + '）。';
    $('.unlocked-note').classList.toggle('hidden', !(ok && !inTimeWindow()));
    input.disabled = !ok || busy;
    sendBtn.disabled = !ok || busy;
    layer.querySelectorAll('.q').forEach((q) => { q.disabled = !ok || busy; });
  }
  setInterval(() => { if (open) renderControls(); }, 30000);

  layer.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    mode = t.dataset.mode;
    renderControls();
  }));

  layer.querySelectorAll('.q').forEach((q) => q.addEventListener('click', () => {
    if (q.dataset.q === 'debug') { mode = 'debug'; renderControls(); send('うまく動かないところがあるので、原因を調べてほしい'); }
    if (q.dataset.q === 'next') send('次は何をすればいい？');
    if (q.dataset.q === 'praise') send('ここまでの作品を見て、いいところと、もっとよくできるところを教えて');
  }));

  $('.newchat').addEventListener('click', () => {
    if (busy) return;
    if (!loadedKey) loadedKey = projectKey();
    clearChat();
    clearHighlights();
    greet();
    saveChat();
  });

  // 先生用パスワードで時間外でも使えるようにする（その日の終わりまで）
  const unlockPw = $('.unlock-pw');
  async function tryUnlock() {
    const pw = unlockPw.value;
    if (!pw) return;
    const h = await sha256(pw);
    unlockPw.value = '';
    if (settings.unlockHash && h === settings.unlockHash) {
      settings.unlockUntil = endOfToday();
      save({ unlockUntil: settings.unlockUntil });
      $('.unlock-msg').textContent = '';
      renderControls();
      setTimeout(() => input.focus(), 50);
    } else {
      $('.unlock-msg').textContent = 'パスワードがちがいます';
    }
  }
  $('.unlock-btn').addEventListener('click', tryUnlock);
  unlockPw.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); tryUnlock(); }
    e.stopPropagation();
  });
  unlockPw.addEventListener('keyup', (e) => e.stopPropagation());
  $('.relock').addEventListener('click', () => {
    settings.unlockUntil = 0;
    save({ unlockUntil: 0 });
    renderControls();
  });

  sendBtn.addEventListener('click', () => send(input.value, { fromInput: true }));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      send(input.value, { fromInput: true });
    }
    e.stopPropagation(); // Scratchのショートカットに反応させない
  });
  input.addEventListener('keyup', (e) => e.stopPropagation());
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(120, input.scrollHeight) + 'px';
  });

  // ---------------------------------------------------------------
  // 吹き出し
  // ---------------------------------------------------------------
  const CHIP_COLORS = {
    motion: ['#3373CC', '#fff'], looks: ['#8A55D7', '#fff'], sound: ['#B04FB0', '#fff'],
    event: ['#FFBF00', '#1F2433'], control: ['#FFAB19', '#1F2433'], sensing: ['#4CBFE6', '#1F2433'],
    operator: ['#59C059', '#1F2433'], data: ['#FF8C1A', '#1F2433'], pen: ['#0FBD8C', '#1F2433'],
    music: ['#0FBD8C', '#1F2433']
  };

  function scrollDown() { msgs.scrollTop = msgs.scrollHeight; }

  // 画面に出した吹き出しの記録（会話の保存用）
  let viewLog = [];
  let restoring = false;
  function logView(k, t) { if (!restoring) viewLog.push({ k, t }); }

  function addMe(text) {
    logView('me', text);
    const d = document.createElement('div');
    d.className = 'me';
    d.textContent = text;
    msgs.appendChild(d);
    scrollDown();
  }

  // ふりがな ｜漢字《かんじ》 を <ruby> にする
  function appendText(el, text) {
    const re = /｜?([一-龯々〆ヵヶ]+)《([^》]{1,20})》/g;
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
      const rb = document.createElement('ruby');
      rb.appendChild(document.createTextNode(m[1]));
      const rt = document.createElement('rt');
      rt.textContent = m[2];
      rb.appendChild(rt);
      el.appendChild(rb);
      last = re.lastIndex;
    }
    if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
  }

  // 読み上げ・ログ用：記号をはずした文章（ふりがなは読みにする）
  function plainText(text) {
    return String(text || '')
      .replace(/\[\[block:[A-Za-z0-9_]+\|([^\]]+)\]\]/g, '「$1」')
      .replace(/\[\[quiz:([^|\]]*)[^\]]*\]\]/g, 'クイズ：$1')
      .replace(/\[\[challenge:([^\]]*)\]\]/g, 'チャレンジ：$1')
      .replace(/｜?([一-龯々〆ヵヶ]+)《([^》]{1,20})》/g, '$2');
  }

  function quizCard(raw) {
    const parts = raw.split('|').map((x) => x.trim());
    const q = parts[0] || '';
    const opts = parts.slice(1, 4).filter(Boolean);
    const ans = Math.max(1, Math.min(opts.length, Number(parts[4]) || 1));
    const note = parts[5] || '';
    const box = document.createElement('div');
    box.className = 'quiz';
    const qq = document.createElement('div');
    qq.className = 'quiz-q';
    appendText(qq, 'クイズ：' + q);
    box.appendChild(qq);
    const list = document.createElement('div');
    list.className = 'quiz-opts';
    const res = document.createElement('div');
    res.className = 'quiz-res';
    opts.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'quiz-opt';
      b.type = 'button';
      appendText(b, (i + 1) + '. ' + o);
      b.addEventListener('click', () => {
        list.querySelectorAll('button').forEach((x, j) => {
          x.disabled = true;
          if (j === ans - 1) x.classList.add('right');
        });
        const ok = i === ans - 1;
        if (!ok) b.classList.add('wrong');
        res.textContent = '';
        appendText(res, (ok ? 'せいかい！ ' : 'おしい！ 正解は ' + ans + ' だよ。 ') + note);
        sendLog({ type: 'quiz', student: '答え：' + (i + 1) + '. ' + o, ai: q, tools: ok ? '正解' : '不正解', errors: '' });
      });
      list.appendChild(b);
    });
    box.appendChild(list);
    box.appendChild(res);
    return box;
  }

  function challengeCard(goal) {
    const box = document.createElement('div');
    box.className = 'challenge';
    const t = document.createElement('div');
    t.className = 'challenge-t';
    appendText(t, 'チャレンジ：' + goal);
    const b = document.createElement('button');
    b.className = 'hint-btn';
    b.type = 'button';
    b.textContent = 'できた！見て';
    b.addEventListener('click', () => {
      if (busy) return;
      send('できたよ！見て', { hidden: '（チャレンジ「' + goal + '」ができたか、作品を見てたしかめてください。できていたら具体的にほめて、ちがうところはヒントだけ出してください。ブロックは変えないでください）', toolLevel: 2, logType: 'challenge' });
    });
    box.appendChild(t);
    box.appendChild(b);
    return box;
  }

  function richText(el, text) {
    const re = /\[\[(block|quiz|challenge):([^\]]*)\]\]/g;
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m.index > last) appendText(el, text.slice(last, m.index));
      if (m[1] === 'block') {
        const bar = m[2].indexOf('|');
        const opcode = bar >= 0 ? m[2].slice(0, bar) : m[2];
        const label = bar >= 0 ? m[2].slice(bar + 1) : m[2];
        const chip = document.createElement('span');
        chip.className = 'chip';
        const c = CHIP_COLORS[opcode.split('_')[0]] || ['#DCE1EA', '#1F2433'];
        chip.style.background = c[0];
        chip.style.color = c[1];
        appendText(chip, label);
        el.appendChild(chip);
      } else if (m[1] === 'quiz') {
        el.appendChild(quizCard(m[2]));
      } else {
        el.appendChild(challengeCard(m[2]));
      }
      last = re.lastIndex;
    }
    if (last < text.length) appendText(el, text.slice(last));
  }

  function aiBubble() {
    const d = document.createElement('div');
    d.className = 'ai';
    const t = document.createElement('div');
    t.className = 'txt';
    d.appendChild(t);
    msgs.appendChild(d);
    return { d, t };
  }

  function addAiTools(d, text) {
    const row = document.createElement('div');
    row.className = 'ai-tools';
    if ('speechSynthesis' in window) {
      const sp = document.createElement('button');
      sp.className = 'speak';
      sp.type = 'button';
      sp.setAttribute('aria-label', '読み上げる');
      sp.innerHTML = ICON_SPEAK + '<span>読む</span>';
      sp.addEventListener('click', () => speak(text));
      row.appendChild(sp);
    }
    d.appendChild(row);
    return row;
  }

  function addAi(text) {
    logView('ai', text);
    const { d, t } = aiBubble();
    richText(t, text);
    addAiTools(d, text);
    scrollDown();
    return d;
  }

  // 読み上げ
  function speak(text) {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(plainText(text).slice(0, 600));
      u.lang = 'ja-JP';
      u.rate = 1;
      const v = window.speechSynthesis.getVoices().find((x) => /ja/i.test(x.lang));
      if (v) u.voice = v;
      window.speechSynthesis.speak(u);
    } catch (e) { /* noop */ }
  }

  // 段階ヒントのボタン（いちばん新しい返事にだけ出す）
  let hintStage = 0;
  function addHintButton(d) {
    layer.querySelectorAll('.hint-more').forEach((x) => x.remove());
    if (currentLevel() >= 3 || hintStage >= 3) return;
    const row = d.querySelector('.ai-tools') || addAiTools(d, '');
    const b = document.createElement('button');
    b.className = 'hint-btn hint-more';
    b.type = 'button';
    b.textContent = 'もう少し教えて（' + (hintStage + 1) + '/3）';
    b.addEventListener('click', () => {
      if (busy) return;
      hintStage += 1;
      send('もう少し教えて', { hidden: '（ヒントの段階：' + hintStage + '／3）', keepHint: true });
    });
    row.appendChild(b);
  }

  function addAct(text) {
    logView('act', text);
    const d = document.createElement('div');
    d.className = 'act';
    d.textContent = text;
    msgs.appendChild(d);
    scrollDown();
  }

  function addErr(text, withSettings) {
    logView('err', text);
    const d = document.createElement('div');
    d.className = 'err';
    d.textContent = text;
    if (withSettings) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.style.marginTop = '6px';
      b.style.display = 'block';
      b.textContent = '設定を開く（先生用）';
      b.addEventListener('click', () => {
        if (!alive()) { addReload(); return; }
        try { chrome.runtime.sendMessage({ type: 'openOptions' }); } catch (e) { addReload(); }
      });
      d.appendChild(b);
    }
    msgs.appendChild(d);
    scrollDown();
  }

  let reloadShown = false;
  function addReload() {
    if (reloadShown) return;
    reloadShown = true;
    const d = document.createElement('div');
    d.className = 'err';
    d.textContent = '拡張機能が更新されたので、このページを読みこみ直してね（作品は先に保存してね）。';
    const b = document.createElement('button');
    b.className = 'btn';
    b.style.marginTop = '6px';
    b.style.display = 'block';
    b.textContent = 'ページを読みこみ直す';
    b.addEventListener('click', () => location.reload());
    d.appendChild(b);
    msgs.appendChild(d);
    scrollDown();
  }

  function greet() {
    addAi('こんにちは！ Scratchの作品づくりを手伝うAIだよ。\nやりたいことや、うまく動かないところを教えてね。');
  }

  // ---------------------------------------------------------------
  // 作戦メモ
  // ---------------------------------------------------------------
  let plan = null;
  let planOpen = true;
  const planBox = layer.querySelector('.plan');

  function renderPlan() {
    if (!plan || !plan.steps || !plan.steps.length) { planBox.classList.add('hidden'); return; }
    planBox.classList.remove('hidden');
    planBox.classList.toggle('closed', !planOpen);
    const done = plan.steps.filter((x) => x.done).length;
    planBox.querySelector('.plan-title').textContent = '作戦メモ：' + plan.title;
    planBox.querySelector('.plan-count').textContent = done + '/' + plan.steps.length + (planOpen ? ' ▲' : ' ▼');
    const ol = planBox.querySelector('.plan-list');
    ol.innerHTML = '';
    plan.steps.forEach((st, i) => {
      const li = document.createElement('li');
      li.className = st.done ? 'done' : '';
      const lb = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!st.done;
      cb.addEventListener('change', () => { st.done = cb.checked; renderPlan(); saveChat(); });
      const sp = document.createElement('span');
      appendText(sp, st.t);
      lb.appendChild(cb);
      lb.appendChild(sp);
      li.appendChild(lb);
      ol.appendChild(li);
    });
  }
  planBox.querySelector('.plan-head').addEventListener('click', () => { planOpen = !planOpen; renderPlan(); });

  function planText() {
    if (!plan || !plan.steps || !plan.steps.length) return '';
    return '【作戦メモ】' + plan.title + '\n' + plan.steps.map((x, i) => (i + 1) + '. [' + (x.done ? 'x' : ' ') + '] ' + x.t).join('\n') + '\n\n';
  }

  // ---------------------------------------------------------------
  // ことば・読み上げの設定（歯車ボタン）
  // ---------------------------------------------------------------
  const prefs = layer.querySelector('.prefs');
  layer.querySelector('.gear').addEventListener('click', () => { prefs.classList.toggle('hidden'); renderPrefs(); });
  function renderPrefs() {
    layer.querySelectorAll('.kb').forEach((b) => b.classList.toggle('on', b.dataset.k === (settings.kotoba || 'normal')));
    layer.querySelector('.autoread').checked = !!settings.autoRead;
  }
  layer.querySelectorAll('.kb').forEach((b) => b.addEventListener('click', () => {
    settings.kotoba = b.dataset.k;
    save({ kotoba: settings.kotoba });
    renderPrefs();
  }));
  layer.querySelector('.autoread').addEventListener('change', (e) => {
    settings.autoRead = e.target.checked;
    save({ autoRead: settings.autoRead });
    if (!settings.autoRead) { try { window.speechSynthesis.cancel(); } catch (err) { /* noop */ } }
  });

  // ---------------------------------------------------------------
  // 音声入力（先生が設定でオンにしたときだけ）
  // ---------------------------------------------------------------
  const micBtn = layer.querySelector('.mic');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  function renderMic() {
    micBtn.classList.toggle('hidden', !(settings.voiceInput && SR));
  }
  micBtn.addEventListener('click', () => {
    if (!SR) return;
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = 'ja-JP';
    rec.interimResults = true;
    rec.continuous = false;
    const base = input.value ? input.value + ' ' : '';
    rec.onresult = (ev) => {
      let txt = '';
      for (let i = 0; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
      input.value = base + txt;
      input.dispatchEvent(new Event('input'));
    };
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed') addErr('マイクが使えません。先生に、このページでマイクを許可してもらってね。');
    };
    rec.onend = () => { rec = null; micBtn.classList.remove('on'); input.focus(); };
    micBtn.classList.add('on');
    try { rec.start(); } catch (e) { rec = null; micBtn.classList.remove('on'); }
  });

  // ---------------------------------------------------------------
  // 1日の回数上限
  // ---------------------------------------------------------------
  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function getTodayCount() {
    return new Promise((resolve) => {
      if (!alive()) return resolve(0);
      try {
        chrome.storage.local.get('usageDays', (r) => {
          const day = r && r.usageDays && r.usageDays[todayKey()];
          resolve(day ? day.q || 0 : 0);
        });
      } catch (e) { resolve(0); }
    });
  }
  async function renderQuota() {
    const q = layer.querySelector('.quota');
    const lim = Number(settings.dailyLimit) || 0;
    if (!lim) { q.classList.add('hidden'); return; }
    const used = await getTodayCount();
    q.classList.remove('hidden');
    q.textContent = unlockedNow() ? '今日の回数：' + used + '（先生のパスワードで解除中）' : '今日あと ' + Math.max(0, lim - used) + ' 回 AIに聞けるよ';
  }

  // ---------------------------------------------------------------
  // ブロックの右クリック「AIに聞く」
  // ---------------------------------------------------------------
  window.addEventListener('message', (ev) => {
    if (!fromHost(ev)) return;
    const d = ev.data;
    if (!d || d.source !== PAGE || d.event !== 'askBlock' || !d.data) return;
    const info = d.data;
    if (view === 'code') setView('both');
    if (!open) setOpen(true);
    const where = info.inFlyout
      ? '（パレットにあるブロック opcode=' + info.opcode + ' について聞いています。作品の中にはまだありません）'
      : '（スプライト「' + info.sprite + '」のブロック #' + info.blockId + '（opcode=' + info.opcode + '、スクリプトの先頭 #' + info.topId + '）について聞いています。どんな働きか、このスクリプトの中でどんな役目かを説明してください）';
    setTimeout(() => send(info.inFlyout ? 'このブロックは何ができるの？' : 'このブロックについて教えて', { hidden: where }), loadedKey ? 0 : 400);
  });

  // ---------------------------------------------------------------
  // 作品の「AIメモ」リストに記録を残す（別のPCで開いても続きから）
  // ---------------------------------------------------------------
  let memo = [];
  const TAG = { me: '[子ども] ', ai: '[AI] ', act: '[できごと] ', err: '[エラー] ' };

  function memoText() {
    if (!memo.length) return '';
    return '【AIメモ（前回までの記録）】\n' + memo.map((x) => '- ' + x).join('\n') + '\n\n';
  }

  const enc = (t) => String(t || '').replace(/\r?\n/g, ' ⏎ ');
  const dec = (t) => String(t || '').replace(/ ⏎ /g, '\n');

  function buildListItems() {
    const items = ['[説明] ブロックAIアシスタントの記録です。消さないでね（作品を共有すると、だれでも読めます）。',
      '[保存] ' + new Date().toISOString()];
    memo.forEach((x) => items.push('[メモ] ' + enc(x)));
    if (plan && plan.steps) {
      items.push('[作戦] ' + enc(plan.title));
      plan.steps.forEach((st) => items.push((st.done ? '[作戦✓] ' : '[作戦・] ') + enc(st.t)));
    }
    if (settings.memoMode === 'full') {
      viewLog.slice(-300).forEach((x) => { if (TAG[x.k]) items.push(TAG[x.k] + enc(x.t).slice(0, 1900)); });
    }
    return items;
  }

  function parseListItems(items) {
    const out = { at: 0, memo: [], plan: null, view: [] };
    items.forEach((raw) => {
      const m = /^\[([^\]]+)\] ?([\s\S]*)$/.exec(String(raw));
      if (!m) return;
      const tag = m[1];
      const val = dec(m[2]);
      if (tag === '保存') out.at = Date.parse(val) || 0;
      else if (tag === 'メモ') out.memo.push(val);
      else if (tag === '作戦') out.plan = { title: val, steps: [] };
      else if (tag === '作戦✓' || tag === '作戦・') { if (out.plan) out.plan.steps.push({ t: val, done: tag === '作戦✓' }); }
      else {
        const k = Object.keys(TAG).find((key) => TAG[key] === '[' + tag + '] ');
        if (k) out.view.push({ k, t: val });
      }
    });
    if (out.plan && !out.plan.steps.length) out.plan = null;
    return out;
  }

  // 会話の全文から、AIに送る履歴（文章だけ）を作りなおす
  function historyFromView(view) {
    const h = [];
    view.forEach((x) => {
      if (x.k !== 'me' && x.k !== 'ai') return;
      const role = x.k === 'me' ? 'user' : 'assistant';
      const last = h[h.length - 1];
      if (last && last.role === role) last.content[0].text += '\n' + x.t;
      else h.push({ role, content: [{ type: 'text', text: x.t }] });
    });
    while (h.length && h[0].role !== 'user') h.shift();
    return h.slice(-30);
  }

  let listTimer = null;
  function writeProjectList() {
    if (settings.memoMode === 'off' || !loadedKey) return;
    clearTimeout(listTimer);
    listTimer = setTimeout(() => {
      bridge('writeMemoList', { items: buildListItems() }).catch(() => {});
    }, 400);
  }

  function readProjectList() {
    if (settings.memoMode === 'off') return Promise.resolve(null);
    return bridge('readMemoList', {}, 5000).then((r) => (r && r.exists ? parseListItems(r.items) : null)).catch(() => null);
  }

  // ---------------------------------------------------------------
  // 会話の保存（作品ごと）
  // ---------------------------------------------------------------
  let loadedKey = null;

  function projectKey() {
    const m = /\/projects\/(\d+)/.exec(hostPath());
    return 'chat:' + (m ? m[1] : 'new');
  }

  function shortenDeep(v) {
    if (typeof v === 'string') return v.length > 600 ? v.slice(0, 600) + '…（長いので省略）' : v;
    if (Array.isArray(v)) return v.map(shortenDeep);
    if (v && typeof v === 'object') {
      const o = {};
      for (const k in v) o[k] = shortenDeep(v[k]);
      return o;
    }
    return v;
  }

  // 保存用：画像を消し、長い道具の中身（SVGなど）を短くする
  function compactHistory(h) {
    return h.map((m) => {
      if (!Array.isArray(m.content)) return m;
      return Object.assign({}, m, {
        content: m.content.filter((c) => c.type !== 'thinking' && c.type !== 'redacted_thinking').map((c) => {
          if (c.type === 'tool_use') return Object.assign({}, c, { input: shortenDeep(c.input) });
          if (c.type === 'tool_result') {
            if (Array.isArray(c.content)) {
              return Object.assign({}, c, { content: c.content.map((x) => (x.type === 'image' ? { type: 'text', text: '（ステージの画像）' } : x)) });
            }
            return Object.assign({}, c, { content: shortenDeep(c.content) });
          }
          return c;
        })
      });
    });
  }

  function saveChat() {
    writeProjectList();
    if (!alive() || !loadedKey) return;
    const data = { v: viewLog.slice(-80), h: compactHistory(history), at: Date.now(), plan, memo };
    try {
      chrome.storage.local.get('chatIndex', (r) => {
        const idx = (r && r.chatIndex) || {};
        idx[loadedKey] = data.at;
        // 古い作品の会話は30作品分まで残す
        const keys = Object.keys(idx).sort((a, b) => idx[b] - idx[a]);
        const drop = keys.slice(30);
        drop.forEach((k) => delete idx[k]);
        const obj = { chatIndex: idx };
        obj[loadedKey] = data;
        chrome.storage.local.set(obj);
        if (drop.length) chrome.storage.local.remove(drop);
      });
    } catch (e) { /* noop */ }
  }

  function clearChat() {
    // 会話は消すが、作戦メモとAIメモ（作品の記録）は残す
    history = [];
    viewLog = [];
    hintStage = 0;
    msgs.innerHTML = '';
    if (alive() && loadedKey) { try { chrome.storage.local.remove(loadedKey); } catch (e) { /* noop */ } }
  }

  function readPcChat(key) {
    return new Promise((resolve) => {
      if (!alive()) return resolve(null);
      try { chrome.storage.local.get(key, (r) => resolve((r && r[key]) || null)); } catch (e) { resolve(null); }
    });
  }

  function showRestored(view, at, from) {
    view.forEach((x) => logView(x.k, x.t));
    restoring = true;
    view.forEach((x) => {
      if (x.k === 'me') addMe(x.t);
      else if (x.k === 'ai') addAi(x.t);
      else if (x.k === 'act') addAct(x.t);
      else if (x.k === 'err') addErr(x.t);
    });
    restoring = false;
    const d = document.createElement('div');
    d.className = 'think';
    d.textContent = '― ここまでが前の会話です' + (at ? '（' + new Date(at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + (from ? '・' + from : '') + '）' : '') + ' ―';
    msgs.appendChild(d);
    scrollDown();
  }

  async function restoreOrGreet() {
    const key = projectKey();
    loadedKey = key;
    msgs.innerHTML = '';
    history = [];
    viewLog = [];
    plan = null;
    memo = [];
    hintStage = 0;
    renderPlan();
    const [pc, list] = await Promise.all([readPcChat(key), readProjectList()]);
    if (loadedKey !== key) return; // 読みこみ中に作品が変わった
    const pcAt = pc && pc.at ? pc.at : 0;
    const listAt = list && list.at ? list.at : 0;
    // メモと作戦は、新しいほうを使う
    const newer = listAt > pcAt ? list : null;
    memo = (newer ? newer.memo : (pc && pc.memo)) || (list ? list.memo : []) || [];
    plan = (newer ? newer.plan : (pc && pc.plan)) || (list ? list.plan : null) || null;
    renderPlan();
    // 会話：このPCの記録が新しければそれを、作品の記録が新しければ（別のPCで続けたなど）作品のものを使う
    if (newer && newer.view.length) {
      history = historyFromView(newer.view);
      showRestored(newer.view, listAt, '作品に保存された記録');
    } else if (pc && Array.isArray(pc.v) && pc.v.length) {
      history = Array.isArray(pc.h) ? pc.h : [];
      showRestored(pc.v, pcAt, '');
    } else if (list && list.view.length) {
      history = historyFromView(list.view);
      showRestored(list.view, listAt, '作品に保存された記録');
    } else {
      greet();
      if (memo.length) addAct('前回のAIメモがあるよ。続きから手伝えるよ');
    }
  }

  // 作品が変わったとき（新しい作品を保存してIDが付いたときは、会話を引きつぐ）
  function checkProjectChange() {
    if (!loadedKey || busy) return;
    const k = projectKey();
    if (k === loadedKey) return;
    if (loadedKey === 'chat:new') {
      loadedKey = k;
      saveChat();
      return;
    }
    if (open) restoreOrGreet(); else { loadedKey = null; msgs.innerHTML = ''; history = []; viewLog = []; }
  }


  // ---------------------------------------------------------------
  // ブロックの印（オレンジの枠と吹き出し）
  // ---------------------------------------------------------------
  let highlights = null;
  let hlTimer = null;

  function clearHighlights() {
    highlights = null;
    hlLayer.innerHTML = '';
    if (hlTimer) { clearInterval(hlTimer); hlTimer = null; }
    bridge('clearHighlight').catch(() => {});
  }

  async function drawHighlights() {
    if (!highlights) return;
    let res;
    try { res = await bridge('getBlockRects', { ids: highlights.ids }, 3000); } catch (e) { return; }
    if (!highlights) return;
    hlLayer.innerHTML = '';
    const rects = res.rects || {};
    let first = null;
    highlights.ids.forEach((id) => {
      const r = rects[id];
      if (!r || !editorRect) return;
      // コードの場所の外にはみ出たものは描かない
      if (r.top + r.height < editorRect.top || r.top > editorRect.bottom || r.left + r.width < editorRect.left || r.left > editorRect.right) return;
      const box = document.createElement('div');
      box.className = 'hl-box';
      box.style.left = (r.left - 5) + 'px';
      box.style.top = (r.top - 5) + 'px';
      box.style.width = (r.width + 10) + 'px';
      box.style.height = (r.height + 10) + 'px';
      hlLayer.appendChild(box);
      if (!first) first = r;
    });
    if (first) {
      const c = document.createElement('div');
      c.className = 'hl-callout';
      const span = document.createElement('span');
      span.textContent = 'AI：' + highlights.note;
      const x = document.createElement('button');
      x.setAttribute('aria-label', '印を消す');
      x.textContent = '×';
      x.addEventListener('click', clearHighlights);
      c.appendChild(span);
      c.appendChild(x);
      c.style.left = (first.left + first.width + 14) + 'px';
      c.style.top = (first.top + first.height / 2 - 16) + 'px';
      hlLayer.appendChild(c);
    }
  }

  function showHighlights(ids, note) {
    highlights = { ids, note: note || 'ここを見てね' };
    if (open) {
      const row = document.createElement('div');
      row.className = 'act';
      row.appendChild(document.createTextNode('ブロックに印をつけたよ '));
      const go = document.createElement('button');
      go.className = 'linkbtn';
      go.textContent = 'ブロックの画面で見る';
      go.addEventListener('click', () => setOpen(false));
      row.appendChild(go);
      msgs.appendChild(row);
      scrollDown();
    }
    if (hlTimer) clearInterval(hlTimer);
    setTimeout(drawHighlights, 450);
    hlTimer = setInterval(drawHighlights, 300);
  }

  // ---------------------------------------------------------------
  // 会話
  // ---------------------------------------------------------------
  function personalInfoFound(text) {
    if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(text)) return true;
    if (/0\d{1,4}-\d{1,4}-\d{3,4}/.test(text)) return true;
    if (/(^|\D)0\d{9,10}(\D|$)/.test(text.replace(/[\s-]/g, ''))) return true;
    return false;
  }

  function trimHistory() {
    const LIMIT = 30;
    while (history.length > LIMIT) {
      history.shift();
      // 先頭が「子どものふつうのメッセージ」になるまで消す（tool のやり取りを途中で切らない）
      while (history.length && !(history[0].role === 'user' && history[0].content.some((c) => c.type === 'text') &&
        !history[0].content.some((c) => c.type === 'tool_result'))) {
        history.shift();
      }
    }
  }

  // レベルを下げたときなど、今使えない道具のやり取りは文章に置きかえる
  // （APIは、tools にない道具の tool_use / tool_result を受け付けないため）
  // 考えた中身（thinking）は、いまの質問の中で、正しくそろっているものだけ送る（前の質問の分は送らなくてよい）
  // Sonnet 5.5 などは、考えた中身を表示しない設定（omitted）が標準なので、thinking は空で signature だけ届く。
  // signature があれば正しいブロックとして、そのまま返す
  function thinkingOk(c) {
    if (c.type === 'thinking') return typeof c.signature === 'string' && c.signature.length > 0;
    if (c.type === 'redacted_thinking') return typeof c.data === 'string' && c.data.length > 0;
    return true;
  }
  function sanitize(msgList, toolNames, turnIndex) {
    const dropped = new Set();
    return msgList.map((m, mi) => {
      if (!Array.isArray(m.content)) return m;
      const keepThinking = typeof turnIndex === 'number' && mi > turnIndex;
      const content = m.content.filter((c) => {
        if (c.type !== 'thinking' && c.type !== 'redacted_thinking') return true;
        return keepThinking && thinkingOk(c);
      }).map((c) => {
        if (c.type === 'tool_use' && !toolNames.includes(c.name)) {
          dropped.add(c.id);
          return { type: 'text', text: '（道具「' + c.name + '」を使った）' };
        }
        if (c.type === 'tool_result' && dropped.has(c.tool_use_id)) {
          const body = typeof c.content === 'string' ? c.content : (Array.isArray(c.content) ? c.content.filter((x) => x.type === 'text').map((x) => x.text).join(' ') : '');
          return { type: 'text', text: '（道具の結果：' + body.slice(0, 200) + '）' };
        }
        return c;
      });
      if (!content.length) content.push({ type: 'text', text: '…' });
      return Object.assign({}, m, { content });
    });
  }

  // 前の質問のときの画像は、文字に置きかえて送る量をへらす
  function dropOldImages(msgList, keepFrom) {
    return msgList.map((m, i) => {
      if (i >= keepFrom || !Array.isArray(m.content)) return m;
      let changed = false;
      const content = m.content.map((c) => {
        if (c.type === 'tool_result' && Array.isArray(c.content) && c.content.some((x) => x.type === 'image')) {
          changed = true;
          return Object.assign({}, c, { content: c.content.map((x) => (x.type === 'image' ? { type: 'text', text: '（ステージの画像）' } : x)) });
        }
        return c;
      });
      return changed ? Object.assign({}, m, { content }) : m;
    });
  }

  function buildMessages(turnIndex, dump, toolNames) {
    return dropOldImages(sanitize(history, toolNames, turnIndex), turnIndex).map((m, i) => {
      if (i !== turnIndex) return m;
      const text = m.content[0].text;
      return {
        role: 'user',
        content: [{
          type: 'text',
          text: '【作品の今の様子】\n' + dump + '\n\n' + memoText() + planText() + '【子どものメッセージ】\n' + text,
          cache_control: { type: 'ephemeral' }
        }]
      };
    });
  }

  async function runTool(block, turn) {
    const p = block.input || {};
    const editTools = ['add_script', 'replace_script', 'delete_script', 'create_sprite', 'add_costume', 'manage_variable', 'set_monitor', 'edit_blocks',
      'rename_sprite', 'delete_sprite', 'duplicate_sprite', 'delete_costume', 'add_sound', 'delete_sound'];
    if (editTools.includes(block.name) && !turn.snapshot) {
      turn.snapshot = (await bridge('snapshot')).token;
    }
    if (block.name === 'highlight_blocks') {
      const r = await bridge('highlight', p);
      showHighlights(r.ids, p.note);
      if (!open) addAct('ブロックに印をつけたよ');
      return '印をつけました: ' + r.ids.join(', ');
    }
    if (block.name === 'add_script') {
      const r = await bridge('addScript', p, 30000);
      turn.added += r.added;
      turn.created = turn.created.concat(r.created || []);
      addAct('ブロックを' + r.added + 'こ追加したよ');
      return '追加しました。新しいスクリプトの先頭ID: ' + r.topId + '（' + r.added + 'ブロック）' + (r.created && r.created.length ? ' 新しく作ったもの: ' + r.created.join(', ') : '');
    }
    if (block.name === 'replace_script') {
      const r = await bridge('replaceScript', p, 30000);
      turn.added += r.added;
      turn.removed += r.removed;
      turn.created = turn.created.concat(r.created || []);
      addAct('スクリプトを直したよ');
      return '置きかえました。新しい先頭ID: ' + r.topId + (r.created && r.created.length ? ' 新しく作ったもの: ' + r.created.join(', ') : '');
    }
    if (block.name === 'delete_script') {
      const r = await bridge('deleteScript', p);
      turn.removed += r.removed;
      addAct('スクリプトを消したよ');
      return '消しました（' + r.removed + 'ブロック）';
    }
    if (block.name === 'create_sprite') {
      const r = await bridge('createSprite', p, 30000);
      turn.sprites.push(r.name);
      addAct('スプライト「' + r.name + '」を作ったよ');
      return 'スプライトを作りました。名前: ' + r.name + '（絵の大きさ ' + r.size + '）';
    }
    if (block.name === 'add_costume') {
      const r = await bridge('addCostume', p, 30000);
      turn.costumes += 1;
      addAct(r.sprite === 'Stage' ? '背景「' + r.name + '」を追加したよ' : '「' + r.sprite + '」にコスチューム「' + r.name + '」を追加したよ');
      return '追加しました（' + r.sprite + ' のコスチューム数: ' + r.count + '）';
    }
    if (block.name === 'edit_blocks') {
      if (!turn.snapshot) turn.snapshot = (await bridge('snapshot')).token;
      const r = await bridge('editBlocks', p, 30000);
      turn.added += r.added;
      turn.removed += r.removed;
      turn.created = turn.created.concat(r.created || []);
      addAct('ブロックを直したよ');
      return '直しました：' + r.msg + (r.created && r.created.length ? ' 新しく作ったもの: ' + r.created.join(', ') : '');
    }
    if (block.name === 'run_and_watch') {
      addAct('緑の旗を押して、動きをたしかめているよ…');
      const sec = Math.max(0.5, Math.min(10, Number(p.seconds) || 3));
      const r = await bridge('runAndWatch', p, (sec + 15) * 1000);
      if (r.image) {
        return [{ type: 'text', text: r.text }, { type: 'image', source: { type: 'base64', media_type: r.image.mediaType, data: r.image.data } }];
      }
      return r.text;
    }
    if (block.name === 'make_plan') {
      const steps = (Array.isArray(p.steps) ? p.steps : []).map((x) => String(x).slice(0, 80)).filter(Boolean).slice(0, 8);
      if (!steps.length) throw new Error('steps が空です');
      plan = { title: String(p.title || '作戦メモ').slice(0, 40), steps: steps.map((t) => ({ t, done: false })) };
      planOpen = true;
      renderPlan();
      addAct('作戦メモを作ったよ');
      return '作戦メモを表示しました（' + steps.length + 'ステップ）';
    }
    if (block.name === 'update_memo') {
      memo = (Array.isArray(p.lines) ? p.lines : []).map((x) => String(x).replace(/\s+/g, ' ').slice(0, 120)).filter(Boolean).slice(0, 8);
      return 'AIメモを更新しました（' + memo.length + '行）。作品が保存されると、いっしょに保存されます。';
    }
    if (block.name === 'check_plan') {
      if (!plan) throw new Error('作戦メモがありません');
      const i = Math.round(Number(p.step)) - 1;
      if (!plan.steps[i]) throw new Error('ステップ ' + p.step + ' はありません');
      plan.steps[i].done = p.done !== false;
      renderPlan();
      if (plan.steps[i].done) addAct('作戦メモ ' + (i + 1) + ' ができた！');
      return 'ステップ' + (i + 1) + 'を' + (plan.steps[i].done ? 'できた' : 'まだ') + 'にしました';
    }
    if (block.name === 'look_stage') {
      addAct(p.run_seconds ? '緑の旗を押して、ステージを見ているよ…' : 'ステージを見ているよ');
      const r = await bridge('lookStage', p, 20000);
      return [
        { type: 'image', source: { type: 'base64', media_type: r.mediaType, data: r.data } },
        { type: 'text', text: r.note }
      ];
    }
    const simple = { rename_sprite: 'renameSprite', delete_sprite: 'deleteSprite', duplicate_sprite: 'duplicateSprite',
      delete_costume: 'deleteCostume', add_sound: 'addSound', delete_sound: 'deleteSound' };
    if (simple[block.name]) {
      const r = await bridge(simple[block.name], p, 30000);
      turn.others += 1;
      addAct(r.msg);
      return r.msg;
    }
    if (block.name === 'manage_variable') {
      const r = await bridge('manageVariable', p);
      turn.others += 1;
      addAct(r.msg);
      return r.msg;
    }
    if (block.name === 'set_monitor') {
      const r = await bridge('setMonitor', p);
      turn.others += 1;
      addAct(r.msg);
      return r.msg;
    }
    throw new Error('知らない道具です: ' + block.name);
  }

  function setBusy(v) {
    busy = v;
    renderControls();
  }

  // 料金を下げる工夫：変わらない部分（道具の説明・指示文・作品の様子）をAPI側で使い回す
  function cachedTools(tools) {
    if (!tools.length) return tools;
    const copy = tools.slice();
    copy[copy.length - 1] = Object.assign({}, copy[copy.length - 1], { cache_control: { type: 'ephemeral' } });
    return copy;
  }

  async function send(raw, opts) {
    opts = opts || {};
    const text = String(raw || '').trim();
    if (!text || busy) return;
    if (!alive()) { addReload(); return; }
    if (!allowedNow()) { renderControls(); return; }
    if (personalInfoFound(text)) {
      addErr('メールアドレスや電話番号のような文字があるよ。インターネットに個人情報は書かないようにしよう。消してからもう一度送ってね。');
      return;
    }
    const lim = Number(settings.dailyLimit) || 0;
    if (lim && !unlockedNow() && (await getTodayCount()) >= lim) {
      addErr('今日AIに聞ける回数は、ここまでだよ。続きは先生に相談してね。');
      return;
    }
    if (!opts.keepHint) hintStage = 0;
    layer.querySelectorAll('.hint-more').forEach((x) => x.remove());
    if (!opts.fromInput) { /* ボタンからのときは入力欄をそのまま */ } else { input.value = ''; input.style.height = 'auto'; }
    clearHighlights();
    addMe(text);
    try { chrome.runtime.sendMessage({ type: 'countQuestion' }, () => { void chrome.runtime.lastError; renderQuota(); }); } catch (e) { /* noop */ }

    const level = currentLevel();
    const apiText = opts.hidden ? text + '\n' + opts.hidden : text;
    history.push({ role: 'user', content: [{ type: 'text', text: apiText }] });
    trimHistory();
    const turnIndex = history.length - 1;
    const turn = { snapshot: null, added: 0, removed: 0, created: [], sprites: [], costumes: 0, others: 0, aiTexts: [], toolLog: [], error: '' };

    setBusy(true);
    const thinking = document.createElement('div');
    thinking.className = 'think';
    thinking.textContent = '考え中…';
    msgs.appendChild(thinking);
    scrollDown();

    let lastAiBubble = null;
    try {
      const dump = (await bridge('getProjectDump')).text;
      const tools = toolsFor(opts.toolLevel ? Math.min(level, opts.toolLevel) : level);
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const body = {
          max_tokens: 6000,
          system: [{ type: 'text', text: systemPrompt(level, mode), cache_control: { type: 'ephemeral' } }],
          messages: buildMessages(turnIndex, dump, tools.map((t) => t.name))
        };
        if (tools.length) body.tools = cachedTools(tools);

        // 返事を少しずつ表示する
        let live = null;
        const res = await askClaudeStream(body, (full) => {
          if (!live) {
            thinking.remove();
            live = aiBubble();
            msgs.appendChild(thinking);
          }
          live.t.innerHTML = '';
          richText(live.t, full);
          scrollDown();
        });
        history.push({ role: 'assistant', content: res.content });

        const textOut = res.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
        if (textOut) {
          if (live) {
            live.t.innerHTML = '';
            richText(live.t, textOut);
            addAiTools(live.d, textOut);
            logView('ai', textOut);
            lastAiBubble = live.d;
          } else {
            thinking.remove();
            lastAiBubble = addAi(textOut);
            msgs.appendChild(thinking);
          }
          turn.aiTexts.push(textOut);
        } else if (live) {
          live.d.remove();
        }

        const uses = res.content.filter((c) => c.type === 'tool_use');
        if (res.stop_reason !== 'tool_use' || !uses.length) break;

        const results = [];
        for (const u of uses) {
          try {
            const out = await runTool(u, turn);
            results.push({ type: 'tool_result', tool_use_id: u.id, content: out });
            turn.toolLog.push(u.name + '○');
          } catch (e) {
            results.push({ type: 'tool_result', tool_use_id: u.id, content: 'エラー: ' + e.message, is_error: true });
            turn.toolLog.push(u.name + '×（' + e.message + '）');
          }
        }
        history.push({ role: 'user', content: results });
        if (round === MAX_TOOL_ROUNDS - 1) addErr('AIの作業が長くなったので、いったん止めたよ。続きをお願いしてみてね。');
      }
    } catch (e) {
      const msg = String(e.message || e);
      turn.error = msg;
      if (msg === 'NO_KEY') addErr('AIの設定（教室コード）がまだです。先生に設定してもらってね。', true);
      else if (msg === 'RELOAD' || /context invalidated|sendMessage/i.test(msg)) addReload();
      else if (/Scratch/.test(msg)) addErr('Scratchのエディタとつながりませんでした。ページを読みこみ直してみてね。（' + msg + '）');
      else addErr('AIとの通信でエラーが出ました。少し待ってもう一度ためしてね。（' + msg + '）');
      // 途中で失敗したターンは履歴から外す（次の会話がこわれないように）
      history = history.slice(0, turnIndex);
    } finally {
      thinking.remove();
      setBusy(false);
    }

    if (turn.snapshot) {
      const box = lastAiBubble || addAi('ブロックを変えたよ。');
      const row = document.createElement('div');
      row.className = 'undo-row';
      const note = document.createElement('span');
      note.className = 'undo-note';
      const parts = [];
      if (turn.added) parts.push('追加 ' + turn.added);
      if (turn.removed) parts.push('削除 ' + turn.removed);
      const bits = [];
      if (parts.length) bits.push(parts.join('・') + ' ブロック');
      if (turn.sprites.length) bits.push('スプライト ' + turn.sprites.join('、'));
      if (turn.costumes) bits.push('コスチューム・背景 ' + turn.costumes);
      if (turn.others) bits.push('そのほかの変更 ' + turn.others);
      if (turn.created.length) bits.push('新しく作った：' + turn.created.join('、'));
      note.textContent = bits.join(' ／ ') || '変更あり';
      const ub = document.createElement('button');
      ub.className = 'btn';
      ub.textContent = '元にもどす';
      const self = document.createElement('button');
      self.className = 'btn';
      self.textContent = '自分で組んでみる';
      self.title = 'AIが作ったものを元にもどして、お手本を見ながら自分で組む';
      const token = turn.snapshot;
      const doUndo = async () => {
        await bridge('undo', { token });
        clearHighlights();
        ub.disabled = true;
        self.disabled = true;
        ub.textContent = 'もどしました';
        history.push({ role: 'user', content: [{ type: 'text', text: '（さっきAIが変えたところを、元にもどしました）' }] });
        history.push({ role: 'assistant', content: [{ type: 'text', text: 'わかった、元にもどったよ。' }] });
        logView('act', '（AIが変えたところを元にもどしました）');
        saveChat();
        sendLog({ type: 'undo', student: '', ai: '', tools: '', errors: '' });
      };
      ub.addEventListener('click', async () => {
        ub.disabled = true;
        try { await doUndo(); } catch (e) { ub.disabled = false; addErr('元にもどせませんでした（' + e.message + '）'); }
      });
      self.addEventListener('click', async () => {
        if (busy) return;
        self.disabled = true;
        try {
          await doUndo();
          send('自分で組んでみたい', {
            hidden: '（さっきAIが作ったものは元にもどしたので、いまは作品にありません。子どもが自分で組めるように、使うブロックを [[block:...]] で順番に見せて、組み方のポイントを短く説明し、最後に [[challenge:組むものの短い説明]] を出してください。ブロックは変えないでください）',
            toolLevel: 2,
            logType: 'challenge'
          });
        } catch (e) { self.disabled = false; addErr('元にもどせませんでした（' + e.message + '）'); }
      });
      row.appendChild(note);
      row.appendChild(ub);
      row.appendChild(self);
      box.appendChild(row);
      scrollDown();
    } else if (lastAiBubble && !turn.error) {
      addHintButton(lastAiBubble);
    }
    if (settings.autoRead && turn.aiTexts.length) speak(turn.aiTexts.join('\n'));
    saveChat();
    renderQuota();
    sendLog({ type: opts.logType || 'talk', student: text, ai: turn.aiTexts.map(plainText).join('\n'), tools: turn.toolLog.join(', '), errors: turn.error });
  }

  // 会話の記録をスプレッドシートへ（送るのは background。失敗したら次の機会に送り直す）
  function sendLog(row) {
    if (!settings.logOn || !settings.logUrl || !alive()) return;
    const full = Object.assign({
      time: new Date().toISOString(),
      pc: settings.pcName || '',
      project: projectKey().slice(5),
      level: 'Lv' + currentLevel(),
      mode: mode === 'debug' ? 'バグ調査' : '相談'
    }, row);
    try {
      chrome.runtime.sendMessage({ type: 'log', row: full }, () => { void chrome.runtime.lastError; });
    } catch (e) { /* noop */ }
  }

  // ---------------------------------------------------------------
  // 全角数字（０〜９）を赤の太字にする（まちがえて全角で入れたのに気づけるように）
  // ---------------------------------------------------------------
  const ZEN = /[０-９]/;
  function markZenkaku() {
    try {
      document.querySelectorAll('.blocklyWorkspace text.blocklyText').forEach((t) => {
        const bad = ZEN.test(t.textContent || '');
        const marked = t.getAttribute('data-zen') === '1';
        if (bad && !marked) {
          t.setAttribute('data-zen', '1');
          t.style.setProperty('fill', '#E03131', 'important');
          t.style.setProperty('font-weight', 'bold', 'important');
        } else if (!bad && marked) {
          t.removeAttribute('data-zen');
          t.style.removeProperty('fill');
          t.style.removeProperty('font-weight');
        }
      });
      // 入力中の欄
      const inp = document.querySelector('.blocklyHtmlInput');
      if (inp) {
        const bad = ZEN.test(inp.value || '');
        inp.style.setProperty('color', bad ? '#E03131' : '', bad ? 'important' : '');
        inp.style.setProperty('font-weight', bad ? 'bold' : '', bad ? 'important' : '');
      }
    } catch (e) { /* noop */ }
  }
  setInterval(markZenkaku, 400);

  // ---------------------------------------------------------------
  // スタート
  // ---------------------------------------------------------------
  loadSettings().then(() => { if (settings.stageFolded) layer.querySelector('.sbtn.fold').click(); applyFont(); setView(view); layout(); renderControls(); });
  // ---------------------------------------------------------------
  // Scratchのページ（拡張機能）からの合図
  // ---------------------------------------------------------------
  HOST.on((d) => {
    if (d.kind === 'open') {
      // 学習モードは、普段の画面とは別の画面で開く
      if (d.view === 'learn') { if (window.BlockLearn) window.BlockLearn.open(); return; }
      if (d.view === 'ai' && view === 'code') setView('both');
      if (d.view === 'code' && view === 'ai') setView('both');
      if (!open) setOpen(true); else checkProjectChange();
    } else if (d.kind === 'path') {
      checkProjectChange();
    }
  });
  HOST.post({ kind: 'ready' });
})();
