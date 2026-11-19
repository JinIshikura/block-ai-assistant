# ステップ3「書く」（第6〜10回とまとめテスト）を course.json に書きこむ
#   python3 tools/step3.py
import json, os

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(R, 'public', 'learn', 'course.json')
course = json.load(open(P, encoding='utf-8'))

CAT = '@when_flag_clicked\ndef script1():\n    go_to(0, -140)\n    while True:\n        if key_pressed("右向き矢印"):\n            change_x(10)\n        if key_pressed("左向き矢印"):\n            change_x(-10)'
APPLE_STAY = '@when_flag_clicked\ndef script1():\n    go_to(0, 170)'
CAT_STAY = '@when_flag_clicked\ndef script1():\n    go_to(0, -140)'
APPLE_RET = '@when_flag_clicked\ndef script1():\n    go_to(0, 170)\n    while True:\n        change_y(-5)\n        if y_position() < -170:\n            go_to(random(-200, 200), 170)'
APPLE_MISS = APPLE_RET.replace('        if y_position() < -170:\n', '        if y_position() < -170:\n            broadcast("ミス")\n')


def ex(id, title, sprite, starter, goals, hints, checks, **kw):
    d = {'id': id, 'title': title, 'project': 'catch.sb3', 'sprite': sprite, 'starter': starter, 'goals': goals, 'hints': hints, 'checks': checks}
    for c in checks:
        if c['type'] == 'code' and 'sprite' not in c: c['sprite'] = sprite
    d.update(kw)
    return d


def code(label, line=None, pattern=None, indent=None, fail='', sprite=None):
    c = {'type': 'code', 'label': label, 'fail': fail}
    if line is not None: c['line'] = line
    if pattern is not None: c['pattern'] = pattern
    if indent is not None: c['indent'] = indent
    if sprite: c['sprite'] = sprite
    return c


def run(label, ms, expect, fail, keys=None, answers=None, setup=None):
    c = {'type': 'run', 'label': label, 'ms': ms, 'expect': expect, 'fail': fail}
    if keys: c['keys'] = keys
    if answers: c['answers'] = answers
    if setup: c['setup'] = setup
    return c


said = lambda sp, t, **k: dict({'kind': 'said', 'sprite': sp, 'text': t}, **k)

