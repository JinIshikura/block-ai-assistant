# 学習の課題（public/learn/course.json）と、テスト用の模範解答（tests/answers.json）を作る
#   python3 tools/course.py
# 方針：最初はブロック1つ＝1行から。スライドで説明したコードだけを演習で使う（tests/learn-taught-test.js で確認）
import json, os, re

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(R, 'public', 'learn', 'course.json')
A = os.path.join(R, 'tests', 'answers.json')
answers = {}

FLAG = '@when_flag_clicked\ndef script1():\n'


def prog(*lines, hat=FLAG):
    return hat + '\n'.join('    ' + l if l else '' for l in lines)


def ex(id, title, sprite, starter, goals, hints, checks, answer, others=None, **kw):
    st = {sprite: starter}
    st.update(others or {})
    for c in checks:
        if c['type'] == 'code' and 'sprite' not in c:
            c['sprite'] = sprite
    d = {'id': id, 'title': title, 'project': 'catch.sb3', 'sprite': sprite, 'starter': st, 'goals': goals, 'hints': hints, 'checks': checks}
    d.update(kw)
    answers[id] = answer
    return d


def code(label, line=None, indent=None, fail='', pattern=None, order=None, count=None):
    c = {'type': 'code', 'label': label, 'fail': fail}
    if line is not None: c['line'] = line
    if pattern is not None: c['pattern'] = pattern
    if order is not None: c['order'] = order
    if count is not None: c['count'] = count
    if indent is not None: c['indent'] = indent
    return c


def run(label, ms, expect, fail, keys=None, answers_=None, setup=None):
    c = {'type': 'run', 'label': label, 'ms': ms, 'expect': expect, 'fail': fail}
    if keys: c['keys'] = keys
    if answers_: c['answers'] = answers_
    if setup: c['setup'] = setup
    return c


def slide(title, text, code_=None, plain=False):
    s = {'title': title, 'text': text}
    if code_: s['code'] = code_
    if plain: s['plain'] = True
    return s


said = lambda sp, t, **k: dict({'kind': 'said', 'sprite': sp, 'text': t}, **k)
final = lambda sp, prop, op, v: {'kind': 'final', 'sprite': sp, 'prop': prop, 'op': op, 'value': v}
varies = lambda sp, prop, mn, frm=0: {'kind': 'varies', 'sprite': sp, 'prop': prop, 'min': mn, 'from': frm}
still = lambda sp, prop, frm, until, tol=3: {'kind': 'still', 'sprite': sp, 'prop': prop, 'from': frm, 'until': until, 'tol': tol}
var = lambda name, op, v: {'kind': 'var', 'name': name, 'op': op, 'value': v}
SPACE = [{'key': 'space', 'at': 300, 'hold': 200}]
CAT_AT = [{'sprite': 'ネコ', 'x': 0, 'y': -140, 'at': 0}]
APPLE_STAY = prog('go_to(0, 170)')
CAT_STAY = prog('go_to(0, -140)')

# ================================================================ ステップ1　読む（スモールステップ）
def quiz(id, title, question, choices, answer, explain, code_=None, codeView=None, hint=None):
    d = {'id': id, 'type': 'quiz', 'title': title, 'question': question, 'choices': choices, 'answer': answer, 'explain': explain}
    if code_: d['code'] = code_
    if codeView: d['codeView'] = codeView
    if hint: d['hint'] = hint
    return d

B = lambda c, why=None: dict({'block': c}, **({'why': why} if why else {}))
C = lambda c, why=None: dict({'code': c}, **({'why': why} if why else {}))
T = lambda t, why=None: dict({'text': t}, **({'why': why} if why else {}))
CAT_RL = prog('go_to(0, -140)', 'while True:', '    if key_pressed("右向き矢印"):', '        change_x(10)')
CAT_LR = prog('go_to(0, -140)', 'while True:', '    if key_pressed("右向き矢印"):', '        change_x(10)', '    if key_pressed("左向き矢印"):', '        change_x(-10)')
HAT_NOTE = '上の2行（@when_flag_clicked と def script1():）は「旗が押されたら、下の行を動かす」という決まった書き方。くわしくは第4回で学ぶ。'

a1 = {'id': 'a1', 'title': '第1回　命令は「名前(値)」', 'slides': [
    slide('コードは、命令を文字で書いたもの',
          'プログラムは、コンピューターへの命令をならべたもの。Python（パイソン）では、命令を英語の名前で書く。\nmove は「動かす」という命令。左のブロックと右のコードは同じ意味。',
          'move(10)'),
    slide('( ) の中は「どれだけ」',
          '命令の名前のうしろの ( ) の中に、「どれだけ」を書く。move(10) は10歩、move(50) は50歩動く。\n数やかっこは半角で書く（全角の「（１０）」はエラーになる）。',
          'move(10)\nmove(50)'),
    slide('この回の命令',
          'wait(1) は「1秒待つ」、turn_right(15) は「右に15度回す」。命令の名前は決まっていて、1文字でもちがうと動かない。\n' + HAT_NOTE,
          prog('move(10)', 'wait(1)', 'turn_right(15)')),
], 'exercises': [
    quiz('a1q1', 'move(10) はどのブロック？', 'move(10) と同じ意味のブロックをえらぼう。',
         [B('move(10)'), B('turn_right(10)', 'それは「右に10度回す」。回す命令は turn_right。'), B('wait(10)', 'それは「10秒待つ」。'), B('move(100)', '( ) の中の数が10ではなく100になっているよ。')],
         0, 'move は「動かす」、( ) の中の 10 が歩数。'),
    quiz('a1q2', 'wait(1) はどんな命令？', 'wait(1) の意味をえらぼう。',
         [T('1歩動く', 'wait は動く命令ではないよ。'), T('1秒待つ'), T('1度回す', '回すのは turn_right。')], 1, 'wait は「待つ」。( ) の中は秒数。'),
    ex('a1e1', 'ネコを100歩動かそう', 'ネコ', prog('move(10)'),
       ['ネコが100歩動くようにする'],
       ['( ) の中の数が歩数。', '10 を 100 に書きかえる。', 'move(100) にする（数は半角）。'],
       [code('100歩動かしている', line='move(100)', indent=1, fail='move の ( ) の中を 100 にしよう。'),
        run('ネコが100歩動く', 1200, [final('ネコ', 'x', '>=', 95)], 'ネコが100歩動いていないよ。', setup=CAT_AT)],
       prog('move(100)')),
    ex('a1e2', '待ってから回ろう', 'ネコ', prog('point_in_direction(90)', 'wait(1)', 'turn_right(15)'),
       ['3秒待ってから、右に90度回る'],
       ['待つ秒数は wait の ( ) の中。', '回る角度は turn_right の ( ) の中。', 'wait(3) と turn_right(90) にする。'],
       [code('3秒待つ', line='wait(3)', indent=1, fail='wait の ( ) の中を 3 にしよう。'),
        code('90度回る', line='turn_right(90)', indent=1, fail='turn_right の ( ) の中を 90 にしよう。'),
        run('3秒たってから回る', 4000, [still('ネコ', 'dir', 200, 2700), final('ネコ', 'dir', '>', 175)], '3秒待ってから右に90度回るようにしよう。')],
       prog('point_in_direction(90)', 'wait(3)', 'turn_right(90)')),
]}
a1['slides'][2]['text'] = a1['slides'][2]['text'].replace('wait(1) は', 'wait(1) は')
a1['slides'].insert(2, slide('向きを決める命令',
    'point_in_direction(90) は「90度に向ける」。90 は右向き、-90 は左向き、0 は上向き、180 は下向き。',
    'point_in_direction(90)'))

a2 = {'id': 'a2', 'title': '第2回　文字は " " でかこむ', 'slides': [
    slide('言う命令 print',
          'print("こんにちは") は「こんにちは と言う」。ネコのふきだしに文字が出る。',
          'print("こんにちは")'),
    slide('" " は「ここからここまでが文字」の印',
          '言わせたい文字は " "（半角のダブルクォーテーション）でかこむ。かこまないと、コンピューターは命令や変数の名前だと思ってエラーになる。\n数はかこまなくてよい（move(10)）。',
          'print("こんにちは")\nprint("やあ")\nmove(10)'),
], 'exercises': [
    quiz('a2q1', 'どれが正しい？', '「ニャー」と言わせる正しいコードをえらぼう。',
         [C('print(ニャー)', '" " でかこまないと、ニャー という名前の変数だと思われてしまうよ。'), C('print("ニャー")'), C('print"ニャー"', '値は ( ) の中に書くよ。')],
         1, '文字は " " でかこんで、( ) の中に書く。'),
    quiz('a2q2', 'ネコは何と言う？', 'このコードを動かすと、ネコは何と言う？',
         [T('print', 'print は命令の名前。言うのは " " の中の文字。'), T('やった！'), T('"やった！"', '" " は文字の印なので、ふきだしには出ないよ。')],
         1, '" " の中の文字だけが、ふきだしに出る。', code_='print("やった！")', codeView='code'),
    ex('a2e1', '言うことを変えよう', 'ネコ', prog('print("こんにちは")'),
       ['ネコが「よろしくね」と言うようにする'],
       ['言うことは " " の中の文字。', '" " は消さずに、中の文字だけを書きかえる。', 'print("よろしくね") にする。'],
       [code('「よろしくね」と言う', line='print("よろしくね")', indent=1, fail='print("よろしくね") にしよう。" " を消さないでね。'),
        run('「よろしくね」と言う', 1200, [said('ネコ', 'よろしくね')], '「よろしくね」と言わなかったよ。')],
       prog('print("よろしくね")')),
]}

a3 = {'id': 'a3', 'title': '第3回　値が2つなら , で区切る', 'slides': [
    slide('秒数つきで言う say_for',
          'say_for("こんにちは", 2) は「こんにちは と2秒言う」。( ) の中に値が2つあるときは , （半角のカンマ）で区切る。\n1つめが言うこと、2つめが秒数。順番は決まっている。',
          'say_for("こんにちは", 2)'),
    slide('場所を決める go_to',
          'ステージの真ん中が x座標 0、y座標 0。右へ行くほど x が大きく、上へ行くほど y が大きくなる。左や下はマイナス（-）。\ngo_to(0, -140) は「x座標を0、y座標を-140にする」（真ん中の下の方）。',
          'go_to(0, 0)\ngo_to(0, -140)'),
], 'exercises': [
    quiz('a3q1', '2つめの値は何？', 'say_for("やあ", 3) の 3 は何を表している？',
         [T('言う回数', 'say_for は回数ではなく、言う時間を決めるよ。'), T('言う秒数'), T('文字の大きさ', 'say_for の値は、言うことと秒数の2つ。')],
         1, '1つめが言うこと、2つめが秒数。'),
    quiz('a3q2', 'ネコはどこへ行く？', 'go_to(150, 0) を動かすと、ネコはどこへ行く？',
         [T('真ん中より右'), T('真ん中より左', 'x がプラスなら右だよ。'), T('真ん中より上', '上下は2つめの値（y座標）で決まるよ。')],
         0, '1つめの値が x座標（左右）。プラスなら右。'),
    ex('a3e1', '3秒あいさつしよう', 'ネコ', prog('say_for("こんにちは", 2)'),
       ['ネコが「よろしくね」と3秒言うようにする'],
       ['1つめの値が言うこと、2つめが秒数。', '" " と , は消さない。', 'say_for("よろしくね", 3) にする。'],
       [code('「よろしくね」と3秒言う', line='say_for("よろしくね", 3)', indent=1, fail='say_for("よろしくね", 3) にしよう。'),
        run('「よろしくね」と言う', 1200, [said('ネコ', 'よろしくね')], '「よろしくね」と言わなかったよ。')],
       prog('say_for("よろしくね", 3)')),
    ex('a3e2', 'ネコを右上に連れていこう', 'ネコ', prog('go_to(0, -140)'),
       ['ネコを x座標 100、y座標 100 の場所に行かせる'],
       ['1つめが x座標、2つめが y座標。', 'どちらも 100 にする。', 'go_to(100, 100) にする。'],
       [code('右上に行く', line='go_to(100, 100)', indent=1, fail='go_to(100, 100) にしよう。'),
        run('右上に行く', 1000, [final('ネコ', 'x', '>', 95), final('ネコ', 'y', '>', 95)], 'ネコが右上（100, 100）に行っていないよ。')],
       prog('go_to(100, 100)')),
]}

a4 = {'id': 'a4', 'title': '第4回　はじまりの2行と字下げ', 'slides': [
    slide('「旗が押されたら」の2行',
          '@when_flag_clicked と def script1(): の2行で、「緑の旗が押されたら、下のまとまりを動かす」という意味になる。\ndef の行の最後には : （コロン）をつける。',
          prog('move(10)')),
    slide('字下げ＝まとまりの中',
          'まとまりの中の行は、頭にスペースを4つ入れて右に下げる（字下げ）。Tabキーでも4つ下げられる。\n字下げしていない行は、まとまりに入らない（エラーになる）。',
          prog('go_to(0, -140)', 'move(100)', 'say_for("ついた！", 2)')),
], 'exercises': [
    quiz('a4q1', '字下げした行は？', '頭にスペースを4つ入れて字下げした行は、どうなる？',
         [T('旗が押されたら動くまとまりに入る'), T('動かない（メモになる）', 'メモになるのは # で始まる行。'), T('2回動く', '字下げは回数には関係ないよ。')],
         0, '字下げで、どのまとまりの中かが決まる。'),
    quiz('a4q2', 'どれが正しい？', '「旗が押されたら100歩動く」正しいコードはどれ？',
         [C('@when_flag_clicked\ndef script1()\n    move(100)', 'def の行の最後に : がないよ。'), C('@when_flag_clicked\ndef script1():\nmove(100)', 'move(100) が字下げされていないよ。'), C('@when_flag_clicked\ndef script1():\n    move(100)')],
         2, ': と、スペース4つの字下げの両方が必要。'),
    ex('a4e1', '字下げを直そう', 'ネコ', '@when_flag_clicked\ndef script1():\ngo_to(0, -140)\nmove(100)',
       ['エラーを直して、旗が押されたら100歩動くようにする'],
       ['まとまりの中の行は、字下げが必要。', 'go_to と move の行の頭に、スペースを4つ入れる。', '行を選んで Tab キーを押してもよい。'],
       [code('move が字下げされている', line='move(100)', indent=1, fail='move(100) の頭にスペースを4つ入れよう。'),
        run('100歩動く', 1200, [final('ネコ', 'x', '>=', 95)], 'ネコが100歩動いていないよ。')],
       prog('go_to(0, -140)', 'move(100)'), brokenStarter=True),
    ex('a4e2', '自分で書いてみよう', 'ネコ', prog('go_to(0, -140)', '# この下に、100歩動いて「ついた！」と2秒言う2行を書こう'),
       ['旗が押されたら、100歩動いて「ついた！」と2秒言う'],
       ['動くのは move、言うのは say_for。', 'どちらも字下げ（スペース4つ）する。', 'move(100) と say_for("ついた！", 2) の2行。'],
       [code('100歩動く', line='move(100)', indent=1, fail='move(100) を字下げして書こう。'),
        code('「ついた！」と2秒言う', line='say_for("ついた！", 2)', indent=1, fail='say_for("ついた！", 2) を字下げして書こう。'),
        run('動いて「ついた！」と言う', 1500, [final('ネコ', 'x', '>=', 95), said('ネコ', 'ついた')], '100歩動いて「ついた！」と言うようにしよう。')],
       prog('go_to(0, -140)', 'move(100)', 'say_for("ついた！", 2)')),
]}