# ---------------------------------------------------------------- 第6回
l6 = {
    'id': 'l6', 'title': '第6回　input() で質問する',
    'slides': [
        {'title': '質問して、答えを使う',
         'text': 'Scratchの「〇と聞いて待つ」と「答え」は、Pythonでは input() 1つで書ける。\n名前 = input("名前は？") は、「名前は？」と質問して待ち、答えを変数「名前」に入れる。',
         'code': '名前 = input("名前は？")\nsay_for("こんにちは、" + 名前 + "！", 2)'},
        {'title': '文字をつなぐ ＋',
         'text': '文字と文字の ＋ は「つなぐ」（Scratchの「〇と〇」ブロック）。数と数の ＋ は足し算になる。\n"こんにちは、" + 名前 + "！" は、名前が「たろう」なら「こんにちは、たろう！」になる。',
         'code': '"こんにちは、" + "たろう" + "！"   # → こんにちは、たろう！\n3 + 4                         # → 7'},
        {'title': '答えで分ける if と else',
         'text': 'else: は「でなければ」。if と同じ深さに書き、その中はもう1段下げる。\n比べるときは = ではなく == を使う。',
         'code': '答え = input("3 × 4 は？")\nif 答え == "12":\n    say_for("正解！", 2)\nelse:\n    say_for("ざんねん", 2)'},
        {'title': '数として使うときは int()',
         'text': '本物のPythonでは、input() の答えは「文字」になる。計算に使うときは int() で数にする。\n動かしてみると、ステージの下に答えを書く欄が出る。判定のときは、プログラムが自動で答えるよ。',
         'code': 'a = int(input("1つめの数は？"))\nb = int(input("2つめの数は？"))\nsay_for(a + b, 2)'},
    ],
    'exercises': [
        ex('l6e1', '名前を聞いてあいさつしよう', 'ネコ',
           {'リンゴ': APPLE_STAY, 'ネコ': CAT_STAY + '\n    # ここに、名前を聞いてあいさつするコードを書こう'},
           ['「名前は？」と質問して、答えを変数「名前」に入れる', '「こんにちは、〇〇！」と2秒言う（〇〇は答えた名前）'],
           ['input("名前は？") で質問できる。', '名前 = input("名前は？") と書くと、答えが「名前」に入る。', 'say_for("こんにちは、" + 名前 + "！", 2) で、文字をつないで言える。'],
           [code('名前を聞いて、変数「名前」に入れている', line='名前 = input("名前は？")', indent=1, fail='名前 = input("名前は？") を、go_to の次の行に書こう。'),
            run('答えた名前であいさつする', 3200, [said('ネコ', 'こんにちは、たろう！')], '「たろう」と答えたのに、「こんにちは、たろう！」と言わなかったよ。「、」や「！」もまちがえずに。', answers=[{'at': 700, 'text': 'たろう'}])]),
        ex('l6e2', 'かけ算クイズを作ろう', 'ネコ',
           {'リンゴ': APPLE_STAY, 'ネコ': CAT_STAY + '\n    答え = input("3 × 4 は？")\n    # 答えが 12 なら「正解！」、でなければ「ざんねん」と2秒言う'},
           ['答えが 12 なら「正解！」と2秒言う', 'それ以外なら「ざんねん」と2秒言う（else を使う）'],
           ['if 答え == "12": と書く。比べるのは == 。', 'else: は if と同じ深さに書く。', 'if の中と else の中に、それぞれ say_for(..., 2) を1段下げて書く。'],
           [code('if で答えを比べている', line='if 答え == 12:', indent=1, fail='if 答え == "12": を書こう（= ではなく ==）。'),
            code('else を使っている', line='else:', indent=1, fail='else: を if と同じ深さに書こう。'),
            run('12 と答えると「正解！」', 3000, [said('ネコ', '正解')], '12 と答えたのに「正解！」と言わなかったよ。', answers=[{'at': 700, 'text': '12'}]),
            run('10 と答えると「ざんねん」', 3000, [said('ネコ', 'ざんねん'), {'kind': 'notSaid', 'sprite': 'ネコ', 'text': '正解'}], '10 と答えたときは「ざんねん」だけを言うようにしよう。', answers=[{'at': 700, 'text': '10'}])]),
        ex('l6e3', '足し算マシンを作ろう', 'ネコ',
           {'リンゴ': APPLE_STAY, 'ネコ': CAT_STAY + '\n    # 数を2つ聞いて、足した答えを2秒言う'},
           ['「1つめの数は？」「2つめの数は？」と2回質問する', '2つの数を足した答えを2秒言う'],
           ['a = int(input("1つめの数は？")) で、答えを数として a に入れられる。', '2つめも同じように b に入れる。', 'say_for(a + b, 2) で足した答えを言う。'],
           [code('質問の答えを変数に入れている', pattern='^\\S+ = input\\(', indent=1, fail='a = int(input("1つめの数は？")) のように、答えを変数に入れよう。'),
            run('3 と 4 なら 7 と言う', 4200, [said('ネコ', '7')], '3 と 4 と答えたのに、7 と言わなかったよ。', answers=[{'at': 700, 'text': '3'}, {'at': 1500, 'text': '4'}])]),
    ]
}

# ---------------------------------------------------------------- 第7回
l7 = {
    'id': 'l7', 'title': '第7回　while と random で動きを作る',
    'slides': [
        {'title': '条件つきのくり返し while',
         'text': 'while True: は「ずっと」。while のうしろに条件を書くと、「条件が正しいあいだ、くり返す」になる。\nScratchの「〜まで繰り返す」とは条件が反対になるので注意。下の例は「y座標が -170 より上のあいだ、下に動く」。',
         'code': 'while y_position() > -170:\n    change_y(-5)\nprint("落ちた！")'},
        {'title': '変数で速さを変える',
         'text': 'change_y(-5) の 5 を変数にすると、あとから速さを変えられる。\nchange_y(-速さ) は「速さ」の分だけ下に動く。速さ = 速さ + 1 で1ずつ速くなる。',
         'code': '速さ = 3\nwhile True:\n    change_y(-速さ)\n    if y_position() < -170:\n        go_to(random(-200, 200), 170)\n        速さ = 速さ + 1'},
        {'title': 'random で毎回ちがう結果',
         'text': 'random(1, 6) は、1から6までのどれかの数になる（サイコロ）。\n変数に入れておくと、同じ数を何回も使える。',
         'code': '目 = random(1, 6)\nsay_for(str(目) + "が出た！", 1)'},
    ],
    'exercises': [
        ex('l7e1', '下に着くまで落とそう', 'リンゴ',
           {'リンゴ': APPLE_STAY + '\n    # y座標が -170 より上のあいだ、5ずつ下に動かす\n    # 下に着いたら「落ちた！」と言う（print）', 'ネコ': CAT_STAY},
           ['y座標が -170 より上のあいだだけ、5ずつ下に動かす（while と条件）', '下に着いたら「落ちた！」と言う'],
           ['while のうしろに条件を書く。「y座標が -170 より上」は y_position() > -170 。', 'while の中に change_y(-5) を1段下げて書く。', 'print("落ちた！") は while の外（while と同じ深さ）に書く。'],
           [code('条件つきの while を使っている', pattern='^while (?!True:).+:$', indent=1, fail='while True: ではなく、while y_position() > -170: のように条件を書こう。'),
            run('下まで落ちて「落ちた！」と言う', 4000, [{'kind': 'final', 'sprite': 'リンゴ', 'prop': 'y', 'op': '<', 'value': -160}, said('リンゴ', '落ちた')], 'リンゴが下まで落ちて「落ちた！」と言うようにしよう。print は while の外に書くよ。')]),
        ex('l7e2', 'だんだん速くしよう', 'リンゴ',
           {'リンゴ': '@when_flag_clicked\ndef script1():\n    速さ = 5\n    go_to(0, 170)\n    while True:\n        change_y(-5)\n        if y_position() < -170:\n            go_to(random(-200, 200), 170)', 'ネコ': CAT_STAY},
           ['下に動く量を、変数「速さ」にする', '下に着いて上にもどるたびに、速さを1ずつ増やす'],
           ['change_y(-5) の 5 を 速さ に変える。', '上にもどる go_to の次の行に、速さを1増やす行を書く。', '速さ = 速さ + 1 を、if の中（go_to と同じ深さ）に書く。'],
           [code('速さの変数で動かしている', pattern='^change_y\\(.*速さ.*\\)$', indent=2, fail='change_y(-速さ) のように、5 のかわりに 速さ を使おう。'),
            code('速さを1ずつ増やしている', line='速さ = 速さ + 1', indent=3, fail='速さ = 速さ + 1 を、if の中に書こう。'),
            run('だんだん速くなる', 6000, [{'kind': 'var', 'name': '速さ', 'op': '>=', 'value': 7}, {'kind': 'returnAfter', 'sprite': 'リンゴ', 'prop': 'y', 'below': -60, 'above': 120}], 'もどるたびに速さが増えていないようだよ。')]),
        ex('l7e3', 'サイコロをふろう', 'ネコ',
           {'リンゴ': APPLE_STAY, 'ネコ': CAT},
           ['スペースキーを押したら、1〜6の乱数を変数「目」に入れる', '「〇が出た！」と1秒言う（〇は目の数）'],
           ['@when_key_pressed("スペース") から始まるまとまりを、新しく書く。', '目 = random(1, 6) で、1〜6のどれかが入る。', 'say_for(str(目) + "が出た！", 1) で言える。'],
           [code('スペースキーのまとまりがある', line='@when_key_pressed("スペース")', indent=0, fail='@when_key_pressed("スペース") と def script2(): を書こう。'),
            code('1〜6の乱数を「目」に入れている', line='目 = random(1, 6)', indent=1, fail='目 = random(1, 6) を書こう。'),
            run('スペースで「〇が出た！」と言う', 1800, [said('ネコ', 'が出た'), {'kind': 'var', 'name': '目', 'op': '>=', 'value': 1}, {'kind': 'var', 'name': '目', 'op': '<=', 'value': 6}], 'スペースキーを押したのに「〇が出た！」と言わなかったよ。', keys=[{'key': 'space', 'at': 300, 'hold': 200}])]),
    ]
}