a5 = {'id': 'a5', 'title': '第5回　上から順番に動く', 'slides': [
    slide('上から1行ずつ動く',
          'まとまりの中の行は、上から順番に1行ずつ動く。1つの行が終わってから、次の行に進む。',
          prog('go_to(0, -140)', 'say_for("いくよ", 1)', 'move(100)', 'say_for("ついた！", 1)')),
    slide('順番を変えると、動きが変わる',
          '同じ命令でも、順番がちがうとちがう動きになる。下のコードは、「いくよ」と言う前に動いてしまう。',
          prog('go_to(0, -140)', 'move(100)', 'say_for("いくよ", 1)')),
], 'exercises': [
    quiz('a5q1', '最初にすることは？', 'このコードを動かすと、ネコが最初にすることは？',
         [T('100歩動く', '上の行から順番に動くよ。'), T('「おはよう」と1秒言う'), T('1秒待つ', 'wait はいちばん下の行だよ。')],
         1, '上の行から順番に動く。', code_=prog('say_for("おはよう", 1)', 'move(100)', 'wait(1)')),
    ex('a5e1', '順番を直そう', 'ネコ', prog('go_to(0, -140)', 'move(100)', 'say_for("いくよ", 1)'),
       ['「いくよ」と1秒言ってから、100歩動く'],
       ['いまは、動いてから「いくよ」と言っている。', '2つの行の順番を入れかえる。', 'say_for("いくよ", 1) を move(100) の上の行にする。'],
       [code('言ってから動く順番', order=['say_for("いくよ", 1)', 'move(100)'], fail='say_for の行を move の行より上にしよう。'),
        run('言っているあいだは動かない', 2200, [still('ネコ', 'x', 200, 800), final('ネコ', 'x', '>=', 95)], '「いくよ」と言っているあいだに動いているよ。')],
       prog('go_to(0, -140)', 'say_for("いくよ", 1)', 'move(100)')),
    ex('a5e2', '行って、もどってこよう', 'ネコ', prog('go_to(0, -140)', 'move(100)', '# ここに、1秒待ってから -100歩動く行を書こう'),
       ['100歩動いて、1秒待ってから、-100歩動いてもとの場所にもどる'],
       ['-100歩動くと、反対向きに100歩もどる。', 'move(100) の下に wait(1)。', 'その下に move(-100)。'],
       [code('-100歩もどっている', line='move(-100)', indent=1, fail='move(-100) を書こう。'),
        run('行ってもどる', 2200, [varies('ネコ', 'x', 90), still('ネコ', 'x', 200, 800), final('ネコ', 'x', '<', 5), final('ネコ', 'x', '>', -5)], '100歩動いて、1秒止まって、もとの場所にもどるようにしよう。')],
       prog('go_to(0, -140)', 'move(100)', 'wait(1)', 'move(-100)')),
]}

a6 = {'id': 'a6', 'title': '第6回　ずっとくり返す while True:', 'slides': [
    slide('「ずっと」は while True:',
          'while True: は「ずっとくり返す」。最後の : をわすれずに。\nwhile True: の下で、もう1段（スペース4つ）字下げした行が、くり返す行になる。',
          prog('point_in_direction(90)', 'while True:', '    turn_right(15)', '    wait(0.1)')),
    slide('字下げの深さで、中か外かが決まる',
          'while True: の中の行は、スペース8つ（2段）の字下げになる。1段にもどした行は、くり返しの外。\nずっとくり返すので、外の行にはたどりつかない。',
          prog('while True:', '    turn_right(15)', '    wait(0.1)')),
], 'exercises': [
    quiz('a6q1', 'くり返すのはどの行？', 'このコードで、ずっとくり返されるのはどれ？',
         [T('point_in_direction(90) だけ', 'while True: より前の行は1回だけ動くよ。'), T('turn_right(15) と wait(0.1)'), T('全部の行', 'くり返すのは、while True: の下で字下げした行だけ。')],
         1, 'while True: の下で、もう1段字下げした行がくり返される。', code_=prog('point_in_direction(90)', 'while True:', '    turn_right(15)', '    wait(0.1)')),
    ex('a6e1', 'ずっと回そう', 'ネコ', prog('point_in_direction(90)', 'turn_right(15)', 'wait(0.1)'),
       ['turn_right と wait を「ずっと」の中に入れて、ずっと回るようにする'],
       ['「ずっと」は while True:。', 'point_in_direction の次の行に while True: を書く。', 'turn_right と wait の行の頭に、スペースを4つ足して1段下げる。'],
       [code('「ずっと」を使っている', line='while True:', indent=1, fail='while True: を書こう。'),
        code('回る命令がくり返しの中にある', line='turn_right(15)', indent=2, fail='turn_right(15) を1段下げて、くり返しの中に入れよう。'),
        run('ずっと回り続ける', 2500, [varies('ネコ', 'dir', 30, 1000)], 'ネコがずっと回っていないよ。')],
       prog('point_in_direction(90)', 'while True:', '    turn_right(15)', '    wait(0.1)')),
]}

a7 = {'id': 'a7', 'title': '第7回　〇回くり返す for', 'slides': [
    slide('「3回繰り返す」は for',
          'for i in range(3): は「3回くり返す」。range(3) の 3 が回数。最後の : をわすれずに。\ni は「いま何回目か」が入る変数（いまは気にしなくてよい）。',
          prog('go_to(-150, -140)', 'for i in range(3):', '    move(50)', '    wait(0.5)')),
    slide('同じ行が続いたら、くり返しにできる',
          '同じ命令を何回も書くかわりに、for で「〇回くり返す」と書くと、短くまちがいにくくなる。',
          prog('for i in range(4):', '    move(50)', '    turn_right(90)')),
], 'exercises': [
    quiz('a7q1', '何回動く？', 'このコードで、ネコは何回 50歩動く？',
         [T('1回', 'move(50) はくり返しの中にあるよ。'), T('4回'), T('50回', '50 は歩数。回数は range の ( ) の中。')],
         1, 'range(4) の 4 が回数。', code_=prog('for i in range(4):', '    move(50)', '    wait(0.5)')),
    ex('a7e1', '3回くり返しで短くしよう', 'ネコ', prog('go_to(-150, -140)', 'move(50)', 'wait(0.5)', 'move(50)', 'wait(0.5)', 'move(50)', 'wait(0.5)'),
       ['for を使って、move(50) と wait(0.5) を1回ずつだけ書く', '動きは同じ（50歩ずつ3回）'],
       ['同じ2行が3回ある。', 'for i in range(3): の中に move(50) と wait(0.5) を入れる。', '残りの4行は消す。'],
       [code('3回のくり返しを使っている', line='for i in range(0, 3):', indent=1, fail='for i in range(3): を書こう。'),
        code('move(50) は1回だけ', line='move(50)', count=1, indent=2, fail='move(50) は、くり返しの中に1回だけ書こう。'),
        run('50歩ずつ3回動く', 2500, [final('ネコ', 'x', '>', -5), final('ネコ', 'x', '<', 5)], '150歩動いていないよ。')],
       prog('go_to(-150, -140)', 'for i in range(3):', '    move(50)', '    wait(0.5)')),
    ex('a7e2', '四角に動こう', 'ネコ', prog('go_to(0, 0)', 'point_in_direction(90)', 'for i in range(4):', '    move(50)', 'turn_right(90)', 'wait(0.5)'),
       ['「50歩動く→右に90度回る→0.5秒待つ」を4回くり返して、四角に動く', 'もとの場所・もとの向きにもどってくる'],
       ['いまは move(50) だけがくり返しの中。', 'turn_right と wait も1段下げる。', 'turn_right(90) と wait(0.5) の行の頭にスペースを4つ足す。'],
       [code('回る命令がくり返しの中にある', line='turn_right(90)', indent=2, fail='turn_right(90) を1段下げよう。'),
        run('四角に動いて、もどってくる', 3000, [varies('ネコ', 'y', 40), final('ネコ', 'x', '<', 5), final('ネコ', 'x', '>', -5), final('ネコ', 'dir', '>', 85), final('ネコ', 'dir', '<', 95)], 'もとの場所・もとの向きにもどってこないよ。')],
       prog('go_to(0, 0)', 'point_in_direction(90)', 'for i in range(4):', '    move(50)', '    turn_right(90)', '    wait(0.5)')),
]}