# ---------------------------------------------------------------- 第8回
l8 = {
    'id': 'l8', 'title': '第8回　まとまりとメッセージ',
    'slides': [
        {'title': 'def は命令のまとまり',
         'text': '@when_flag_clicked と def script1(): は、「旗が押されたら、このまとまりを動かす」という意味。\ndef は「命令のまとまりに名前をつける」書き方。本物のPythonでは、自分で名前をつけたまとまり（関数）を作って、何回でも呼び出せる。',
         'code': '@when_flag_clicked\ndef script1():\n    go_to(0, -140)\n\n@when_key_pressed("スペース")\ndef script2():\n    say_for("ジャンプ！", 1)'},
        {'title': 'メッセージを送る・受け取る',
         'text': 'broadcast("ミス") は、Scratchの「ミスを送る」。\n@when_broadcast_received("ミス") から始まるまとまりは、「ミスを受け取ったとき」に動く。ほかのスプライトに合図を送れる。',
         'code': '# リンゴ\nbroadcast("ミス")\n\n# ネコ\n@when_broadcast_received("ミス")\ndef script2():\n    say_for("あっ！", 1)'},
        {'title': 'まとまりを書く場所',
         'text': '新しいまとまりは、いまあるまとまりのあとに、1行あけて書く。@ の行と def の行は字下げしない（0段目）。\nscript1、script2 … の番号は、同じスプライトの中で重ならなければよい。',
         'code': '@when_flag_clicked\ndef script1():\n    ...\n\n@when_broadcast_received("スタート")\ndef script2():\n    ...'},
    ],
    'exercises': [
        ex('l8e1', 'ミスを受け取ろう', 'ネコ',
           {'リンゴ': APPLE_MISS, 'ネコ': CAT},
           ['リンゴは下に着くと「ミス」を送る。ネコでそれを受け取る', '受け取ったら、ネコが「あっ！」と1秒言う'],
           ['いまのまとまりのあとに、1行あけて新しいまとまりを書く。', '@when_broadcast_received("ミス") の次の行に def script2(): を書く。', 'その中に say_for("あっ！", 1) を1段下げて書く。'],
           [code('「ミス」を受け取るまとまりがある', line='@when_broadcast_received("ミス")', indent=0, fail='@when_broadcast_received("ミス") を、字下げしないで書こう。'),
            run('ミスのとき「あっ！」と言う', 4500, [said('ネコ', 'あっ')], 'リンゴが下に着いたのに、ネコが「あっ！」と言わなかったよ。')]),
        ex('l8e2', 'ミスを送ろう', 'リンゴ',
           {'リンゴ': APPLE_RET, 'ネコ': CAT + '\n\n@when_broadcast_received("ミス")\ndef script2():\n    say_for("ドンマイ！", 1)'},
           ['リンゴが下に着いたとき、「ミス」を送る', 'ネコには受け取るまとまりがもうある（「ドンマイ！」と言う）'],
           ['下に着いたときに動くのは、if y_position() < -170: の中。', 'その中に broadcast("ミス") を書く。', 'go_to と同じ深さ（3段目）に broadcast("ミス") を書く。'],
           [code('下に着いたとき「ミス」を送っている', line='broadcast("ミス")', indent=3, fail='broadcast("ミス") を、if の中に書こう。'),
            run('ネコが「ドンマイ！」と言う', 4500, [said('ネコ', 'ドンマイ')], 'リンゴが下に着いたのに、ネコが「ドンマイ！」と言わなかったよ。')]),
        ex('l8e3', 'スタートの合図を作ろう', 'リンゴ',
           {'リンゴ': APPLE_RET, 'ネコ': CAT_STAY + '\n    say_for("よーい、スタート！", 2)\n    broadcast("スタート")'},
           ['ネコは「よーい、スタート！」と言ってから「スタート」を送る', 'リンゴは、旗ではなく「スタート」を受け取ってから落ち始める'],
           ['リンゴのまとまりの、はじまりの行を変える。', '@when_flag_clicked を @when_broadcast_received("スタート") にする。', 'ほかの行はそのままでよい。'],
           [code('「スタート」で始まる', line='@when_broadcast_received("スタート")', indent=0, fail='はじまりの行を @when_broadcast_received("スタート") にしよう。'),
            run('合図のあとに落ち始める', 4200, [{'kind': 'still', 'sprite': 'リンゴ', 'prop': 'y', 'from': 300, 'until': 1700, 'tol': 3}, {'kind': 'decrease', 'sprite': 'リンゴ', 'prop': 'y', 'from': 2400, 'min': 40}], 'リンゴが、ネコの合図より前に落ち始めているか、落ちていないよ。', setup=[{'sprite': 'リンゴ', 'x': 0, 'y': 170, 'at': 0}])]),
    ]
}

# ---------------------------------------------------------------- 第9回
l9 = {
    'id': 'l9', 'title': '第9回　リストを使う',
    'slides': [
        {'title': 'リストは、データをならべて入れる箱',
         'text': '[ ] の中に , で区切ってならべると、リストになる（Scratchの「リスト」）。\n1つの変数に、いくつものデータを入れられる。',
         'code': 'ことば = ["やったね", "すごい", "その調子"]'},
        {'title': '番号で取り出す（0から数える）',
         'text': 'Pythonは 0 から数える。ことば[0] は "やったね"、ことば[2] は "その調子"。Scratchの「1番目」が、Pythonでは [0] になる。\nことば[random(0, 2)] で、どれか1つをえらべる。',
         'code': 'say_for(ことば[0], 1)              # やったね\nsay_for(ことば[random(0, 2)], 1)  # どれか1つ'},
        {'title': 'append で追加、len で長さ',
         'text': '記録.append(x) は、リストのいちばん後ろに x を追加する（Scratchの「〇を追加する」）。\nlen(記録) は、リストに入っている数（長さ）。',
         'code': '記録 = []\n記録.append(120)\n記録.append(-40)\nsay_for(len(記録), 2)   # 2'},
    ],
    'exercises': [
        ex('l9e1', 'ほめことばリストを作ろう', 'ネコ',
           {'リンゴ': APPLE_STAY, 'ネコ': CAT},
           ['スペースキーを押したら、リスト「ことば」に "やったね" "すごい" "その調子" の3つを入れる', 'その中からランダムに1つえらんで、1秒言う'],
           ['@when_key_pressed("スペース") のまとまりを新しく書く。', 'ことば = ["やったね", "すごい", "その調子"] でリストが作れる。', 'say_for(ことば[random(0, 2)], 1) で、ランダムに1つ言える。'],
           [code('ランダムな番号で取り出している', pattern='ことば\\[random\\(0, 2\\)\\]', fail='ことば[random(0, 2)] で、ランダムに取り出そう（0から2）。'),
            run('スペースで、ほめことばを言う', 1800, [{'kind': 'list', 'name': 'ことば', 'length': 3, 'includes': ['やったね', 'すごい', 'その調子']}, said('ネコ', '', texts=['やったね', 'すごい', 'その調子'])], 'スペースキーを押したのに、リストのことばを言わなかったよ。', keys=[{'key': 'space', 'at': 300, 'hold': 200}])]),
        ex('l9e2', '落ちた場所を記録しよう', 'リンゴ',
           {'リンゴ': APPLE_RET.replace('    go_to(0, 170)\n', '    記録 = []\n    go_to(0, 170)\n', 1), 'ネコ': CAT_STAY},
           ['リンゴが下に着くたびに、そのときのx座標をリスト「記録」に追加する'],
           ['下に着いたときに動くのは if の中。', 'x座標は x_position() 。', '記録.append(x_position()) を、if の中の go_to より前に書く。'],
           [code('x座標を記録に追加している', line='記録.append(x_position())', indent=3, fail='記録.append(x_position()) を、if の中に書こう。'),
            run('下に着くたびに記録がふえる', 6200, [{'kind': 'list', 'name': '記録', 'minLength': 2}], '下に着いたのに、記録がふえていないよ。')]),
    ]
}