SPACE_LOOP = prog('go_to(0, -140)', 'while True:', '    if key_pressed("スペース"):', '        say_for("ニャー", 1)')
a8 = {'id': 'a8', 'title': '第8回　もし〜なら if', 'slides': [
    slide('「もし〜なら」は if',
          'if 条件: は「もし 条件 なら」。条件が正しいときだけ、下で字下げした行が動く。最後の : をわすれずに。',
          prog('if key_pressed("スペース"):', '    say_for("ニャー", 1)')),
    slide('キーが押されたか key_pressed',
          'key_pressed("スペース") は「スペースキーが押された」という条件。キーの名前は " " でかこむ。\nキーはいつ押されるかわからないので、while True: の中に if を入れて、ずっと調べる。',
          SPACE_LOOP),
], 'exercises': [
    quiz('a8q1', 'いつ「ニャー」と言う？', 'このコードで、ネコが「ニャー」と言うのはいつ？',
         [T('旗を押したらすぐ', 'if の中なので、条件が正しいときだけだよ。'), T('スペースキーを押したとき'), T('ずっと言い続ける', 'ずっと調べているけれど、言うのはスペースキーが押されたときだけ。')],
         1, 'if の条件が正しいとき（スペースキーが押されたとき）だけ動く。', code_=SPACE_LOOP),
    ex('a8e1', 'スペースで鳴こう', 'ネコ', prog('go_to(0, -140)', 'while True:', '    wait(0.05)', '    # この下に、スペースキーが押されたら「ニャー」と1秒言う if を書こう'),
       ['スペースキーを押すと、「ニャー」と1秒言う'],
       ['if key_pressed("スペース"): を、while True: の中（2段の字下げ）に書く。', 'その下に say_for("ニャー", 1) を、さらに1段下げて書く。', '字下げは if が2段（スペース8つ）、say_for が3段（12）。'],
       [code('スペースキーで分けている', line='if key_pressed("スペース"):', indent=2, fail='if key_pressed("スペース"): を、while True: の中に書こう。'),
        run('スペースで「ニャー」', 1600, [said('ネコ', 'ニャー')], 'スペースキーを押しても「ニャー」と言わないよ。', keys=SPACE)],
       prog('go_to(0, -140)', 'while True:', '    wait(0.05)', '    if key_pressed("スペース"):', '        say_for("ニャー", 1)')),
]}

a9 = {'id': 'a9', 'title': '第9回　キーで動かす', 'slides': [
    slide('左右に動かす change_x',
          'change_x(10) は「x座標を10ずつ変える」（右へ10）。change_x(-10) は左へ10。\n"右向き矢印" "左向き矢印" "上向き矢印" "下向き矢印" がキーの名前。',
          CAT_RL),
    slide('上下に動かす change_y と「触れた」',
          'change_y(-5) は「y座標を-5ずつ変える」（下へ）。上へはプラス。\ntouching("ネコ") は「ネコに触れた」という条件。リンゴがネコに触れたら、上にもどす例。',
          prog('go_to(0, 170)', 'while True:', '    change_y(-5)', '    if touching("ネコ"):', '        go_to(0, 170)')),
], 'exercises': [
    quiz('a9q1', '左に動かすコードは？', '左に10ずつ動かすコードをえらぼう。',
         [C('change_x(10)', 'プラスは右へ動くよ。'), C('change_x(-10)'), C('change_y(-10)', 'change_y は上下。-10 だと下へ動くよ。')],
         1, 'x座標をマイナスに変えると左へ動く。'),
    ex('a9e1', '左にも動かそう', 'ネコ', CAT_RL,
       ['左向き矢印キーを押すと、ネコが左に動く'],
       ['右のときと同じ形の if を、もう1つ書く。', 'if key_pressed("左向き矢印"): を、右の if と同じ深さに。', 'その中に change_x(-10) を1段下げて書く。'],
       [code('左向き矢印キーで分けている', line='if key_pressed("左向き矢印"):', indent=2, fail='if key_pressed("左向き矢印"): を、右の if と同じ深さに書こう。'),
        run('左キーで左に動く', 1600, [{'kind': 'decrease', 'sprite': 'ネコ', 'prop': 'x', 'min': 30}], '左向き矢印キーを押しても、左に動かないよ。', keys=[{'key': '左向き矢印', 'at': 300, 'hold': 600}])],
       CAT_LR),
    ex('a9e2', 'キャッチしたら上にもどそう', 'リンゴ', prog('go_to(0, 170)', 'while True:', '    change_y(-5)'),
       ['ずっと下に落ちる。ネコに触れたら、上（x座標0、y座標170）にもどす'],
       ['「ネコに触れた」は touching("ネコ")。', 'change_y(-5) と同じ深さに if touching("ネコ"): を書く。', 'その中に go_to(0, 170)。'],
       [code('ネコに触れたかで分けている', line='if touching("ネコ"):', indent=2, fail='if touching("ネコ"): を、change_y と同じ深さに書こう。'),
        code('触れたら上にもどす', line='go_to(0, 170)', indent=3, fail='if の中に go_to(0, 170) を書こう。'),
        run('リンゴが落ちていく', 1500, [{'kind': 'decrease', 'sprite': 'リンゴ', 'prop': 'y', 'min': 40}], 'リンゴが落ちていないよ。')],
       prog('go_to(0, 170)', 'while True:', '    change_y(-5)', '    if touching("ネコ"):', '        go_to(0, 170)')),
]}

def score(*body):
    return prog('得点 = 0', 'while True:', '    if key_pressed("スペース"):', *['        ' + b for b in body], '        wait(0.3)')
SCORE = score()
SCORE1 = score('得点 = 得点 + 1')
a10 = {'id': 'a10', 'title': '第10回　変数を作る・変える', 'slides': [
    slide('変数は、名前のついた箱',
          '得点 = 0 は「得点を0にする」。= は「右の値を、左の変数（箱）に入れる」という意味で、「等しい」ではない。\n変数がまだなければ、自動で作られてステージに表示される。',
          prog('得点 = 0')),
    slide('1ずつ変える',
          '得点 = 得点 + 1 は「得点を1ずつ変える」。右の 得点 + 1 を先に計算して、その答えを左の 得点 に入れなおす。',
          prog('得点 = 0', 'while True:', '    if key_pressed("スペース"):', '        得点 = 得点 + 1', '        wait(0.3)')),
    slide('変数の値を言わせる',
          'say_for の言うことに、変数を書くこともできる。変数は " " でかこまない（かこむと「得点」という文字になる）。',
          prog('得点 = 0', '得点 = 得点 + 1', 'say_for(得点, 1)')),
], 'exercises': [
    quiz('a10q1', '得点はいくつ？', 'このコードを動かしたあと、得点はいくつ？',
         [T('0', '得点 = 0 のあとに、2回ふやしているよ。'), T('1', '得点 = 得点 + 1 は2行あるよ。'), T('2')],
         2, '0 → 1 → 2 と、1ずつふえる。', code_=prog('得点 = 0', '得点 = 得点 + 1', '得点 = 得点 + 1')),
    quiz('a10q2', '何と言う？', 'このコードを動かすと、ネコは何と言う？',
         [T('得点', '" " でかこむと、そのままの文字になるよ。'), T('5')],
         0, '" " でかこむと文字。変数の値を言わせるときは say_for(得点, 1) のように、かこまない。', code_=prog('得点 = 5', 'say_for("得点", 1)')),
    ex('a10e1', 'スペースで得点をふやそう', 'ネコ', SCORE,
       ['スペースキーを押すたびに、得点が1ふえる'],
       ['「得点を1ずつ変える」は 得点 = 得点 + 1。', 'if の中（wait と同じ深さ）に書く。', 'wait(0.3) の上の行に 得点 = 得点 + 1。'],
       [code('得点を1ずつ変えている', line='得点 = 得点 + 1', indent=3, fail='得点 = 得点 + 1 を、if の中に書こう。'),
        run('スペースを1回押すと1点', 1500, [var('得点', '==', 1)], 'スペースキーを1回押したのに、得点が1にならないよ。', keys=SPACE)],
       SCORE1),
    ex('a10e2', '得点を言おう', 'ネコ', SCORE1,
       ['得点がふえたら、ネコがいまの得点を1秒言う'],
       ['say_for に変数を書くと、その値を言う。', '得点 = 得点 + 1 の次の行に書く。', 'say_for(得点, 1)（得点は " " でかこまない）。'],
       [code('得点を言っている', line='say_for(得点, 1)', indent=3, fail='say_for(得点, 1) を、得点 = 得点 + 1 の次の行に書こう。'),
        run('スペースで「1」と言う', 1800, [said('ネコ', '1')], 'スペースキーを押したのに、得点を言わなかったよ。', keys=SPACE)],
       score('得点 = 得点 + 1', 'say_for(得点, 1)')),
]}

def apple(speed='change_y(-5)', cmp='<', miss=False, missIn=True, missOut=False):
    L = ['得点 = 0'] + (['ミス = 0'] if miss else []) + ['go_to(0, 170)', 'while True:', '    ' + speed, '    if y_position() ' + cmp + ' -170:']
    if miss and missIn: L.append('        ミス = ミス + 1')
    L += ['        go_to(random(-200, 200), 170)']
    if missOut: L.append('    ミス = ミス + 1')
    L += ['    if touching("ネコ"):', '        得点 = 得点 + 1', '        go_to(random(-200, 200), 170)']
    return prog(*L)
APPLE = apple()
a11 = {'id': 'a11', 'title': '第11回　乱数と大きさくらべ', 'slides': [
    slide('ランダムな数 random',
          'random(-200, 200) は「-200 から 200 までのどれかの数」（乱数）。毎回ちがう数になる。\ngo_to(random(-200, 200), 170) なら、上の方のどこかランダムな場所へ行く。',
          prog('go_to(random(-200, 200), 170)')),
    slide('大きさをくらべる < と >',
          'y_position() は「いまのy座標」。\ny_position() < -170 は「y座標が -170 より小さい」（下に行きすぎた）という条件。> は「より大きい」。口が開いている方が大きい。',
          prog('if y_position() < -170:', '    go_to(0, 170)', 'if y_position() > 170:', '    say_for("上に行きすぎ", 1)')),
], 'exercises': [
    quiz('a11q1', 'どんな条件？', 'if y_position() < -170: はどんなとき？',
         [T('y座標が -170 より小さい（下にいる）とき'), T('y座標が -170 より大きいとき', '< は「左が右より小さい」。'), T('-170 秒たったとき', 'y_position() はy座標（上下の場所）だよ。')],
         0, '< の口は右に開いている → 右（-170）の方が大きい → y座標が -170 より小さい。'),
    ex('a11e1', '落ちたら上にもどそう', 'リンゴ', prog('go_to(0, 170)', 'while True:', '    change_y(-5)', '    # ここに、y座標が -170 より小さくなったら、上のランダムな場所にもどす if を書こう'),
       ['リンゴが下（y座標 -170 より下）に行ったら、上のランダムな場所（y座標 170）にもどす'],
       ['if y_position() < -170: を、change_y と同じ深さに書く。', 'その中に go_to(random(-200, 200), 170)。', 'random の ( ) の中は , で区切って2つ。'],
       [code('下に行ったかで分けている', line='if y_position() < -170:', indent=2, fail='if y_position() < -170: を、change_y と同じ深さに書こう。'),
        run('下まで落ちて上にもどる', 5000, [{'kind': 'returnAfter', 'sprite': 'リンゴ', 'prop': 'y', 'below': -60, 'above': 120}], 'リンゴが下まで落ちて上にもどっていないよ。')],
       prog('go_to(0, 170)', 'while True:', '    change_y(-5)', '    if y_position() < -170:', '        go_to(random(-200, 200), 170)')),
]}

ma = {'id': 'ma', 'title': 'ステップ1　まとめテスト', 'slides': [
    slide('キャッチゲームを読もう',
          'ここまでの命令でできたリンゴのプログラム。1行ずつ、ブロックと見比べて読んでみよう。',
          APPLE),
], 'exercises': [
    quiz('maq1', 'ネコに触れたら？', 'このプログラムで、リンゴがネコに触れたら、どうなる？',
         [T('得点が1ふえて、上のランダムな場所にもどる'), T('リンゴが止まる', 'ずっとくり返しているので止まらないよ。'), T('得点が0にもどる', '得点 = 得点 + 1 は「1ふやす」。')],
         0, 'if touching("ネコ"): の中の2行が動く。', code_=APPLE),
    ex('mae1', 'リンゴを速くしよう', 'リンゴ', APPLE,
       ['リンゴの落ちる速さを2倍にする', 'ほかの動きは変えない'],
       ['落ちる速さを決めているのは change_y の数。'],
       [code('1回に動く量を2倍にしている', line='change_y(-10)', indent=2, fail='change_y の数を見直そう。いまの2倍になっているかな？'),
        run('速く落ちて、上にもどる', 5000, [{'kind': 'returnAfter', 'sprite': 'リンゴ', 'prop': 'y', 'below': -60, 'above': 120}], 'リンゴが下まで落ちて上にもどっていないよ。')],
       apple('change_y(-10)')),
    ex('mae2', 'ミスを数えよう', 'リンゴ', APPLE,
       ['変数「ミス」を使う', '旗が押されたら、ミスを0にする', 'リンゴが下まで落ちるたびに、ミスを1ふやす'],
       ['得点と同じ書き方で、ミスの変数を作る。'],
       [code('ミスを0にしている', line='ミス = 0', indent=1, fail='得点 = 0 の近くに ミス = 0 を書こう。'),
        code('ミスを1ずつふやしている', line='ミス = ミス + 1', indent=3, fail='下に落ちたとき（y座標が -170 より下の if の中）に ミス = ミス + 1。'),
        run('落ちるとミスがふえる', 4500, [var('ミス', '>=', 1)], 'リンゴが下に落ちたのに、ミスがふえていないよ。')],
       apple(miss=True)),
]}
k1 = k2 = k3 = k4 = k5 = m1 = None

# ================================================================ ステップ2　直す
CLEAR = prog('得点 = 0', 'while True:', '    if key_pressed("スペース"):', '        得点 = 得点 + 1', '        wait(0.3)', '    if 得点 = 3:', '        say_for("クリア！", 2)')
FIVE = [{'key': 'space', 'at': 300 + 500 * i, 'hold': 150} for i in range(3)]
k6 = {'id': 'k6', 'title': '第6回　記号のまちがいを直す', 'slides': [
    slide('= と == はちがう',
          '= は「入れる」（得点 = 0 は得点を0にする）。== は「比べる」（得点 == 3 は「得点 = 3」の条件）。\nif のうしろで比べるときは、かならず == を使う。',
          prog('得点 = 0', 'while True:', '    if key_pressed("スペース"):', '        得点 = 得点 + 1', '        wait(0.3)', '    if 得点 == 3:', '        say_for("クリア！", 2)')),
    slide('< と > の向き',
          '< と > は、口が開いている方が大きい。y_position() < -170 は「y座標が -170 より小さい」。\n向きをまちがえると、正反対の意味になる。',
          prog('if y_position() < -170:', '    go_to(0, 170)')),
], 'exercises': [
    ex('k6e1', 'クリアと言わせよう', 'ネコ', CLEAR,
       ['得点が3になったら「クリア！」と言うようにする（エラーを直す）'],
       ['エラーが出ている行を見よう。', '比べるときの記号は？', 'if 得点 = 3: を if 得点 == 3: にする。'],
       [code('== で比べている', line='if 得点 == 3:', indent=2, fail='if 得点 == 3: にしよう（= ではなく ==）。'),
        run('3回押すと「クリア！」', 3500, [said('ネコ', 'クリア')], 'スペースを3回押したのに「クリア！」と言わないよ。', keys=FIVE)],
       CLEAR.replace('得点 = 3:', '得点 == 3:'), brokenStarter=True),
    ex('k6e2', '向きを直そう', 'リンゴ', apple(cmp='>'),
       ['リンゴが下まで落ちてから、上にもどるようにする'],
       ['いまは、リンゴがずっと上にいる。', '下に行きすぎたかを調べる if を見よう。', '> を < にする。'],
       [code('下に行きすぎたら、で分けている', line='if y_position() < -170:', indent=2, fail='if y_position() < -170: にしよう。'),
        run('下まで落ちて上にもどる', 5000, [{'kind': 'returnAfter', 'sprite': 'リンゴ', 'prop': 'y', 'below': -60, 'above': 120}], 'リンゴが下まで落ちていないよ。')],
       APPLE),
]}