# ---------------------------------------------------------------- 第10回
l10 = {
    'id': 'l10', 'title': '第10回　Scratchの外のPythonへ',
    'slides': [
        {'title': '本物のPythonでも、同じ考え方',
         'text': 'ここまでの 変数・if・while・for・リスト・input() は、本物のPythonでもそのまま使える。\nちがうのは、スプライトやステージがないこと。言葉は print() で画面に文字として出す。',
         'code': '名前 = input("名前は？")\nprint("こんにちは、" + 名前 + "！")'},
        {'title': 'このツールと本物のPythonのちがい',
         'text': 'say_for("こんにちは", 2) → print("こんにちは")\nrandom(1, 6) → random.randint(1, 6)（最初に import random と書く）\nwait(1) → time.sleep(1)（最初に import time と書く）\ninput() と int()・str()・len() は同じ。',
         'code': 'import random\n目 = random.randint(1, 6)\nprint(str(目) + "が出た！")'},
        {'title': '数あてゲーム（本物のPython）',
         'text': 'while と if と input() を組み合わせると、ゲームが作れる。演習では、これをScratchの中で作ってみよう。',
         'code': 'import random\n正解 = random.randint(1, 10)\n予想 = int(input("1から10の数は？"))\nwhile 予想 != 正解:\n    if 予想 < 正解:\n        print("もっと大きい")\n    else:\n        print("もっと小さい")\n    予想 = int(input("1から10の数は？"))\nprint("あたり！")'},
        {'title': 'これからPythonを書くには',
         'text': 'パソコンにPythonを入れると、自分のパソコンで本物のPythonが書ける。ブラウザで書けるサービスもある。\nどれを使うかは、おうちの人や先生と相談してね。',
         'code': ''},
    ],
    'exercises': [
        ex('l10e1', '数あてゲームを作ろう', 'ネコ',
           {'リンゴ': APPLE_STAY, 'ネコ': CAT_STAY + '\n    正解 = 7\n    予想 = int(input("1から10の数は？"))\n    # 予想が正解とちがうあいだ、くり返す\n    #   予想が小さければ「もっと大きい」、大きければ「もっと小さい」と1秒言う\n    #   そのあと、もう一度質問して予想に入れる\n    print("あたり！")'},
           ['予想が正解（7）とちがうあいだ、くり返す', '小さければ「もっと大きい」、大きければ「もっと小さい」と1秒言って、もう一度聞く', 'あたったら「あたり！」と言う'],
           ['while 予想 != 正解: で「ちがうあいだ」くり返す（!= は「ちがう」）。', 'while の中に if 予想 < 正解: と else: を書く。', 'while の中のいちばん最後に、予想 = int(input("1から10の数は？")) を書く。'],
           [code('「ちがうあいだ」くり返している', pattern='^while .*予想.*:$', indent=1, fail='while 予想 != 正解: を書こう。'),
            run('3 → 9 → 7 と答えて遊べる', 5600, [said('ネコ', 'もっと大きい'), said('ネコ', 'もっと小さい'), said('ネコ', 'あたり')], '3、9、7 の順に答えたけれど、「もっと大きい」「もっと小さい」「あたり！」の順に言わなかったよ。', answers=[{'at': 700, 'text': '3'}, {'at': 2300, 'text': '9'}, {'at': 3900, 'text': '7'}])]),
        ex('l10e2', '1から10まで足そう', 'ネコ',
           {'リンゴ': APPLE_STAY, 'ネコ': CAT_STAY + '\n    合計 = 0\n    # for を使って、1から10までを合計に足していく\n    # 最後に合計を2秒言う'},
           ['for を使って、1 + 2 + … + 10 を計算する', '答え（合計）を2秒言う'],
           ['for i in range(1, 11): は、i が 1, 2, … 10 と変わりながらくり返す（11 は入らない）。', 'くり返しの中で 合計 = 合計 + i 。', '最後に for の外で say_for(合計, 2) 。'],
           [code('for で1から10までくり返している', line='for i in range(1, 11):', indent=1, fail='for i in range(1, 11): を書こう（11 は入らないので、10 まで）。'),
            run('合計が 55 になる', 2600, [{'kind': 'var', 'name': '合計', 'value': 55}, said('ネコ', '55')], '合計が 55 にならなかったよ。range の数と、足す行の字下げを見直そう。')]),
    ]
}