k7 = {'id': 'k7', 'title': '第7回　字下げのまちがいを直す', 'slides': [
    slide('字下げで「中」か「外」かが決まる',
          '同じ命令でも、字下げの深さで、どのくり返しや if の中に入るかが変わる。Scratchで、ブロックを入れる場所をまちがえるのと同じ。',
          prog('for i in range(3):', '    move(50)', '    wait(0.5)', 'say_for("おわり", 1)')),
    slide('外にある命令は、1回だけ',
          'くり返しの外（字下げをもどした行）は、くり返しが終わってから1回だけ動く。\nwhile True: の外の行は、くり返しが終わらないので動かない。',
          prog('while True:', '    change_y(-5)', '    wait(0.1)')),
], 'exercises': [
    ex('k7e1', '落ちるようにしよう', 'リンゴ', prog('go_to(0, 170)', 'while True:', '    wait(0.05)', 'change_y(-5)'),
       ['リンゴがずっと下に落ちるようにする'],
       ['change_y(-5) は、くり返しの中にある？', 'while True: の外の行は動かない。', 'change_y(-5) を1段下げる。'],
       [code('落ちる命令がくり返しの中にある', line='change_y(-5)', indent=2, fail='change_y(-5) を1段下げて、くり返しの中に入れよう。'),
        run('リンゴが落ちていく', 1500, [{'kind': 'decrease', 'sprite': 'リンゴ', 'prop': 'y', 'min': 40}], 'リンゴが落ちていないよ。')],
       prog('go_to(0, 170)', 'while True:', '    wait(0.05)', '    change_y(-5)')),
    ex('k7e2', '左キーを直そう', 'ネコ', prog('go_to(0, -140)', 'while True:', '    if key_pressed("右向き矢印"):', '        change_x(10)', '        if key_pressed("左向き矢印"):', '            change_x(-10)'),
       ['左向き矢印キーだけを押したときも、左に動くようにする'],
       ['左の if が、右の if の中に入ってしまっている。', '左の if を、右の if と同じ深さにする。', '左の if を1段、change_x(-10) も1段もどす。'],
       [code('左の if が右の if の外にある', line='if key_pressed("左向き矢印"):', indent=2, fail='左の if を、右の if と同じ深さ（2段）にしよう。'),
        run('左キーで左に動く', 1600, [{'kind': 'decrease', 'sprite': 'ネコ', 'prop': 'x', 'min': 30}], '左向き矢印キーだけを押しても、左に動かないよ。', keys=[{'key': '左向き矢印', 'at': 300, 'hold': 600}])],
       CAT_LR),
    ex('k7e3', '「おわり」は最後に1回', 'ネコ', prog('go_to(-150, -140)', 'for i in range(3):', '    move(50)', '    say_for("おわり", 1)'),
       ['50歩ずつ3回動いたあと、最後に1回だけ「おわり」と言う'],
       ['いまは、動くたびに「おわり」と言っている。', 'say_for はくり返しの外に出す。', 'say_for("おわり", 1) の字下げを1段もどす。'],
       [code('「おわり」がくり返しの外にある', line='say_for("おわり", 1)', indent=1, fail='say_for("おわり", 1) を、for と同じ深さにしよう。'),
        run('動いてから1回だけ言う', 2500, [still('ネコ', 'x', 200, 2400), said('ネコ', 'おわり')], '3回動き終わってから、1回だけ「おわり」と言うようにしよう。')],
       prog('go_to(-150, -140)', 'for i in range(3):', '    move(50)', 'say_for("おわり", 1)')),
]}

k8 = {'id': 'k8', 'title': '第8回　エラーを読んで直す', 'slides': [
    slide('エラーは「ここがおかしい」のお知らせ',
          'コードに書きまちがいがあると、動かす前にエラーが出る。何行目がおかしいかと、理由が書いてある。\n赤くなった行と、その上の行を見てみよう。',
          prog('say_for("こんにちは！", 2)')),
    slide('よくあるまちがい',
          '( ) や " " の閉じわすれ／ while や if の最後の : のわすれ／命令のつづりまちがい（move(10) を mvoe(10) と書くなど）／全角の記号や数字。\n正しい形と見くらべて直そう。',
          prog('while True:', '    move(10)', '    say_for("やあ", 1)')),
], 'exercises': [
    ex('k8e1', 'エラーを直そう（1）', 'ネコ', prog('go_to(0, -140)', 'say_for("こんにちは！", 2'),
       ['エラーを直して、「こんにちは！」と2秒言うようにする'],
       ['エラーの行を見よう。', 'かっこは ( と ) で1組。', '最後に ) を足す。'],
       [run('「こんにちは！」と言う', 1200, [said('ネコ', 'こんにちは')], '「こんにちは！」と言わなかったよ。')],
       prog('go_to(0, -140)', 'say_for("こんにちは！", 2)'), brokenStarter=True),
    ex('k8e2', 'エラーを直そう（2）', 'ネコ', prog('point_in_direction(90)', 'while True', '    turn_right(15)', '    wait(0.1)'),
       ['エラーを直して、ずっと回るようにする'],
       ['while の行を見よう。', 'while や if の行の最後には、ある記号が必要。', 'while True: にする。'],
       [run('ずっと回る', 2500, [varies('ネコ', 'dir', 30, 1000)], 'ずっと回っていないよ。')],
       prog('point_in_direction(90)', 'while True:', '    turn_right(15)', '    wait(0.1)'), brokenStarter=True),
    ex('k8e3', 'エラーを直そう（3）', 'ネコ', prog('go_to(0, -140)', 'mvoe(100)'),
       ['エラーを直して、ネコが100歩動くようにする'],
       ['エラーの文を読もう。', '命令の名前のつづりを見よう。', 'mvoe を move にする。'],
       [run('100歩動く', 1200, [final('ネコ', 'x', '>=', 95)], 'ネコが100歩動いていないよ。')],
       prog('go_to(0, -140)', 'move(100)'), brokenStarter=True),
]}

BUG3 = apple('change_y(5)', '>', miss=True, missIn=False, missOut=True)
_unused = APPLE.replace('    得点 = 0', '    得点 = 0\n    ミス = 0').replace('change_y(-5)', 'change_y(5)').replace('y_position() < -170', 'y_position() > -170').replace('    if y_position() > -170:\n        go_to(random(-200, 200), 170)', '    if y_position() > -170:\n        go_to(random(-200, 200), 170)\n    ミス = ミス + 1')
m2 = {'id': 'm2', 'title': 'ステップ2　まとめテスト', 'slides': [
    slide('ステップ2のまとめ',
          '記号（= と ==、< と >）、字下げ、エラーの読み方。まちがいを見つけるコツは、ブロックと見比べて「どこに入っているか」を確かめること。',
          prog('if y_position() < -170:', '    ミス = ミス + 1', '    go_to(random(-200, 200), 170)')),
], 'exercises': [
    ex('m2e1', 'バグを3つ直そう', 'リンゴ', BUG3,
       ['リンゴが下に落ちて、下に着いたら上にもどる', '下に着いたときだけ、ミスが1ふえる', 'バグ（まちがい）は3つある'],
       ['落ちる向き、比べる向き、字下げを見よう。'],
       [run('下まで落ちて上にもどる', 5000, [{'kind': 'returnAfter', 'sprite': 'リンゴ', 'prop': 'y', 'below': -60, 'above': 120}], 'リンゴが下まで落ちて、上にもどっていないよ。'),
        run('ミスは下に着いたときだけふえる', 4500, [var('ミス', '>=', 1), var('ミス', '<=', 8)], 'ミスのふえ方がおかしいよ。ミス = ミス + 1 の字下げを見よう。')],
       apple(miss=True)),
    ex('m2e2', 'エラーと字下げを直そう', 'ネコ', prog('go_to(0, -140)', 'while True:', '    if key_pressed("右向き矢印"):', '        change_x(10', '    if key_pressed("左向き矢印")', '    change_x(-10)'),
       ['エラーを直して、右向き・左向き矢印キーで左右に動くようにする', 'まちがいは3つある'],
       ['エラーの文を読んで、1つずつ直そう。'],
       [run('左キーで左に動く', 1600, [{'kind': 'decrease', 'sprite': 'ネコ', 'prop': 'x', 'min': 30}], '左向き矢印キーで左に動かないよ。', keys=[{'key': '左向き矢印', 'at': 300, 'hold': 600}]),
        run('右キーで右に動く', 1600, [{'kind': 'increase', 'sprite': 'ネコ', 'prop': 'x', 'min': 30}], '右向き矢印キーで右に動かないよ。', keys=[{'key': '右向き矢印', 'at': 300, 'hold': 600}])],
       CAT_LR, brokenStarter=True),
]}

# ================================================================ ステップ3　書く（旧ステップ3を、番号と説明を足して使う）
src = open(os.path.join(R, 'tools', 'step3.py'), encoding='utf-8').read()
src = src[:src.index('step3 = {')]
ns = {'__file__': os.path.join(R, 'tools', 'step3.py')}
exec(src, ns)
OLD = {'l6': ('k9', '第9回　input() で質問する'), 'l7': ('k10', '第10回　条件つきのくり返しと乱数'), 'l8': ('k11', '第11回　まとまりとメッセージ'),
       'l9': ('k12', '第12回　リストを使う'), 'l10': ('k13', '第13回　Scratchの外のPythonへ'), 'r3': ('m3', 'ステップ3　まとめテスト')}
step3 = []
for key in ['l6', 'l7', 'l8', 'l9', 'l10', 'r3']:
    l = json.loads(json.dumps(ns[key], ensure_ascii=False))
    nid, ttl = OLD[key]
    l['id'] = nid
    l['title'] = ttl
    for e in l['exercises']:
        e['id'] = e['id'].replace(key, nid, 1)
    step3.append(l)
k9, k10, k11, k12, k13, m3 = step3
# 説明を足す：print、say_for の言うことに計算、!=、キーのはじまり、i の使い方、本物のPythonのコード
k9['slides'].insert(3, slide('ずっと言う print',
    'print("こんにちは") は「こんにちは と言う」（秒数なし。ふきだしが出たままになる）。\n本物のPythonでは、print は画面に文字を出す命令。',
    prog('名前 = input("名前は？")', 'print("こんにちは、" + 名前)')))
for s in k10['slides']:
    if s['title'] == 'random で毎回ちがう結果':
        s['text'] = 'random(1, 6) は、1から6までのどれかの数になる（サイコロ）。変数に入れておくと、同じ数を何回も使える。\nstr(目) は、数を文字にする（文字とつなぐときに使う）。'
k10['slides'].append(slide('キーが押されたとき',
    '@when_key_pressed("スペース") と def script2(): の2行で、「スペースキーが押されたとき」のまとまりになる。\n新しいまとまりは、いまのまとまりのあとに1行あけて、字下げしないで書く。',
    '@when_key_pressed("スペース")\ndef script2():\n    say_for("ジャンプ！", 1)'))
k13['slides'][0]['code'] = prog('名前 = input("名前は？")', 'print("こんにちは、" + 名前 + "！")')
for s in k13['slides']:
    if 'import' in s.get('code', ''):
        s['plain'] = True
k13['slides'].insert(3, slide('くり返しの回数を使う i',
    'for i in range(1, 11): は、i が 1, 2, 3, … 10 と変わりながら10回くり返す（11 は入らない）。\n!= は「ちがう」。while 予想 != 正解: は「予想が正解とちがうあいだ」。',
    prog('合計 = 0', 'for i in range(1, 11):', '    合計 = 合計 + i', 'say_for(合計, 2)', '予想 = 3', 'while 予想 != 7:', '    予想 = 予想 + 1')))
for s_ in k12['slides']:
    if s_['title'].startswith('append'):
        s_['text'] += '\nx_position() は「いまのx座標」（y_position() のx版）。'
        s_['code'] += '\n記録.append(x_position())'
for s_ in k9['slides']:
    if s_['title'] == '文字をつなぐ ＋':
        s_['code'] = prog('say_for("こんにちは、" + "たろう" + "！", 2)', 'say_for(3 + 4, 2)')
        s_['text'] += '\n上の行は「こんにちは、たろう！」、下の行は「7」と言う。'
for s_ in k11['slides']:
    if s_['title'] == 'まとまりを書く場所':
        s_['code'] = '@when_flag_clicked\ndef script1():\n    go_to(0, -140)\n\n@when_broadcast_received("スタート")\ndef script2():\n    say_for("スタート！", 1)'
m3['slides'][0]['code'] = prog('ミス = 0', 'while ミス < 3:', '    change_y(-6)')

# ステップ3の模範解答（旧テストから）
CAT = prog('go_to(0, -140)', 'while True:', '    if key_pressed("右向き矢印"):', '        change_x(10)', '    if key_pressed("左向き矢印"):', '        change_x(-10)')
E = {e['id']: e for l in step3 for e in l['exercises']}
st = lambda i, sp: E[i]['starter'][sp]
answers.update({
    'k9e1': CAT_STAY + '\n    名前 = input("名前は？")\n    say_for("こんにちは、" + 名前 + "！", 2)',
    'k9e2': st('k9e2', 'ネコ') + '\n    if 答え == "12":\n        say_for("正解！", 2)\n    else:\n        say_for("ざんねん", 2)',
    'k9e3': CAT_STAY + '\n    a = int(input("1つめの数は？"))\n    b = int(input("2つめの数は？"))\n    say_for(a + b, 2)',
    'k10e1': st('k10e1', 'リンゴ') + '\n    while y_position() > -170:\n        change_y(-5)\n    print("落ちた！")',
    'k10e2': st('k10e2', 'リンゴ').replace('change_y(-5)', 'change_y(-速さ)').replace('go_to(random(-200, 200), 170)', 'go_to(random(-200, 200), 170)\n            速さ = 速さ + 1'),
    'k10e3': CAT + '\n\n@when_key_pressed("スペース")\ndef script2():\n    目 = random(1, 6)\n    say_for(str(目) + "が出た！", 1)',
    'k11e1': CAT + '\n\n@when_broadcast_received("ミス")\ndef script2():\n    say_for("あっ！", 1)',
    'k11e2': st('k11e2', 'リンゴ').replace('        if y_position() < -170:\n', '        if y_position() < -170:\n            broadcast("ミス")\n'),
    'k11e3': st('k11e3', 'リンゴ').replace('@when_flag_clicked', '@when_broadcast_received("スタート")'),
    'k12e1': CAT + '\n\n@when_key_pressed("スペース")\ndef script2():\n    ことば = ["やったね", "すごい", "その調子"]\n    say_for(ことば[random(0, 2)], 1)',
    'k12e2': st('k12e2', 'リンゴ').replace('            go_to(random', '            記録.append(x_position())\n            go_to(random'),
    'k13e1': st('k13e1', 'ネコ').replace('    print("あたり！")', '    while 予想 != 正解:\n        if 予想 < 正解:\n            say_for("もっと大きい", 1)\n        else:\n            say_for("もっと小さい", 1)\n        予想 = int(input("1から10の数は？"))\n    print("あたり！")'),
    'k13e2': st('k13e2', 'ネコ') + '\n    for i in range(1, 11):\n        合計 = 合計 + i\n    say_for(合計, 2)',
    'm3e1': st('m3e1', 'リンゴ') + '\n    ミス = 0\n    while ミス < 3:\n        change_y(-6)\n        if y_position() < -170:\n            ミス = ミス + 1\n            go_to(random(-200, 200), 170)\n    print("ゲームオーバー")',
    'm3e2': st('m3e2', 'ネコ').replace('    say_for("点数は"', '    for i in range(3):\n        答え = input(問題[i])\n        if 答え == 正解[i]:\n            点数 = 点数 + 1\n    say_for("点数は"'),
})