# ---------------------------------------------------------------- まとめテスト
r3 = {
    'id': 'r3', 'title': 'ステップ3　まとめテスト',
    'slides': [
        {'title': 'ステップ3のまとめ',
         'text': 'input() で質問する、while に条件をつける、random、メッセージ、リスト、for。\nまとめテストでは、ヒントが少なめ。目標をよく読んで、自分で組み立ててみよう。',
         'code': ''},
    ],
    'exercises': [
        ex('r3e1', 'ミス3回でゲームオーバー', 'リンゴ',
           {'リンゴ': APPLE_STAY.replace('go_to(0, 170)', 'go_to(random(-200, 200), 170)') + '\n    # ここから書こう', 'ネコ': CAT},
           ['変数「ミス」を 0 から始める', 'ミスが3より小さいあいだ、6ずつ下に動く', '下に着いたら、ミスを1増やして上（x座標はランダム）にもどる', 'ミスが3になったら「ゲームオーバー」と言う'],
           ['while ミス < 3: でくり返す。', '下に着いたかは if y_position() < -170: 。'],
           [code('ミスの数でくり返しを止めている', pattern='^while .*ミス.*:$', indent=1, fail='while ミス < 3: のように、ミスを使った条件を書こう。'),
            run('3回落ちたらゲームオーバー', 7500, [{'kind': 'var', 'name': 'ミス', 'value': 3}, said('リンゴ', 'ゲームオーバー'), {'kind': 'returnAfter', 'sprite': 'リンゴ', 'prop': 'y', 'below': -60, 'above': 120}], '3回落ちたあとに「ゲームオーバー」と言って止まるようにしよう。')]),
        ex('r3e2', '3問クイズを作ろう', 'ネコ',
           {'リンゴ': APPLE_STAY, 'ネコ': CAT_STAY + '\n    問題 = ["2 + 3 は？", "4 × 5 は？", "10 - 7 は？"]\n    正解 = ["5", "20", "3"]\n    点数 = 0\n    # for を使って3問出す。正解なら点数を1ふやす\n    say_for("点数は" + str(点数) + "点", 2)'},
           ['for で3回くり返して、問題を順に質問する', '答えが正解と同じなら、点数を1ふやす', '最後の「点数は〇点」はそのまま'],
           ['for i in range(3): なら、i は 0, 1, 2 。問題[i] で i 番の問題。', 'if 答え == 正解[i]: で比べる。'],
           [code('for で3回くり返している', line='for i in range(0, 3):', indent=1, fail='for i in range(3): を書こう。'),
            run('5・20・4 と答えると 2点', 4600, [said('ネコ', '点数は2点')], '5、20、4 と答えたので「点数は2点」になるはずだよ。', answers=[{'at': 700, 'text': '5'}, {'at': 1300, 'text': '20'}, {'at': 1900, 'text': '4'}])]),
    ]
}

step3 = {'title': 'ステップ3　書く', 'lessons': [l6, l7, l8, l9, l10, r3]}
course['steps'] = [s for s in course['steps'] if not s['title'].startswith('ステップ3')] + [step3]
json.dump(course, open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ok', sum(len(l['exercises']) for st in course['steps'] for l in st['lessons']), 'exercises')