# ---------------------------------------------------------------- ステップ2・3：えらぶ問題を足して、番号をつけなおす
QUIZ = {
    'k6': [quiz('q', '== はどんな意味？', 'if 得点 == 3: の == は、どんな意味？',
                [T('くらべる（得点が3と同じか）'), T('入れる（得点を3にする）', '入れるのは = （1つ）。'), T('たす（得点に3をたす）', 'たすのは +。')], 0, '== は「同じか」をくらべる。= は「入れる」。')],
    'k7': [quiz('q', '何回言う？', 'このコードで、ネコは「おわり」と何回言う？',
                [T('1回'), T('3回', 'say_for はくり返しの外（字下げが for と同じ）にあるよ。')], 0, '字下げをもどした行は、くり返しが終わってから1回だけ動く。',
                code_=prog('for i in range(3):', '    move(50)', 'say_for("おわり", 1)'))],
    'k8': [quiz('q', 'エラーになるのは？', 'エラーになるコードはどれ？',
                [C('say_for("やあ", 1'), C('move(10)', 'これは正しいコード。'), C('wait(1)', 'これは正しいコード。')], 0, '( と ) は1組。閉じかっこがないとエラーになる。')],
    'k9': [quiz('q', '答えはどこに入る？', '名前 = input("名前は？") で、質問への答えはどうなる？',
                [T('変数「名前」に入る'), T('すぐに消える', '= の左の変数に入るよ。'), T('「名前は？」になる', '「名前は？」は質問の文。')], 0, 'input() は質問して待ち、答えを = の左の変数に入れる。', code_=prog('名前 = input("名前は？")'))],
    'k10': [quiz('q', 'いつまでくり返す？', 'このくり返しは、いつまで続く？',
                 [T('y座標が -170 より上にいるあいだ'), T('ずっと', 'while True: ではなく、条件がついているよ。'), T('170回', '回数をくり返すのは for。')], 0, 'while 条件: は、条件が正しいあいだくり返す。',
                 code_=prog('while y_position() > -170:', '    change_y(-5)'))],
    'k11': [quiz('q', 'どのブロック？', 'broadcast("ミス") と同じ意味のブロックをえらぼう。',
                 [B('broadcast("ミス")'), B('say_for("ミス", 1)', 'それは「ミスと1秒言う」。'), B('print("ミス")', 'それは「ミスと言う」。')], 0, 'broadcast は「メッセージを送る」。')],
    'k12': [quiz('q', 'ことば[0] は？', 'ことば[0] は、どのことば？',
                 [T('やったね'), T('すごい', 'Python は 0 から数えるよ。[0] がいちばん前。'), T('その調子', '[2] がその調子。')], 0, 'Python のリストは 0 から数える。[0] が1番目。',
                 code_=prog('ことば = ["やったね", "すごい", "その調子"]', 'say_for(ことば[0], 1)'))],
    'k13': [quiz('q', '画面に文字を出すのは？', '本物のPythonで、画面に文字を出す命令はどれ？',
                  [T('print'), T('say_for', 'say_for はこのツール（Scratch）の命令。本物のPythonにはスプライトがないよ。'), T('move', 'move はスプライトを動かす命令。')], 0, '本物のPythonでは print("こんにちは") のように書く。')],
}
RENAME = {'k6': ('b1', '第12回　記号のまちがいを直す'), 'k7': ('b2', '第13回　字下げのまちがいを直す'), 'k8': ('b3', '第14回　エラーを読んで直す'), 'm2': ('mb', 'ステップ2　まとめテスト'),
          'k9': ('c1', '第15回　input() で質問する'), 'k10': ('c2', '第16回　条件つきのくり返し'), 'k11': ('c3', '第17回　まとまりとメッセージ'),
          'k12': ('c4', '第18回　リストを使う'), 'k13': ('c5', '第19回　Scratchの外のPythonへ'), 'm3': ('mc', 'ステップ3　まとめテスト')}
for L in [k6, k7, k8, m2] + step3:
    oid = L['id']
    nid, ttl = RENAME[oid]
    for e in L['exercises']:
        new_id = nid + 'e' + e['id'].split('e')[-1]
        if e['id'] in answers: answers[new_id] = answers.pop(e['id'])
        e['id'] = new_id
    for k, q in enumerate(QUIZ.get(oid, [])):
        q['id'] = nid + 'q' + str(k + 1)
    L['exercises'] = QUIZ.get(oid, []) + L['exercises']
    L['id'] = nid
    L['title'] = ttl

# ---------------------------------------------------------------- 「この課題で使うコード」（左の欄）
USES = [
    ('@when_flag_clicked', '@when_flag_clicked\ndef script1():', '旗が押されたら、下の字下げした行が動く'),
    ('@when_key_pressed', '@when_key_pressed("スペース")\ndef script2():', 'キーが押されたら、下の行が動く'),
    ('@when_broadcast_received', '@when_broadcast_received("ミス")\ndef script2():', 'メッセージを受け取ったら、下の行が動く'),
    ('move', 'move(10)', '( ) の中の歩数だけ動く'),
    ('point_in_direction', 'point_in_direction(90)', '90 は右、-90 は左、0 は上、180 は下'),
    ('turn_right', 'turn_right(15)', '右に〇度回す'),
    ('turn_left', 'turn_left(15)', '左に〇度回す'),
    ('go_to', 'go_to(0, -140)', 'x座標（左右）・y座標（上下）の場所へ行く'),
    ('change_x', 'change_x(10)', 'x座標を変える（右へ＋、左へ−）'),
    ('change_y', 'change_y(-5)', 'y座標を変える（上へ＋、下へ−）'),
    ('print', 'print("こんにちは")', '〇と言う（ずっと出る）'),
    ('say_for', 'say_for("こんにちは", 2)', '〇と〇秒言う。文字は " " でかこむ'),
    ('wait', 'wait(1)', '〇秒待つ'),
    ('while True', 'while True:\n    turn_right(15)', 'ずっとくり返す。中は1段字下げ'),
    ('while', 'while y_position() > -170:\n    change_y(-5)', '条件が正しいあいだくり返す'),
    ('for', 'for i in range(3):\n    move(50)', '〇回くり返す'),
    ('key_pressed', 'if key_pressed("スペース"):\n    say_for("ニャー", 1)', 'もし〇キーが押されたなら'),
    ('touching', 'if touching("ネコ"):\n    go_to(0, 170)', 'もし〇に触れたなら'),
    ('if', 'if 得点 == 3:\n    say_for("クリア！", 2)', 'もし〜なら。比べるのは =='),
    ('else', 'else:\n    say_for("ざんねん", 2)', 'でなければ（if と同じ深さ）'),
    ('y_position', 'if y_position() < -170:\n    go_to(0, 170)', 'y座標が -170 より小さいなら'),
    ('random', 'go_to(random(-200, 200), 170)', '-200 から 200 までの乱数'),
    ('input', '名前 = input("名前は？")', '質問して、答えを変数に入れる'),
    ('int', 'a = int(input("数は？"))', '答えを数にする'),
    ('str', 'say_for(str(目) + "が出た！", 1)', '数を文字にして、文字とつなぐ'),
    ('broadcast', 'broadcast("ミス")', 'メッセージを送る'),
    ('[', 'ことば = ["やったね", "すごい"]', 'リストを作る'),
    ('.append', '記録.append(x_position())', 'リストに追加する'),
    ('x_position', 'x = x_position()', 'いまのx座標'),
    ('+=var', '得点 = 得点 + 1', '変数を1ずつ変える'),
    ('=var', '得点 = 0', '変数に入れる（なければ作られる）'),
]
def uses_for(e):
    text = e['starter'][e['sprite']] + '\n' + answers.get(e['id'], '')
    body = '\n'.join(l.split('#')[0] for l in text.split('\n'))
    has = lambda pat: re.search(pat, body, re.M) is not None
    out = []
    for key, c, n in USES:
        if key.startswith('@'): ok = key in body
        elif key == 'while True': ok = 'while True:' in body
        elif key == 'while': ok = has(r'while (?!True:)')
        elif key == '[': ok = has(r'=\s*\[')
        elif key == '.append': ok = '.append(' in body
        elif key == '+=var': ok = has(r'(\S+) = \1 [+-]')
        elif key == '=var': ok = any(re.match(r'^\s*([^\s=()]+) = (?!\1 )(?!(?:int\()?input)[^=\[]', l) for l in body.split('\n'))
        elif key in ('if', 'else', 'for'): ok = has(r'^\s*' + key + r'\b') and (key != 'if' or has(r'^\s*if (?!key_pressed|touching|y_position)'))
        else: ok = has(r'\b' + re.escape(key) + r'\(')
        if ok: out.append({'code': c, 'note': n})
    return out[:10]

course = {'version': 3, 'steps': [
    {'title': 'ステップ1　読む', 'lessons': [a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, ma]},
    {'title': 'ステップ2　直す', 'lessons': [k6, k7, k8, m2]},
    {'title': 'ステップ3　書く', 'lessons': step3},
]}
for st_ in course['steps']:
    for L in st_['lessons']:
        for e in L['exercises']:
            if e.get('type') != 'quiz':
                e['uses'] = uses_for(e)
json.dump(course, open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(answers, open(A, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
n = sum(len(l['exercises']) for st_ in course['steps'] for l in st_['lessons'])
print('ok', n, 'exercises,', len(answers), 'answers')
