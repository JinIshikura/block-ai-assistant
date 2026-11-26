# 学習の課題（public/learn/course.json）と、テスト用の模範解答（tests/answers.json）を作る
#   python3 tools/course.py
# 方針（2026-11 作り直し）
#  ・Progate式：1レッスン＝短いスライド＋1つのことだけを確かめる小さな演習（えらぶ・直す・書く を混ぜる）
#  ・数レッスンごとに「道場」（ヒント少なめで、学んだことを組み合わせて作る）
#  ・スライドで説明したコードだけを演習で使う（tests/learn-taught-test.js で確認）
#  ・お題はゲーム中心（catch.sb3 のネコとリンゴ）
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


def code(label, line=None, indent=None, fail='', pattern=None, order=None, count=None, sprite=None):
    c = {'type': 'code', 'label': label, 'fail': fail}
    if line is not None: c['line'] = line
    if pattern is not None: c['pattern'] = pattern
    if order is not None: c['order'] = order
    if count is not None: c['count'] = count
    if indent is not None: c['indent'] = indent
    if sprite: c['sprite'] = sprite
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


def quiz(id, title, question, choices, answer, explain, code_=None, codeView=None, hint=None):
    d = {'id': id, 'type': 'quiz', 'title': title, 'question': question, 'choices': choices, 'answer': answer, 'explain': explain}
    if code_: d['code'] = code_
    if codeView: d['codeView'] = codeView
    if hint: d['hint'] = hint
    return d


def lesson(id, title, slides, exercises, dojo=False):
    d = {'id': id, 'title': title, 'slides': slides, 'exercises': exercises}
    if dojo: d['dojo'] = True
    return d


B = lambda c, why=None: dict({'block': c}, **({'why': why} if why else {}))
C = lambda c, why=None: dict({'code': c}, **({'why': why} if why else {}))
T = lambda t, why=None: dict({'text': t}, **({'why': why} if why else {}))
said = lambda sp, t, **k: dict({'kind': 'said', 'sprite': sp, 'text': t}, **k)
notSaid = lambda sp, t: {'kind': 'notSaid', 'sprite': sp, 'text': t}
final = lambda sp, prop, op, v: {'kind': 'final', 'sprite': sp, 'prop': prop, 'op': op, 'value': v}
varies = lambda sp, prop, mn, frm=0: {'kind': 'varies', 'sprite': sp, 'prop': prop, 'min': mn, 'from': frm}
still = lambda sp, prop, frm, until, tol=3: {'kind': 'still', 'sprite': sp, 'prop': prop, 'from': frm, 'until': until, 'tol': tol}
dec = lambda sp, prop, mn, frm=None: dict({'kind': 'decrease', 'sprite': sp, 'prop': prop, 'min': mn}, **({'from': frm} if frm is not None else {}))
inc = lambda sp, prop, mn, frm=None: dict({'kind': 'increase', 'sprite': sp, 'prop': prop, 'min': mn}, **({'from': frm} if frm is not None else {}))
var = lambda name, op, v: {'kind': 'var', 'name': name, 'op': op, 'value': v}
back = {'kind': 'returnAfter', 'sprite': 'リンゴ', 'prop': 'y', 'below': -60, 'above': 120}
key = lambda k, at=300, hold=600: [{'key': k, 'at': at, 'hold': hold}]
SPACE = [{'key': 'space', 'at': 300, 'hold': 200}]
CAT_AT = [{'sprite': 'ネコ', 'x': 0, 'y': -140, 'at': 0}]
APPLE_STAY = prog('go_to(0, 170)')
CAT_STAY = prog('go_to(0, -140)')
HAT_NOTE = '上の2行（@when_flag_clicked と def script1():）は「旗が押されたら、下の行を動かす」という決まった書き方。くわしくはレッスン3で学ぶ。'

# ================================================================ 章1　命令と順番
l1 = lesson('l1', 'レッスン1　命令を書こう', [
    slide('コードは、命令を文字で書いたもの',
          'プログラムは、コンピューターへの命令をならべたもの。Python（パイソン）では、命令を英語の名前で書く。\nmove は「動かす」という命令。左のブロックと右のコードは同じ意味。',
          'move(10)'),
    slide('( ) の中は「どれだけ」',
          '命令の名前のうしろの ( ) の中に、「どれだけ」を書く。move(10) は10歩、move(50) は50歩。\nマイナス（-）をつけると反対向きに動く。move(-50) は50歩もどる。\n数やかっこは半角で書く（全角の「（１０）」はエラーになる）。',
          'move(10)\nmove(50)\nmove(-50)'),
    slide('向きを決める・回す',
          'point_in_direction(90) は「90度に向ける」。90 は右、-90 は左、0 は上、180 は下。\nturn_right(15) は「右に15度回す」。',
          'point_in_direction(90)\nturn_right(15)'),
    slide('待つ命令と、はじまりの2行',
          'wait(1) は「1秒待つ」。命令の名前は決まっていて、1文字でもちがうと動かない。\n' + HAT_NOTE,
          prog('move(10)', 'wait(1)', 'turn_right(15)')),
], [
    quiz('l1q1', 'move(10) はどのブロック？', 'move(10) と同じ意味のブロックをえらぼう。',
         [B('move(10)'), B('turn_right(10)', 'それは「右に10度回す」。'), B('wait(10)', 'それは「10秒待つ」。'), B('move(100)', '( ) の中が100になっているよ。')],
         0, 'move は「動かす」、( ) の中の 10 が歩数。'),
    ex('l1e1', 'ネコを100歩動かそう', 'ネコ', prog('move(10)'),
       ['ネコが100歩動くようにする'],
       ['( ) の中の数が歩数。', '10 を 100 に書きかえる。', 'move(100) にする（数は半角）。'],
       [code('100歩動かしている', line='move(100)', indent=1, fail='move の ( ) の中を 100 にしよう。'),
        run('ネコが100歩動く', 1200, [final('ネコ', 'x', '>=', 95)], 'ネコが100歩動いていないよ。', setup=CAT_AT)],
       prog('move(100)')),
    ex('l1e2', '反対向きに動かそう', 'ネコ', prog('point_in_direction(90)', 'move(50)'),
       ['ネコが左（反対向き）に50歩動くようにする'],
       ['反対向きに動かすには、数にマイナスをつける。', 'move の ( ) の中を書きかえる。', 'move(-50) にする。'],
       [code('-50歩動かしている', line='move(-50)', indent=1, fail='move(-50) にしよう。'),
        run('左に50歩動く', 1200, [final('ネコ', 'x', '<=', -45)], 'ネコが左に50歩動いていないよ。', setup=CAT_AT)],
       prog('point_in_direction(90)', 'move(-50)')),
    quiz('l1q2', 'どっちを向く？', 'point_in_direction(-90) を動かすと、ネコはどっちを向く？',
         [T('右', '右は 90。'), T('左'), T('上', '上は 0。')], 1, '90 は右、-90 は左、0 は上、180 は下。'),
    ex('l1e3', '上を向いて歩こう', 'ネコ', prog('point_in_direction(90)', 'move(50)'),
       ['ネコが上を向いてから50歩動く（上に動く）'],
       ['上は 0 度。', 'point_in_direction の ( ) の中を書きかえる。', 'point_in_direction(0) にする。'],
       [code('上に向けている', line='point_in_direction(0)', indent=1, fail='point_in_direction(0) にしよう。'),
        run('上に50歩動く', 1200, [final('ネコ', 'y', '>=', -95)], 'ネコが上に動いていないよ。', setup=CAT_AT)],
       prog('point_in_direction(0)', 'move(50)')),
    ex('l1e4', '右に90度回ろう', 'ネコ', prog('point_in_direction(90)', 'turn_right(15)'),
       ['右向きから、右に90度回って下を向く'],
       ['回る角度は turn_right の ( ) の中。', '15 を 90 にする。', 'turn_right(90) にする。'],
       [code('90度回っている', line='turn_right(90)', indent=1, fail='turn_right の ( ) の中を 90 にしよう。'),
        run('下を向く', 1200, [final('ネコ', 'dir', '>', 175)], 'ネコが下を向いていないよ。')],
       prog('point_in_direction(90)', 'turn_right(90)')),
    quiz('l1q3', 'wait(2) はどんな命令？', 'wait(2) の意味をえらぼう。',
         [T('2歩動く', 'wait は動く命令ではないよ。'), T('2秒待つ'), T('2度回る', '回すのは turn_right。')], 1, 'wait は「待つ」。( ) の中は秒数。'),
    ex('l1e5', '待ってから動こう', 'ネコ', prog('point_in_direction(90)', '# ここに、2秒待つ命令を書こう', 'move(100)'),
       ['旗が押されたら、2秒待ってから100歩動く'],
       ['待つ命令は wait。', 'コメント（# の行）のところに書く。頭のスペース4つはそのまま。', 'wait(2) と書く。'],
       [code('2秒待っている', line='wait(2)', indent=1, fail='wait(2) を書こう。'),
        run('2秒たってから動く', 3200, [still('ネコ', 'x', 200, 1700), final('ネコ', 'x', '>=', 95)], '2秒待ってから100歩動くようにしよう。', setup=CAT_AT)],
       prog('point_in_direction(90)', 'wait(2)', 'move(100)')),
])

l2 = lesson('l2', 'レッスン2　言う・場所を決める', [
    slide('言う命令 print',
          'print("こんにちは") は「こんにちは と言う」。ネコのふきだしに文字が出る。',
          'print("こんにちは")'),
    slide('" " は「ここからここまでが文字」の印',
          '言わせたい文字は " "（半角のダブルクォーテーション）でかこむ。かこまないと、コンピューターは命令の名前だと思ってエラーになる。\n数はかこまなくてよい（move(10)）。',
          'print("こんにちは")\nprint("やあ")\nmove(10)'),
    slide('値が2つなら , で区切る',
          'say_for("こんにちは", 2) は「こんにちは と2秒言う」。( ) の中に値が2つあるときは , （半角のカンマ）で区切る。\n1つめが言うこと、2つめが秒数。順番は決まっている。',
          'say_for("こんにちは", 2)'),
    slide('場所を決める go_to',
          'ステージの真ん中が x座標 0、y座標 0。右へ行くほど x が大きく、上へ行くほど y が大きくなる。左や下はマイナス。\ngo_to(0, -140) は「x座標を0、y座標を-140にする」（真ん中の下の方）。',
          'go_to(0, 0)\ngo_to(0, -140)'),
], [
    quiz('l2q1', 'どれが正しい？', '「ニャー」と言わせる正しいコードをえらぼう。',
         [C('print(ニャー)', '" " でかこまないと、ニャー という名前だと思われてしまうよ。'), C('print("ニャー")'), C('print"ニャー"', '値は ( ) の中に書くよ。')],
         1, '文字は " " でかこんで、( ) の中に書く。'),
    quiz('l2q2', 'ネコは何と言う？', 'このコードを動かすと、ネコは何と言う？',
         [T('print', 'print は命令の名前。言うのは " " の中の文字。'), T('やった！'), T('"やった！"', '" " は文字の印なので、ふきだしには出ないよ。')],
         1, '" " の中の文字だけが、ふきだしに出る。', code_='print("やった！")', codeView='code'),
    ex('l2e1', '言うことを変えよう', 'ネコ', prog('print("こんにちは")'),
       ['ネコが「よろしくね」と言うようにする'],
       ['言うことは " " の中の文字。', '" " は消さずに、中の文字だけを書きかえる。', 'print("よろしくね") にする。'],
       [code('「よろしくね」と言う', line='print("よろしくね")', indent=1, fail='print("よろしくね") にしよう。" " を消さないでね。'),
        run('「よろしくね」と言う', 1200, [said('ネコ', 'よろしくね')], '「よろしくね」と言わなかったよ。')],
       prog('print("よろしくね")')),
    ex('l2e2', '" " を直そう', 'ネコ', prog('print(ニャー)'),
       ['エラーを直して、ネコが「ニャー」と言うようにする'],
       ['文字は " " でかこむ。', 'ニャー の前と後ろに " を入れる。', 'print("ニャー") にする。'],
       [run('「ニャー」と言う', 1200, [said('ネコ', 'ニャー')], '「ニャー」と言わなかったよ。')],
       prog('print("ニャー")')),
    quiz('l2q3', '2つめの値は何？', 'say_for("やあ", 3) の 3 は何を表している？',
         [T('言う回数', 'say_for は回数ではなく、言う時間を決めるよ。'), T('言う秒数'), T('文字の大きさ', 'say_for の値は、言うことと秒数の2つ。')],
         1, '1つめが言うこと、2つめが秒数。'),
    ex('l2e3', '3秒あいさつしよう', 'ネコ', prog('say_for("こんにちは", 2)'),
       ['ネコが「よろしくね」と3秒言うようにする'],
       ['1つめの値が言うこと、2つめが秒数。', '" " と , は消さない。', 'say_for("よろしくね", 3) にする。'],
       [code('「よろしくね」と3秒言う', line='say_for("よろしくね", 3)', indent=1, fail='say_for("よろしくね", 3) にしよう。'),
        run('「よろしくね」と言う', 1200, [said('ネコ', 'よろしくね')], '「よろしくね」と言わなかったよ。')],
       prog('say_for("よろしくね", 3)')),
    quiz('l2q4', 'ネコはどこへ行く？', 'go_to(150, 0) を動かすと、ネコはどこへ行く？',
         [T('真ん中より右'), T('真ん中より左', 'x がプラスなら右だよ。'), T('真ん中より上', '上下は2つめの値（y座標）で決まるよ。')],
         0, '1つめの値が x座標（左右）。プラスなら右。'),
    ex('l2e4', 'ネコを右上に連れていこう', 'ネコ', prog('go_to(0, -140)'),
       ['ネコを x座標 100、y座標 100 の場所に行かせる'],
       ['1つめが x座標、2つめが y座標。', 'どちらも 100 にする。', 'go_to(100, 100) にする。'],
       [code('右上に行く', line='go_to(100, 100)', indent=1, fail='go_to(100, 100) にしよう。'),
        run('右上に行く', 1000, [final('ネコ', 'x', '>', 95), final('ネコ', 'y', '>', 95)], 'ネコが右上（100, 100）に行っていないよ。')],
       prog('go_to(100, 100)')),
])

l3 = lesson('l3', 'レッスン3　はじまりの2行と順番', [
    slide('「旗が押されたら」の2行',
          '@when_flag_clicked と def script1(): の2行で、「緑の旗が押されたら、下のまとまりを動かす」という意味になる。Scratchの「旗が押されたとき」ブロック。\ndef の行の最後には : （コロン）をつける。',
          prog('move(10)')),
    slide('字下げ＝まとまりの中',
          'まとまりの中の行は、頭にスペースを4つ入れて右に下げる（字下げ）。Tabキーでも4つ下げられる。\n字下げしていない行は、まとまりに入らない（エラーになる）。',
          prog('go_to(0, -140)', 'move(100)', 'say_for("ついた！", 2)')),
    slide('上から1行ずつ動く',
          'まとまりの中の行は、上から順番に1行ずつ動く。1つの行が終わってから、次の行に進む。',
          prog('go_to(0, -140)', 'say_for("いくよ", 1)', 'move(100)', 'say_for("ついた！", 1)')),
    slide('順番を変えると、動きが変わる',
          '同じ命令でも、順番がちがうとちがう動きになる。下のコードは、「いくよ」と言う前に動いてしまう。',
          prog('go_to(0, -140)', 'move(100)', 'say_for("いくよ", 1)')),
], [
    quiz('l3q1', '字下げした行は？', '頭にスペースを4つ入れて字下げした行は、どうなる？',
         [T('旗が押されたら動くまとまりに入る'), T('動かない', '字下げした行は、まとまりの中で動くよ。'), T('2回動く', '字下げは回数には関係ないよ。')],
         0, '字下げで、どのまとまりの中かが決まる。'),
    quiz('l3q2', 'どれが正しい？', '「旗が押されたら100歩動く」正しいコードはどれ？',
         [C('@when_flag_clicked\ndef script1()\n    move(100)', 'def の行の最後に : がないよ。'), C('@when_flag_clicked\ndef script1():\nmove(100)', 'move(100) が字下げされていないよ。'), C('@when_flag_clicked\ndef script1():\n    move(100)')],
         2, ': と、スペース4つの字下げの両方が必要。'),
    ex('l3e1', '字下げを直そう', 'ネコ', '@when_flag_clicked\ndef script1():\ngo_to(0, -140)\nmove(100)',
       ['エラーを直して、旗が押されたら100歩動くようにする'],
       ['まとまりの中の行は、字下げが必要。', 'go_to と move の行の頭に、スペースを4つ入れる。', '行を選んで Tab キーを押してもよい。'],
       [code('move が字下げされている', line='move(100)', indent=1, fail='move(100) の頭にスペースを4つ入れよう。'),
        run('100歩動く', 1200, [final('ネコ', 'x', '>=', 95)], 'ネコが100歩動いていないよ。')],
       prog('go_to(0, -140)', 'move(100)'), brokenStarter=True),
    ex('l3e2', ': を直そう', 'ネコ', '@when_flag_clicked\ndef script1()\n    go_to(0, -140)\n    say_for("やあ", 2)',
       ['エラーを直して、旗が押されたら「やあ」と2秒言うようにする'],
       ['エラーが出ている行を見よう。', 'def の行の最後に必要な記号は？', 'def script1(): にする。'],
       [run('「やあ」と言う', 1200, [said('ネコ', 'やあ')], '「やあ」と言わなかったよ。')],
       prog('go_to(0, -140)', 'say_for("やあ", 2)'), brokenStarter=True),
    quiz('l3q3', '最初にすることは？', 'このコードを動かすと、ネコが最初にすることは？',
         [T('100歩動く', '上の行から順番に動くよ。'), T('「おはよう」と1秒言う'), T('1秒待つ', 'wait はいちばん下の行だよ。')],
         1, '上の行から順番に動く。', code_=prog('say_for("おはよう", 1)', 'move(100)', 'wait(1)')),
    ex('l3e3', '順番を直そう', 'ネコ', prog('go_to(0, -140)', 'move(100)', 'say_for("いくよ", 1)'),
       ['「いくよ」と1秒言ってから、100歩動く'],
       ['いまは、動いてから「いくよ」と言っている。', '2つの行の順番を入れかえる。', 'say_for("いくよ", 1) を move(100) の上の行にする。'],
       [code('言ってから動く順番', order=['say_for("いくよ", 1)', 'move(100)'], fail='say_for の行を move の行より上にしよう。'),
        run('言っているあいだは動かない', 2200, [still('ネコ', 'x', 200, 800), final('ネコ', 'x', '>=', 95)], '「いくよ」と言っているあいだに動いているよ。')],
       prog('go_to(0, -140)', 'say_for("いくよ", 1)', 'move(100)')),
    ex('l3e4', '自分で書いてみよう', 'ネコ', prog('go_to(0, -140)', '# この下に、100歩動いて「ついた！」と2秒言う2行を書こう'),
       ['旗が押されたら、100歩動いて「ついた！」と2秒言う'],
       ['動くのは move、言うのは say_for。', 'どちらも字下げ（スペース4つ）する。', 'move(100) と say_for("ついた！", 2) の2行。'],
       [code('100歩動く', line='move(100)', indent=1, fail='move(100) を字下げして書こう。'),
        code('「ついた！」と2秒言う', line='say_for("ついた！", 2)', indent=1, fail='say_for("ついた！", 2) を字下げして書こう。'),
        run('動いて「ついた！」と言う', 1500, [final('ネコ', 'x', '>=', 95), said('ネコ', 'ついた')], '100歩動いて「ついた！」と言うようにしよう。')],
       prog('go_to(0, -140)', 'move(100)', 'say_for("ついた！", 2)')),
    ex('l3e5', '行って、もどってこよう', 'ネコ', prog('go_to(0, -140)', 'move(100)', '# ここに、1秒待ってから -100歩動く行を書こう'),
       ['100歩動いて、1秒待ってから、-100歩動いてもとの場所にもどる'],
       ['-100歩動くと、反対向きに100歩もどる。', 'move(100) の下に wait(1)。', 'その下に move(-100)。'],
       [code('-100歩もどっている', line='move(-100)', indent=1, fail='move(-100) を書こう。'),
        run('行ってもどる', 2200, [varies('ネコ', 'x', 90), still('ネコ', 'x', 200, 800), final('ネコ', 'x', '<', 5), final('ネコ', 'x', '>', -5)], '100歩動いて、1秒止まって、もとの場所にもどるようにしよう。')],
       prog('go_to(0, -140)', 'move(100)', 'wait(1)', 'move(-100)')),
])

l4 = lesson('l4', 'レッスン4　くり返し', [
    slide('〇回くり返す for',
          'for i in range(3): は「3回くり返す」。range(3) の 3 が回数。最後の : をわすれずに。\nくり返す行は、for の下でもう1段（スペース4つ）字下げする。i は「いま何回目か」が入る変数（いまは気にしなくてよい）。',
          prog('go_to(-150, -140)', 'for i in range(3):', '    move(50)', '    wait(0.5)')),
    slide('同じ行が続いたら、くり返しにできる',
          '同じ命令を何回も書くかわりに、for で「〇回くり返す」と書くと、短くまちがいにくくなる。\nturn_left(90) は「左に90度回す」。',
          prog('for i in range(4):', '    move(50)', '    turn_right(90)')),
    slide('ずっとくり返す while True:',
          'while True: は「ずっとくり返す」（Scratchの「ずっと」）。最後の : をわすれずに。\nwhile True: の下で、もう1段字下げした行がくり返す行になる。',
          prog('point_in_direction(90)', 'while True:', '    turn_right(15)', '    wait(0.1)')),
    slide('字下げの深さで、中か外かが決まる',
          'くり返しの中の行は、スペース8つ（2段）の字下げになる。1段にもどした行は、くり返しの外。\nfor の外の行は、くり返しが終わってから1回だけ動く。',
          prog('for i in range(3):', '    move(50)', '    wait(0.5)', 'say_for("おわり", 1)')),
], [
    quiz('l4q1', '何回動く？', 'このコードで、ネコは何回 50歩動く？',
         [T('1回', 'move(50) はくり返しの中にあるよ。'), T('4回'), T('50回', '50 は歩数。回数は range の ( ) の中。')],
         1, 'range(4) の 4 が回数。', code_=prog('for i in range(4):', '    move(50)', '    wait(0.5)')),
    ex('l4e1', '5回くり返そう', 'ネコ', prog('go_to(-150, -140)', 'for i in range(2):', '    move(50)', '    wait(0.3)'),
       ['50歩動く・0.3秒待つ を、5回くり返す'],
       ['回数は range の ( ) の中。', '2 を 5 に書きかえる。', 'for i in range(5): にする。'],
       [code('5回くり返している', line='for i in range(0, 5):', indent=1, fail='for i in range(5): にしよう。'),
        run('250歩動く', 2500, [final('ネコ', 'x', '>=', 95)], '50歩ずつ5回動いていないよ。')],
       prog('go_to(-150, -140)', 'for i in range(5):', '    move(50)', '    wait(0.3)')),
    ex('l4e2', '3回くり返しで短くしよう', 'ネコ', prog('go_to(-150, -140)', 'move(50)', 'wait(0.5)', 'move(50)', 'wait(0.5)', 'move(50)', 'wait(0.5)'),
       ['for を使って、move(50) と wait(0.5) を1回ずつだけ書く', '動きは同じ（50歩ずつ3回）'],
       ['同じ2行が3回ある。', 'for i in range(3): の中に move(50) と wait(0.5) を入れる。', '残りの4行は消す。'],
       [code('3回のくり返しを使っている', line='for i in range(0, 3):', indent=1, fail='for i in range(3): を書こう。'),
        code('move(50) は1回だけ', line='move(50)', count=1, indent=2, fail='move(50) は、くり返しの中に1回だけ書こう。'),
        run('50歩ずつ3回動く', 2500, [final('ネコ', 'x', '>', -5), final('ネコ', 'x', '<', 5)], '150歩動いていないよ。')],
       prog('go_to(-150, -140)', 'for i in range(3):', '    move(50)', '    wait(0.5)')),
    ex('l4e3', '四角に動こう', 'ネコ', prog('go_to(0, 0)', 'point_in_direction(90)', 'for i in range(4):', '    move(50)', 'turn_right(90)', 'wait(0.5)'),
       ['「50歩動く→右に90度回る→0.5秒待つ」を4回くり返して、四角に動く', 'もとの場所・もとの向きにもどってくる'],
       ['いまは move(50) だけがくり返しの中。', 'turn_right と wait も1段下げる。', 'turn_right(90) と wait(0.5) の行の頭にスペースを4つ足す。'],
       [code('回る命令がくり返しの中にある', line='turn_right(90)', indent=2, fail='turn_right(90) を1段下げよう。'),
        run('四角に動いて、もどってくる', 3000, [varies('ネコ', 'y', 40), final('ネコ', 'x', '<', 5), final('ネコ', 'x', '>', -5), final('ネコ', 'dir', '>', 85), final('ネコ', 'dir', '<', 95)], 'もとの場所・もとの向きにもどってこないよ。')],
       prog('go_to(0, 0)', 'point_in_direction(90)', 'for i in range(4):', '    move(50)', '    turn_right(90)', '    wait(0.5)')),
    quiz('l4q2', 'くり返すのはどの行？', 'このコードで、ずっとくり返されるのはどれ？',
         [T('point_in_direction(90) だけ', 'while True: より前の行は1回だけ動くよ。'), T('turn_right(15) と wait(0.1)'), T('全部の行', 'くり返すのは、while True: の下で字下げした行だけ。')],
         1, 'while True: の下で、もう1段字下げした行がくり返される。', code_=prog('point_in_direction(90)', 'while True:', '    turn_right(15)', '    wait(0.1)')),
    ex('l4e4', 'ずっと回そう', 'ネコ', prog('point_in_direction(90)', 'turn_right(15)', 'wait(0.1)'),
       ['turn_right と wait を「ずっと」の中に入れて、ずっと回るようにする'],
       ['「ずっと」は while True:。', 'point_in_direction の次の行に while True: を書く。', 'turn_right と wait の行の頭に、スペースを4つ足して1段下げる。'],
       [code('「ずっと」を使っている', line='while True:', indent=1, fail='while True: を書こう。'),
        code('回る命令がくり返しの中にある', line='turn_right(15)', indent=2, fail='turn_right(15) を1段下げて、くり返しの中に入れよう。'),
        run('ずっと回り続ける', 2500, [varies('ネコ', 'dir', 30, 1000)], 'ネコがずっと回っていないよ。')],
       prog('point_in_direction(90)', 'while True:', '    turn_right(15)', '    wait(0.1)')),
    ex('l4e5', '首をふろう', 'ネコ', prog('point_in_direction(90)', 'while True:', '    turn_right(15)', '    wait(0.3)', '    # ここに、左に15度回って0.3秒待つ2行を書こう'),
       ['ずっと、右に15度回る→0.3秒待つ→左に15度回る→0.3秒待つ をくり返す'],
       ['左に回すのは turn_left。', 'くり返しの中なので、スペース8つ（2段）の字下げ。', 'turn_left(15) と wait(0.3) の2行を書く。'],
       [code('左に回す命令がくり返しの中にある', line='turn_left(15)', indent=2, fail='turn_left(15) を、くり返しの中（2段）に書こう。'),
        run('右と左に首をふる', 2500, [varies('ネコ', 'dir', 10, 400), final('ネコ', 'dir', '>', 85), final('ネコ', 'dir', '<', 110)], '右に回ったり左に回ったりしていないよ。')],
       prog('point_in_direction(90)', 'while True:', '    turn_right(15)', '    wait(0.3)', '    turn_left(15)', '    wait(0.3)')),
])

d1 = lesson('d1', '道場1　ネコのダンスを作ろう', [
    slide('道場のルール',
          '道場では、ヒントが少なめ。ここまでに学んだ命令を組み合わせて、自分でプログラムを組み立てよう。\n目標を1つずつ読んで、「どの命令を、どの順番で、何回？」を考えてから書くのがコツ。',
          prog('say_for("ダンスするよ！", 1)', 'for i in range(4):', '    turn_right(90)', '    wait(0.2)', 'say_for("おしまい", 2)')),
], [
    ex('d1e1', 'くるくるダンス', 'ネコ', prog('go_to(0, 0)', 'point_in_direction(90)', '# ここから書こう'),
       ['「ダンスするよ！」と1秒言う', '「右に45度回る→0.2秒待つ」を8回くり返す', '最後に「おしまい」と2秒言う'],
       ['for i in range(8): を使う。'],
       [code('8回くり返している', line='for i in range(0, 8):', indent=1, fail='8回くり返す for を書こう。'),
        run('ダンスして、もとの向きでおしまい', 4500, [said('ネコ', 'ダンスするよ'), varies('ネコ', 'dir', 40, 1000), final('ネコ', 'dir', '>', 85), final('ネコ', 'dir', '<', 95), said('ネコ', 'おしまい')], '「ダンスするよ！」→8回回る→「おしまい」の順になっているか見直そう。')],
       prog('go_to(0, 0)', 'point_in_direction(90)', 'say_for("ダンスするよ！", 1)', 'for i in range(8):', '    turn_right(45)', '    wait(0.2)', 'say_for("おしまい", 2)')),
    ex('d1e2', 'ステップダンス', 'ネコ', prog('go_to(0, -140)', 'point_in_direction(90)', '# ここから書こう'),
       ['ずっと「50歩動く→0.3秒待つ→-50歩動く→0.3秒待つ」をくり返す'],
       ['ずっとくり返すのは while True:。'],
       [code('ずっとくり返している', line='while True:', indent=1, fail='while True: を使おう。'),
        run('左右にステップする', 2500, [varies('ネコ', 'x', 40, 500), final('ネコ', 'x', '>', -5), final('ネコ', 'x', '<', 55)], '50歩動いてもどる動きを、ずっとくり返すようにしよう。')],
       prog('go_to(0, -140)', 'point_in_direction(90)', 'while True:', '    move(50)', '    wait(0.3)', '    move(-50)', '    wait(0.3)')),
], dojo=True)

# ================================================================ 章2　キー・条件・変数
SPACE_LOOP = prog('go_to(0, -140)', 'while True:', '    if key_pressed("スペース"):', '        say_for("ニャー", 1)')
CAT_RL = prog('go_to(0, -140)', 'while True:', '    if key_pressed("右向き矢印"):', '        change_x(10)')
CAT_LR = prog('go_to(0, -140)', 'while True:', '    if key_pressed("右向き矢印"):', '        change_x(10)', '    if key_pressed("左向き矢印"):', '        change_x(-10)')
ELSE_LOOP = prog('go_to(0, -140)', 'while True:', '    if key_pressed("スペース"):', '        print("ジャンプ！")', '    else:', '        print("まってる")')
l5 = lesson('l5', 'レッスン5　もし〜なら', [
    slide('「もし〜なら」は if',
          'if 条件: は「もし 条件 なら」（Scratchの「もし〜なら」）。条件が正しいときだけ、下で字下げした行が動く。最後の : をわすれずに。',
          prog('if key_pressed("スペース"):', '    say_for("ニャー", 1)')),
    slide('キーが押されたか key_pressed',
          'key_pressed("スペース") は「スペースキーが押された」という条件。キーの名前は " " でかこむ。\nキーはいつ押されるかわからないので、while True: の中に if を入れて、ずっと調べる。',
          SPACE_LOOP),
    slide('矢印キーで動かす change_x・change_y',
          'change_x(10) は「x座標を10ずつ変える」（右へ）。change_x(-10) は左へ。change_y(10) は上へ、change_y(-10) は下へ。\nキーの名前は "右向き矢印" "左向き矢印" "上向き矢印" "下向き矢印"。',
          prog('go_to(0, -140)', 'while True:', '    if key_pressed("右向き矢印"):', '        change_x(10)', '    if key_pressed("上向き矢印"):', '        change_y(10)')),
    slide('「でなければ」は else',
          'else: は「でなければ」（Scratchの「もし〜なら／でなければ」）。if と同じ深さに書き、中はもう1段下げる。\nif の条件が正しくないときに、else の中が動く。',
          ELSE_LOOP),
], [
    quiz('l5q1', 'いつ「ニャー」と言う？', 'このコードで、ネコが「ニャー」と言うのはいつ？',
         [T('旗を押したらすぐ', 'if の中なので、条件が正しいときだけだよ。'), T('スペースキーを押したとき'), T('ずっと言い続ける', 'ずっと調べているけれど、言うのはスペースキーが押されたときだけ。')],
         1, 'if の条件が正しいとき（スペースキーが押されたとき）だけ動く。', code_=SPACE_LOOP),
    ex('l5e1', 'スペースで鳴こう', 'ネコ', prog('go_to(0, -140)', 'while True:', '    wait(0.05)', '    # この下に、スペースキーが押されたら「ニャー」と1秒言う if を書こう'),
       ['スペースキーを押すと、「ニャー」と1秒言う'],
       ['if key_pressed("スペース"): を、while True: の中（2段の字下げ）に書く。', 'その下に say_for("ニャー", 1) を、さらに1段下げて書く。', '字下げは if が2段（スペース8つ）、say_for が3段（12）。'],
       [code('スペースキーで分けている', line='if key_pressed("スペース"):', indent=2, fail='if key_pressed("スペース"): を、while True: の中に書こう。'),
        run('スペースで「ニャー」', 1600, [said('ネコ', 'ニャー')], 'スペースキーを押しても「ニャー」と言わないよ。', keys=SPACE)],
       prog('go_to(0, -140)', 'while True:', '    wait(0.05)', '    if key_pressed("スペース"):', '        say_for("ニャー", 1)')),
    quiz('l5q2', '左に動かすコードは？', '左に10ずつ動かすコードをえらぼう。',
         [C('change_x(10)', 'プラスは右へ動くよ。'), C('change_x(-10)'), C('change_y(-10)', 'change_y は上下。-10 だと下へ動くよ。')],
         1, 'x座標をマイナスに変えると左へ動く。'),
    ex('l5e2', '右キーで動かそう', 'ネコ', prog('go_to(0, -140)', 'while True:', '    wait(0.05)', '    # 右向き矢印キーが押されたら、x座標を10ずつ変える if を書こう'),
       ['右向き矢印キーを押しているあいだ、ネコが右に動く'],
       ['キーの名前は "右向き矢印"。', 'if key_pressed("右向き矢印"): を2段の字下げで書く。', 'その中に change_x(10) を3段の字下げで書く。'],
       [code('右向き矢印キーで分けている', line='if key_pressed("右向き矢印"):', indent=2, fail='if key_pressed("右向き矢印"): を、while True: の中に書こう。'),
        run('右キーで右に動く', 1600, [inc('ネコ', 'x', 30)], '右向き矢印キーを押しても、右に動かないよ。', keys=key('右向き矢印'))],
       prog('go_to(0, -140)', 'while True:', '    wait(0.05)', '    if key_pressed("右向き矢印"):', '        change_x(10)')),
    ex('l5e3', '左にも動かそう', 'ネコ', CAT_RL,
       ['左向き矢印キーを押すと、ネコが左に動く'],
       ['右のときと同じ形の if を、もう1つ書く。', 'if key_pressed("左向き矢印"): を、右の if と同じ深さに。', 'その中に change_x(-10) を1段下げて書く。'],
       [code('左向き矢印キーで分けている', line='if key_pressed("左向き矢印"):', indent=2, fail='if key_pressed("左向き矢印"): を、右の if と同じ深さに書こう。'),
        run('左キーで左に動く', 1600, [dec('ネコ', 'x', 30)], '左向き矢印キーを押しても、左に動かないよ。', keys=key('左向き矢印'))],
       CAT_LR),
    ex('l5e4', '上にも動かそう', 'ネコ', CAT_LR,
       ['上向き矢印キーを押すと、ネコが上に動く'],
       ['上に動かすのは change_y。', 'if key_pressed("上向き矢印"): を、ほかの if と同じ深さに書く。', 'その中に change_y(10)。'],
       [code('上向き矢印キーで分けている', line='if key_pressed("上向き矢印"):', indent=2, fail='if key_pressed("上向き矢印"): を、ほかの if と同じ深さに書こう。'),
        run('上キーで上に動く', 1600, [inc('ネコ', 'y', 30)], '上向き矢印キーを押しても、上に動かないよ。', keys=key('上向き矢印'))],
       CAT_LR + '\n        if key_pressed("上向き矢印"):\n            change_y(10)'),
    quiz('l5q3', '押していないときは？', 'このコードで、スペースキーを押していないとき、ネコは何と言う？',
         [T('ジャンプ！', 'それはスペースキーを押したとき。'), T('まってる'), T('何も言わない', 'else の中は、if の条件が正しくないときに動くよ。')],
         1, 'if の条件が正しくないときは、else の中が動く。', code_=ELSE_LOOP),
    ex('l5e5', 'else を使おう', 'ネコ', prog('go_to(0, -140)', 'while True:', '    if key_pressed("スペース"):', '        print("ジャンプ！")', '    # でなければ「まってる」と言う（else を使う）'),
       ['スペースキーを押しているときは「ジャンプ！」、押していないときは「まってる」と言う'],
       ['else: は if と同じ深さ（2段）。', 'else の中の行は、もう1段下げる（3段）。', 'else: と print("まってる") の2行を書く。'],
       [code('else を使っている', line='else:', indent=2, fail='else: を、if と同じ深さに書こう。'),
        run('押していないとき「まってる」', 1200, [said('ネコ', 'まってる')], 'スペースキーを押していないのに「まってる」と言わないよ。'),
        run('押したとき「ジャンプ！」', 1200, [said('ネコ', 'ジャンプ')], 'スペースキーを押したのに「ジャンプ！」と言わないよ。', keys=SPACE)],
       ELSE_LOOP),
])


def score(*body, start='0'):
    return prog('得点 = ' + start, 'while True:', '    if key_pressed("スペース"):', *['        ' + b for b in body], '        wait(0.3)')


SCORE = score()
SCORE1 = score('得点 = 得点 + 1')
l6 = lesson('l6', 'レッスン6　変数', [
    slide('変数は、名前のついた箱',
          '得点 = 0 は「得点を0にする」（Scratchの「得点を0にする」）。= は「右の値を、左の変数（箱）に入れる」という意味で、「等しい」ではない。\n変数がまだなければ、自動で作られてステージに表示される。',
          prog('得点 = 0')),
    slide('箱の中身を使う',
          '変数の名前を書くと、中に入っている値が使われる。歩数 = 30 のあと move(歩数) と書くと、30歩動く。\n変数は " " でかこまない（かこむと「歩数」という文字になる）。',
          prog('歩数 = 30', 'move(歩数)', 'say_for(歩数, 1)')),
    slide('1ずつ変える',
          '得点 = 得点 + 1 は「得点を1ずつ変える」。右の 得点 + 1 を先に計算して、その答えを左の 得点 に入れなおす。',
          prog('得点 = 0', 'while True:', '    if key_pressed("スペース"):', '        得点 = 得点 + 1', '        wait(0.3)')),
    slide('短い書き方 +=',
          '得点 += 1 は、得点 = 得点 + 1 と同じ意味の短い書き方。得点 += 2 なら2ずつふえる。\nどちらで書いても、同じブロック（得点を〇ずつ変える）になる。',
          prog('得点 = 0', '得点 += 1', '得点 += 2')),
], [
    quiz('l6q1', '得点はいくつ？', 'このコードを動かしたあと、得点はいくつ？',
         [T('0', '得点 = 0 のあとに、2回ふやしているよ。'), T('1', '得点 = 得点 + 1 は2行あるよ。'), T('2')],
         2, '0 → 1 → 2 と、1ずつふえる。', code_=prog('得点 = 0', '得点 = 得点 + 1', '得点 = 得点 + 1')),
    ex('l6e1', '得点を10から始めよう', 'ネコ', prog('得点 = 0'),
       ['旗が押されたら、得点が10になる'],
       ['= の右が、箱に入れる値。', '0 を 10 にする。', '得点 = 10 にする。'],
       [code('得点を10にしている', line='得点 = 10', indent=1, fail='得点 = 10 にしよう。'),
        run('得点が10', 800, [var('得点', '==', 10)], '得点が10になっていないよ。')],
       prog('得点 = 10')),
    quiz('l6q2', '何と言う？', 'このコードを動かすと、ネコは何と言う？',
         [T('得点', '" " でかこむと、そのままの文字になるよ。'), T('5', '" " でかこんでいるので、変数の値ではなく文字になるよ。')],
         0, '" " でかこむと文字。変数の値を言わせるときは say_for(得点, 1) のように、かこまない。', code_=prog('得点 = 5', 'say_for("得点", 1)')),
    ex('l6e2', '変数で動かそう', 'ネコ', prog('point_in_direction(90)', '歩数 = 30', 'for i in range(3):', '    move(10)', '    wait(0.3)'),
       ['move の ( ) の中を、変数「歩数」にする', '歩数を 50 にして、50歩ずつ3回動く'],
       ['move(10) の 10 を 歩数 にする（" " はつけない）。', '歩数 = 30 の 30 を 50 にする。', 'move(歩数) と 歩数 = 50。'],
       [code('変数で動かしている', line='move(歩数)', indent=2, fail='move(歩数) にしよう。'),
        code('歩数を50にしている', line='歩数 = 50', indent=1, fail='歩数 = 50 にしよう。'),
        run('150歩動く', 2000, [final('ネコ', 'x', '>=', 145)], '50歩ずつ3回動いていないよ。', setup=CAT_AT)],
       prog('point_in_direction(90)', '歩数 = 50', 'for i in range(3):', '    move(歩数)', '    wait(0.3)')),
    ex('l6e3', 'スペースで得点をふやそう', 'ネコ', SCORE,
       ['スペースキーを押すたびに、得点が1ふえる'],
       ['「得点を1ずつ変える」は 得点 = 得点 + 1。', 'if の中（wait と同じ深さ）に書く。', 'wait(0.3) の上の行に 得点 = 得点 + 1。'],
       [code('得点を1ずつ変えている', line='得点 = 得点 + 1', indent=3, fail='得点 = 得点 + 1 を、if の中に書こう。'),
        run('スペースを1回押すと1点', 1500, [var('得点', '==', 1)], 'スペースキーを1回押したのに、得点が1にならないよ。', keys=SPACE)],
       SCORE1),
    ex('l6e4', '得点を言おう', 'ネコ', SCORE1,
       ['得点がふえたら、ネコがいまの得点を1秒言う'],
       ['say_for に変数を書くと、その値を言う。', '得点 = 得点 + 1 の次の行に書く。', 'say_for(得点, 1)（得点は " " でかこまない）。'],
       [code('得点を言っている', line='say_for(得点, 1)', indent=3, fail='say_for(得点, 1) を、得点 = 得点 + 1 の次の行に書こう。'),
        run('スペースで「1」と言う', 1800, [said('ネコ', '1')], 'スペースキーを押したのに、得点を言わなかったよ。', keys=SPACE)],
       score('得点 = 得点 + 1', 'say_for(得点, 1)')),
    ex('l6e5', '2点ずつふやそう', 'ネコ', score('得点 = 得点 + 1', 'say_for(得点, 1)'),
       ['スペースキーを押すたびに、得点が2ふえる（+= を使う）'],
       ['+= を使うと短く書ける。', '得点 = 得点 + 1 の行を書きかえる。', '得点 += 2 にする。'],
       [code('得点を2ずつ変えている', line='得点 = 得点 + 2', indent=3, fail='得点 += 2 にしよう。'),
        run('スペースを1回押すと2点', 1800, [var('得点', '==', 2)], 'スペースキーを1回押したのに、得点が2にならないよ。', keys=SPACE)],
       score('得点 += 2', 'say_for(得点, 1)')),
])


def apple(speed='change_y(-5)', cmp='<', miss=False, missIn=True, missOut=False):
    L = ['得点 = 0'] + (['ミス = 0'] if miss else []) + ['go_to(0, 170)', 'while True:', '    ' + speed, '    if y_position() ' + cmp + ' -170:']
    if miss and missIn: L.append('        ミス = ミス + 1')
    L += ['        go_to(random(-200, 200), 170)']
    if missOut: L.append('    ミス = ミス + 1')
    L += ['    if touching("ネコ"):', '        得点 = 得点 + 1', '        go_to(random(-200, 200), 170)']
    return prog(*L)


APPLE = apple()
l7 = lesson('l7', 'レッスン7　計算・くらべる・乱数', [
    slide('計算する + - * /',
          '+ は足し算、- は引き算、* はかけ算（×）、/ はわり算（÷）。Scratchの緑の計算ブロックと同じ。\nかけ算・わり算は、足し算・引き算より先に計算する。',
          prog('say_for(3 + 4, 2)', 'say_for(10 - 3, 2)', 'say_for(3 * 4, 2)', 'say_for(12 / 4, 2)')),
    slide('大きさをくらべる < > ==',
          'y_position() は「いまのy座標」。y_position() < -170 は「y座標が -170 より小さい」（下に行きすぎた）という条件。> は「より大きい」。口が開いている方が大きい。\n== は「同じ」。= （入れる）とまちがえないように。',
          prog('if y_position() < -170:', '    go_to(0, 170)', '得点 = 3', 'if 得点 == 3:', '    say_for("クリア！", 2)')),
    slide('ランダムな数 random',
          'random(1, 6) は「1 から 6 までのどれかの数」（乱数）。毎回ちがう数になる。\ngo_to(random(-200, 200), 170) なら、上の方のどこかランダムな場所へ行く。',
          prog('目 = random(1, 6)', 'say_for(目, 2)', 'go_to(random(-200, 200), 170)')),
    slide('「かつ」and と「触れた」touching',
          'A and B は「A かつ B」（両方とも正しい）。A or B は「A または B」（どちらかが正しい）。\ntouching("ネコ") は「ネコに触れた」という条件。',
          prog('while True:', '    if key_pressed("右向き矢印") and key_pressed("上向き矢印"):', '        print("ななめ！")', '    if touching("ネコ"):', '        go_to(0, 170)')),
], [
    quiz('l7q1', '何と言う？', 'このコードを動かすと、ネコは何と言う？',
         [T('14', 'かけ算が先だよ。10 - 3 を先に計算していない？'), T('4'), T('7', '3 * 2 を計算してから引くよ。')],
         1, 'かけ算が先：3 * 2 = 6、10 - 6 = 4。', code_=prog('say_for(10 - 3 * 2, 2)')),
    ex('l7e1', '計算させよう', 'ネコ', prog('go_to(0, -140)', '# 365 × 24 の答えを2秒言わせよう（1年は何時間？）'),
       ['365 × 24 の答えを、ネコに2秒言わせる'],
       ['かけ算の記号は *。', 'say_for の1つめの値に計算を書く。', 'say_for(365 * 24, 2) と書く。'],
       [code('かけ算を書いている', line='say_for(365 * 24, 2)', indent=1, fail='say_for(365 * 24, 2) と書こう。'),
        run('「8760」と言う', 1200, [said('ネコ', '8760')], '8760 と言わなかったよ。')],
       prog('go_to(0, -140)', 'say_for(365 * 24, 2)')),
    quiz('l7q2', 'どんな条件？', 'if y_position() < -170: はどんなとき？',
         [T('y座標が -170 より小さい（下にいる）とき'), T('y座標が -170 より大きいとき', '< は「左が右より小さい」。'), T('-170 秒たったとき', 'y_position() はy座標（上下の場所）だよ。')],
         0, '< の口は右に開いている → 右（-170）の方が大きい → y座標が -170 より小さい。'),
    ex('l7e2', '落ちたら上にもどそう', 'リンゴ', prog('go_to(0, 170)', 'while True:', '    change_y(-5)', '    # ここに、y座標が -170 より小さくなったら、上のランダムな場所にもどす if を書こう'),
       ['リンゴが下（y座標 -170 より下）に行ったら、上のランダムな場所（y座標 170）にもどす'],
       ['if y_position() < -170: を、change_y と同じ深さに書く。', 'その中に go_to(random(-200, 200), 170)。', 'random の ( ) の中は , で区切って2つ。'],
       [code('下に行ったかで分けている', line='if y_position() < -170:', indent=2, fail='if y_position() < -170: を、change_y と同じ深さに書こう。'),
        run('下まで落ちて上にもどる', 5000, [back], 'リンゴが下まで落ちて上にもどっていないよ。')],
       prog('go_to(0, 170)', 'while True:', '    change_y(-5)', '    if y_position() < -170:', '        go_to(random(-200, 200), 170)')),
    quiz('l7q3', 'どんな数になる？', 'random(1, 3) は、どんな数になる？',
         [T('1・2・3 のどれか'), T('いつも 3', 'random は毎回ちがう数になるよ。'), T('1 か 3 だけ', 'あいだの 2 も入るよ。')],
         0, 'random(1, 3) は 1 から 3 までのどれか（1 と 3 も入る）。'),
    ex('l7e3', 'サイコロをふろう', 'ネコ', prog('go_to(0, -140)', '# 1〜6 の乱数を変数「目」に入れて、目を2秒言う'),
       ['1から6までの乱数を、変数「目」に入れる', '目の数を2秒言う'],
       ['乱数は random(1, 6)。', '目 = random(1, 6) で、変数「目」に入る。', 'その下に say_for(目, 2)。'],
       [code('1〜6の乱数を「目」に入れている', line='目 = random(1, 6)', indent=1, fail='目 = random(1, 6) を書こう。'),
        run('1〜6のどれかを言う', 1200, [var('目', '>=', 1), var('目', '<=', 6), said('ネコ', '', texts=['1', '2', '3', '4', '5', '6'])], '1〜6のどれかの数を言わなかったよ。')],
       prog('go_to(0, -140)', '目 = random(1, 6)', 'say_for(目, 2)')),
    ex('l7e4', 'ななめキーを作ろう', 'ネコ', prog('go_to(0, -140)', 'while True:', '    wait(0.05)', '    # 右向き矢印と上向き矢印が両方押されたら「ななめ！」と言う'),
       ['右向き矢印キーと上向き矢印キーを両方押したときだけ、「ななめ！」と言う'],
       ['「両方」は and。', 'if key_pressed("右向き矢印") and key_pressed("上向き矢印"): と書く。', 'その中に print("ななめ！")。'],
       [code('and で両方を調べている', line='if key_pressed("右向き矢印") and key_pressed("上向き矢印"):', indent=2, fail='if key_pressed("右向き矢印") and key_pressed("上向き矢印"): を書こう。'),
        run('両方押すと「ななめ！」', 1400, [said('ネコ', 'ななめ')], '両方のキーを押したのに「ななめ！」と言わないよ。', keys=[{'key': '右向き矢印', 'at': 300, 'hold': 500}, {'key': '上向き矢印', 'at': 300, 'hold': 500}]),
        run('右だけなら言わない', 1400, [notSaid('ネコ', 'ななめ')], '右向き矢印キーだけなのに「ななめ！」と言っているよ。', keys=key('右向き矢印', 300, 500))],
       prog('go_to(0, -140)', 'while True:', '    wait(0.05)', '    if key_pressed("右向き矢印") and key_pressed("上向き矢印"):', '        print("ななめ！")')),
    ex('l7e5', 'キャッチしたら上にもどそう', 'リンゴ', prog('go_to(0, 170)', 'while True:', '    change_y(-5)'),
       ['ずっと下に落ちる。ネコに触れたら、上（x座標0、y座標170）にもどす'],
       ['「ネコに触れた」は touching("ネコ")。', 'change_y(-5) と同じ深さに if touching("ネコ"): を書く。', 'その中に go_to(0, 170)。'],
       [code('ネコに触れたかで分けている', line='if touching("ネコ"):', indent=2, fail='if touching("ネコ"): を、change_y と同じ深さに書こう。'),
        code('触れたら上にもどす', line='go_to(0, 170)', indent=3, fail='if の中に go_to(0, 170) を書こう。'),
        run('リンゴが落ちていく', 1500, [dec('リンゴ', 'y', 40)], 'リンゴが落ちていないよ。')],
       prog('go_to(0, 170)', 'while True:', '    change_y(-5)', '    if touching("ネコ"):', '        go_to(0, 170)')),
])

CLEAR = prog('得点 = 0', 'while True:', '    if key_pressed("スペース"):', '        得点 = 得点 + 1', '        wait(0.3)', '    if 得点 = 3:', '        say_for("クリア！", 2)')
THREE = [{'key': 'space', 'at': 300 + 500 * i, 'hold': 150} for i in range(3)]
l8 = lesson('l8', 'レッスン8　エラーを読んで直す', [
    slide('エラーは「ここがおかしい」のお知らせ',
          'コードに書きまちがいがあると、動かす前にエラーが出る。何行目がおかしいかと、理由が書いてある。\n赤くなった行と、その上の行を見てみよう。',
          prog('say_for("こんにちは！", 2)')),
    slide('よくあるまちがい',
          '( ) や " " の閉じわすれ／while や if の最後の : のわすれ／命令のつづりまちがい（move(10) を mvoe(10) と書くなど）／全角の記号や数字。\n正しい形と見くらべて直そう。',
          prog('while True:', '    move(10)', '    say_for("やあ", 1)')),
    slide('= と == はちがう',
          '= は「入れる」（得点 = 0）。== は「くらべる」（得点 == 3 は「得点が3と同じ」）。\nif のうしろでくらべるときは、かならず == を使う。',
          prog('得点 = 0', 'if 得点 == 3:', '    say_for("クリア！", 2)')),
    slide('字下げで「中」か「外」かが決まる',
          '同じ命令でも、字下げの深さで、どのくり返しや if の中に入るかが変わる。Scratchで、ブロックを入れる場所をまちがえるのと同じ。\nブロックと見比べると、まちがいを見つけやすい。',
          prog('for i in range(3):', '    move(50)', 'say_for("おわり", 1)')),
], [
    quiz('l8q1', 'エラーになるのは？', 'エラーになるコードはどれ？',
         [C('say_for("やあ", 1'), C('move(10)', 'これは正しいコード。'), C('wait(1)', 'これは正しいコード。')], 0, '( と ) は1組。閉じかっこがないとエラーになる。'),
    ex('l8e1', 'かっこを直そう', 'ネコ', prog('go_to(0, -140)', 'say_for("こんにちは！", 2'),
       ['エラーを直して、「こんにちは！」と2秒言うようにする'],
       ['エラーの行を見よう。', 'かっこは ( と ) で1組。', '最後に ) を足す。'],
       [run('「こんにちは！」と言う', 1200, [said('ネコ', 'こんにちは')], '「こんにちは！」と言わなかったよ。')],
       prog('go_to(0, -140)', 'say_for("こんにちは！", 2)'), brokenStarter=True),
    ex('l8e2', ': を直そう', 'ネコ', prog('point_in_direction(90)', 'while True', '    turn_right(15)', '    wait(0.1)'),
       ['エラーを直して、ずっと回るようにする'],
       ['while の行を見よう。', 'while や if の行の最後には、ある記号が必要。', 'while True: にする。'],
       [run('ずっと回る', 2500, [varies('ネコ', 'dir', 30, 1000)], 'ずっと回っていないよ。')],
       prog('point_in_direction(90)', 'while True:', '    turn_right(15)', '    wait(0.1)'), brokenStarter=True),
    ex('l8e3', 'つづりを直そう', 'ネコ', prog('go_to(0, -140)', 'mvoe(100)'),
       ['エラーを直して、ネコが100歩動くようにする'],
       ['エラーの文を読もう。', '命令の名前のつづりを見よう。', 'mvoe を move にする。'],
       [run('100歩動く', 1200, [final('ネコ', 'x', '>=', 95)], 'ネコが100歩動いていないよ。')],
       prog('go_to(0, -140)', 'move(100)'), brokenStarter=True),
    quiz('l8q2', '== はどんな意味？', 'if 得点 == 3: の == は、どんな意味？',
         [T('くらべる（得点が3と同じか）'), T('入れる（得点を3にする）', '入れるのは = （1つ）。'), T('たす（得点に3をたす）', 'たすのは +。')], 0, '== は「同じか」をくらべる。= は「入れる」。'),
    ex('l8e4', 'クリアと言わせよう', 'ネコ', CLEAR,
       ['得点が3になったら「クリア！」と言うようにする（エラーを直す）'],
       ['エラーが出ている行を見よう。', 'くらべるときの記号は？', 'if 得点 = 3: を if 得点 == 3: にする。'],
       [code('== でくらべている', line='if 得点 == 3:', indent=2, fail='if 得点 == 3: にしよう（= ではなく ==）。'),
        run('3回押すと「クリア！」', 3500, [said('ネコ', 'クリア')], 'スペースを3回押したのに「クリア！」と言わないよ。', keys=THREE)],
       CLEAR.replace('得点 = 3:', '得点 == 3:'), brokenStarter=True),
    quiz('l8q3', '何回言う？', 'このコードで、ネコは「おわり」と何回言う？',
         [T('1回'), T('3回', 'say_for はくり返しの外（字下げが for と同じ）にあるよ。')], 0, '字下げをもどした行は、くり返しが終わってから1回だけ動く。',
         code_=prog('for i in range(3):', '    move(50)', 'say_for("おわり", 1)')),
    ex('l8e5', '「おわり」は最後に1回', 'ネコ', prog('go_to(-150, -140)', 'for i in range(3):', '    move(50)', '    say_for("おわり", 1)'),
       ['50歩ずつ3回動いたあと、最後に1回だけ「おわり」と言う'],
       ['いまは、動くたびに「おわり」と言っている。', 'say_for はくり返しの外に出す。', 'say_for("おわり", 1) の字下げを1段もどす。'],
       [code('「おわり」がくり返しの外にある', line='say_for("おわり", 1)', indent=1, fail='say_for("おわり", 1) を、for と同じ深さにしよう。'),
        run('動いてから1回だけ言う', 2500, [still('ネコ', 'x', 200, 2400), said('ネコ', 'おわり')], '3回動き終わってから、1回だけ「おわり」と言うようにしよう。')],
       prog('go_to(-150, -140)', 'for i in range(3):', '    move(50)', 'say_for("おわり", 1)')),
    ex('l8e6', '左キーを直そう', 'ネコ', prog('go_to(0, -140)', 'while True:', '    if key_pressed("右向き矢印"):', '        change_x(10)', '        if key_pressed("左向き矢印"):', '            change_x(-10)'),
       ['左向き矢印キーだけを押したときも、左に動くようにする'],
       ['左の if が、右の if の中に入ってしまっている。', '左の if を、右の if と同じ深さにする。', '左の if を1段、change_x(-10) も1段もどす。'],
       [code('左の if が右の if の外にある', line='if key_pressed("左向き矢印"):', indent=2, fail='左の if を、右の if と同じ深さ（2段）にしよう。'),
        run('左キーで左に動く', 1600, [dec('ネコ', 'x', 30)], '左向き矢印キーだけを押しても、左に動かないよ。', keys=key('左向き矢印'))],
       CAT_LR),
])

d2 = lesson('d2', '道場2　リンゴキャッチを作ろう', [
    slide('リンゴキャッチの全体',
          'ネコを矢印キーで動かして、上から落ちてくるリンゴをキャッチするゲーム。ネコとリンゴ、それぞれのスプライトにプログラムを書く。\nここまでの if・変数・乱数・くらべる を組み合わせよう。',
          APPLE),
], [
    ex('d2e1', 'ネコを動かそう', 'ネコ', CAT_STAY + '\n    # 左右の矢印キーで、10ずつ動くようにしよう',
       ['右向き矢印キーで右に、左向き矢印キーで左に、10ずつ動く'],
       ['ずっと調べるので while True: の中に if を書く。'],
       [run('右キーで右に動く', 1600, [inc('ネコ', 'x', 30)], '右向き矢印キーで右に動かないよ。', keys=key('右向き矢印')),
        run('左キーで左に動く', 1600, [dec('ネコ', 'x', 30)], '左向き矢印キーで左に動かないよ。', keys=key('左向き矢印'))],
       CAT_LR, others={'リンゴ': APPLE_STAY}),
    ex('d2e2', 'リンゴを落とそう', 'リンゴ', prog('得点 = 0', 'go_to(0, 170)', '# ずっと：5ずつ下に動く', '#   下（y座標 -170 より下）に着いたら、上のランダムな場所にもどる', '#   ネコに触れたら、得点を1ふやして、上のランダムな場所にもどる'),
       ['ずっと5ずつ下に落ちる', '下に着いたら、上のランダムな場所（y座標 170）にもどる', 'ネコに触れたら、得点を1ふやして上のランダムな場所にもどる'],
       ['上にもどすのは go_to(random(-200, 200), 170)。'],
       [code('ネコに触れたかで分けている', line='if touching("ネコ"):', indent=2, fail='ネコに触れたかを調べる if を、ずっと の中に書こう。'),
        code('触れたら得点をふやしている', pattern='^得点 = 得点 \\+ 1$', indent=3, fail='ネコに触れたら、得点を1ふやそう。'),
        run('下まで落ちて上にもどる', 5000, [back], 'リンゴが下まで落ちて、上にもどっていないよ。')],
       APPLE, others={'ネコ': CAT_LR}),
    ex('d2e3', 'ミスを数えよう', 'リンゴ', APPLE,
       ['変数「ミス」を使う', '旗が押されたら、ミスを0にする', 'リンゴが下まで落ちるたびに、ミスを1ふやす'],
       ['得点と同じ書き方で、ミスの変数を作る。'],
       [code('ミスを0にしている', line='ミス = 0', indent=1, fail='得点 = 0 の近くに ミス = 0 を書こう。'),
        code('ミスを1ずつふやしている', pattern='^ミス = ミス \\+ 1$', indent=3, fail='下に落ちたとき（y座標が -170 より下の if の中）に、ミスを1ふやそう。'),
        run('落ちるとミスがふえる', 4500, [var('ミス', '>=', 1)], 'リンゴが下に落ちたのに、ミスがふえていないよ。')],
       apple(miss=True), others={'ネコ': CAT_LR}),
], dojo=True)

# ================================================================ 章3　質問・メッセージ・リスト・自分の命令
CAT = CAT_LR
APPLE_RET = prog('go_to(0, 170)', 'while True:', '    change_y(-5)', '    if y_position() < -170:', '        go_to(random(-200, 200), 170)')
APPLE_MISS = APPLE_RET.replace('        if y_position() < -170:\n', '        if y_position() < -170:\n            broadcast("ミス")\n')
l9 = lesson('l9', 'レッスン9　質問して答える', [
    slide('質問して、答えを使う input',
          'Scratchの「〇と聞いて待つ」と「答え」は、Pythonでは input() 1つで書ける。\n名前 = input("名前は？") は、「名前は？」と質問して待ち、答えを変数「名前」に入れる。動かすと、ステージの下に答えを書く欄が出る（判定のときは、プログラムが自動で答える）。',
          prog('名前 = input("名前は？")', 'say_for(名前, 2)')),
    slide('文字をつなぐ ＋',
          '文字と文字の ＋ は「つなぐ」（Scratchの「〇と〇」ブロック）。数と数の ＋ は足し算になる。\n"こんにちは、" + 名前 + "！" は、名前が「たろう」なら「こんにちは、たろう！」になる。',
          prog('名前 = input("名前は？")', 'say_for("こんにちは、" + 名前 + "！", 2)')),
    slide('数にする int()、文字にする str()',
          'input() の答えは「文字」。計算に使うときは int() で数にする（int(input("数は？"))）。\n反対に、数を文字とつなぐときは str() で文字にする。"得点は" + str(得点) + "点" なら「得点は3点」。',
          prog('a = int(input("1つめの数は？"))', 'b = int(input("2つめの数は？"))', 'say_for(a + b, 2)', '得点 = 3', 'say_for("得点は" + str(得点) + "点", 2)')),
], [
    quiz('l9q1', '答えはどこに入る？', '名前 = input("名前は？") で、質問への答えはどうなる？',
         [T('変数「名前」に入る'), T('すぐに消える', '= の左の変数に入るよ。'), T('「名前は？」になる', '「名前は？」は質問の文。')], 0, 'input() は質問して待ち、答えを = の左の変数に入れる。', code_=prog('名前 = input("名前は？")')),
    ex('l9e1', '名前を聞いてあいさつしよう', 'ネコ', CAT_STAY + '\n    # ここに、名前を聞いてあいさつするコードを書こう',
       ['「名前は？」と質問して、答えを変数「名前」に入れる', '「こんにちは、〇〇！」と2秒言う（〇〇は答えた名前）'],
       ['input("名前は？") で質問できる。', '名前 = input("名前は？") と書くと、答えが「名前」に入る。', 'say_for("こんにちは、" + 名前 + "！", 2) で、文字をつないで言える。'],
       [code('名前を聞いて、変数「名前」に入れている', line='名前 = input("名前は？")', indent=1, fail='名前 = input("名前は？") を、go_to の次の行に書こう。'),
        run('答えた名前であいさつする', 3200, [said('ネコ', 'こんにちは、たろう！')], '「たろう」と答えたのに、「こんにちは、たろう！」と言わなかったよ。「、」や「！」もまちがえずに。', answers_=[{'at': 700, 'text': 'たろう'}])],
       CAT_STAY + '\n    名前 = input("名前は？")\n    say_for("こんにちは、" + 名前 + "！", 2)', others={'リンゴ': APPLE_STAY}),
    quiz('l9q2', '何と言う？', 'このコードを動かすと、ネコは何と言う？',
         [T('7', '" " でかこんだ "3" と "4" は文字。文字の + は「つなぐ」だよ。'), T('34')], 1, '文字と文字の + は、つなぐ。"3" + "4" は「34」。',
         code_=prog('say_for("3" + "4", 2)')),
    ex('l9e2', '好きな食べ物を聞こう', 'ネコ', CAT_STAY + '\n    # 「好きな食べ物は？」と聞いて、「〇〇がすきなんだね」と2秒言う',
       ['「好きな食べ物は？」と質問して、答えを変数「食べ物」に入れる', '「〇〇がすきなんだね」と2秒言う'],
       ['食べ物 = input("好きな食べ物は？") と書く。', '答えと文字を + でつなぐ。', 'say_for(食べ物 + "がすきなんだね", 2)。'],
       [run('「カレーがすきなんだね」と言う', 3200, [said('ネコ', 'カレーがすきなんだね')], '「カレー」と答えたのに、「カレーがすきなんだね」と言わなかったよ。', answers_=[{'at': 700, 'text': 'カレー'}])],
       CAT_STAY + '\n    食べ物 = input("好きな食べ物は？")\n    say_for(食べ物 + "がすきなんだね", 2)', others={'リンゴ': APPLE_STAY}),
    ex('l9e3', 'かけ算クイズを作ろう', 'ネコ', CAT_STAY + '\n    答え = input("3 × 4 は？")\n    # 答えが 12 なら「正解！」、でなければ「ざんねん」と2秒言う',
       ['答えが 12 なら「正解！」と2秒言う', 'それ以外なら「ざんねん」と2秒言う（else を使う）'],
       ['if 答え == "12": と書く。くらべるのは == 。', 'else: は if と同じ深さに書く。', 'if の中と else の中に、それぞれ say_for を1段下げて書く。'],
       [code('if で答えをくらべている', line='if 答え == 12:', indent=1, fail='if 答え == "12": を書こう（= ではなく ==）。'),
        code('else を使っている', line='else:', indent=1, fail='else: を if と同じ深さに書こう。'),
        run('12 と答えると「正解！」', 3000, [said('ネコ', '正解')], '12 と答えたのに「正解！」と言わなかったよ。', answers_=[{'at': 700, 'text': '12'}]),
        run('10 と答えると「ざんねん」', 3000, [said('ネコ', 'ざんねん'), notSaid('ネコ', '正解')], '10 と答えたときは「ざんねん」だけを言うようにしよう。', answers_=[{'at': 700, 'text': '10'}])],
       CAT_STAY + '\n    答え = input("3 × 4 は？")\n    if 答え == "12":\n        say_for("正解！", 2)\n    else:\n        say_for("ざんねん", 2)', others={'リンゴ': APPLE_STAY}),
    ex('l9e4', '足し算マシンを作ろう', 'ネコ', CAT_STAY + '\n    # 数を2つ聞いて、足した答えを2秒言う',
       ['「1つめの数は？」「2つめの数は？」と2回質問する', '2つの数を足した答えを2秒言う'],
       ['a = int(input("1つめの数は？")) で、答えを数として a に入れられる。', '2つめも同じように b に入れる。', 'say_for(a + b, 2) で足した答えを言う。'],
       [code('質問の答えを変数に入れている', pattern='^\\S+ = input\\(', indent=1, fail='a = int(input("1つめの数は？")) のように、答えを変数に入れよう。'),
        run('3 と 4 なら 7 と言う', 4200, [said('ネコ', '7')], '3 と 4 と答えたのに、7 と言わなかったよ。', answers_=[{'at': 700, 'text': '3'}, {'at': 1500, 'text': '4'}])],
       CAT_STAY + '\n    a = int(input("1つめの数は？"))\n    b = int(input("2つめの数は？"))\n    say_for(a + b, 2)', others={'リンゴ': APPLE_STAY}),
    ex('l9e5', '得点を文で言おう', 'ネコ', prog('得点 = 3', 'say_for(得点, 2)'),
       ['「得点は3点」と2秒言う（3 は変数「得点」の値）'],
       ['文字と数をつなぐときは、str() で数を文字にする。', '"得点は" + str(得点) + "点" とつなぐ。', 'say_for("得点は" + str(得点) + "点", 2)。'],
       [run('「得点は3点」と言う', 1200, [said('ネコ', '得点は3点')], '「得点は3点」と言わなかったよ。')],
       prog('得点 = 3', 'say_for("得点は" + str(得点) + "点", 2)')),
])

l10 = lesson('l10', 'レッスン10　条件つきのくり返し', [
    slide('条件が正しいあいだ、くり返す',
          'while のうしろに条件を書くと、「条件が正しいあいだ、くり返す」になる。\nScratchの「〜まで繰り返す」とは条件が反対になるので注意。下の例は「y座標が -170 より上のあいだ、下に動く」。くり返しが終わると、次の行に進む。',
          prog('while y_position() > -170:', '    change_y(-5)', 'say_for("落ちた！", 1)')),
    slide('数えてくり返す',
          '変数で回数を数えると、「〇回まで」のくり返しも書ける。回数が5より小さいあいだくり返し、1回ごとに回数を1ふやす。\n回数をふやすのをわすれると、ずっと終わらない。',
          prog('回数 = 0', 'while 回数 < 5:', '    move(10)', '    回数 += 1')),
    slide('「ちがう」は !=',
          '!= は「ちがう」（== の反対）。while 答え != "12": は「答えが 12 とちがうあいだ」くり返す。\n正解するまで、何回でも聞きなおせる。',
          prog('答え = input("3 × 4 は？")', 'while 答え != "12":', '    答え = input("もう一度！ 3 × 4 は？")', 'say_for("正解！", 2)')),
], [
    quiz('l10q1', 'いつまでくり返す？', 'このくり返しは、いつまで続く？',
         [T('y座標が -170 より上にいるあいだ'), T('ずっと', 'while True: ではなく、条件がついているよ。'), T('170回', '回数をくり返すのは for。')], 0, 'while 条件: は、条件が正しいあいだくり返す。',
         code_=prog('while y_position() > -170:', '    change_y(-5)')),
    ex('l10e1', '下に着くまで落とそう', 'リンゴ', APPLE_STAY + '\n    # y座標が -170 より上のあいだ、5ずつ下に動かす\n    # 下に着いたら「落ちた！」と1秒言う',
       ['y座標が -170 より上のあいだだけ、5ずつ下に動かす（while と条件）', '下に着いたら「落ちた！」と1秒言う'],
       ['while のうしろに条件を書く。「y座標が -170 より上」は y_position() > -170 。', 'while の中に change_y(-5) を1段下げて書く。', 'say_for("落ちた！", 1) は while の外（while と同じ深さ）に書く。'],
       [code('条件つきの while を使っている', pattern='^while (?!True:).+:$', indent=1, fail='while True: ではなく、while y_position() > -170: のように条件を書こう。'),
        run('下まで落ちて「落ちた！」と言う', 4000, [final('リンゴ', 'y', '<', -160), said('リンゴ', '落ちた')], 'リンゴが下まで落ちて「落ちた！」と言うようにしよう。say_for は while の外に書くよ。')],
       APPLE_STAY + '\n    while y_position() > -170:\n        change_y(-5)\n    say_for("落ちた！", 1)', others={'ネコ': CAT_STAY}),
    quiz('l10q2', '何回くり返す？', 'このコードで、ネコは何回 10歩動く？',
         [T('3回'), T('4回', '回数が 3 になったとき、3 < 3 は正しくないので止まるよ。'), T('ずっと', '回数が1ずつふえるので、いつか止まるよ。')], 0, '回数が 0, 1, 2 のときにくり返し、3 になったら止まる。',
         code_=prog('回数 = 0', 'while 回数 < 3:', '    move(10)', '    回数 += 1')),
    ex('l10e2', '5回ジャンプしよう', 'ネコ', prog('go_to(0, -140)', '回数 = 0', 'while 回数 < 5:', '    change_y(30)', '    wait(0.2)', '    change_y(-30)', '    wait(0.2)', 'say_for("おしまい", 1)'),
       ['5回ジャンプしたら、くり返しを終えて「おしまい」と言う'],
       ['いまは回数がふえないので、ずっと終わらない。', 'くり返しの中で、回数を1ふやす。', 'くり返しの中のいちばん下に 回数 += 1 を書く。'],
       [run('5回で「おしまい」', 3500, [var('回数', '==', 5), said('ネコ', 'おしまい')], '5回ジャンプしたあとに「おしまい」と言わなかったよ。')],
       prog('go_to(0, -140)', '回数 = 0', 'while 回数 < 5:', '    change_y(30)', '    wait(0.2)', '    change_y(-30)', '    wait(0.2)', '    回数 += 1', 'say_for("おしまい", 1)')),
    ex('l10e3', 'だんだん速くしよう', 'リンゴ', prog('速さ = 5', 'go_to(0, 170)', 'while True:', '    change_y(-5)', '    if y_position() < -170:', '        go_to(random(-200, 200), 170)'),
       ['下に動く量を、変数「速さ」にする', '下に着いて上にもどるたびに、速さを1ずつ増やす'],
       ['change_y(-5) の 5 を 速さ に変える（-速さ）。', '上にもどる go_to の次の行に、速さを1増やす行を書く。', '速さ += 1 を、if の中（go_to と同じ深さ）に書く。'],
       [code('速さの変数で動かしている', pattern='^change_y\\(.*速さ.*\\)$', indent=2, fail='change_y(-速さ) のように、5 のかわりに 速さ を使おう。'),
        code('速さを1ずつ増やしている', line='速さ = 速さ + 1', indent=3, fail='速さ += 1 を、if の中に書こう。'),
        run('だんだん速くなる', 6000, [var('速さ', '>=', 7), back], 'もどるたびに速さが増えていないようだよ。')],
       prog('速さ = 5', 'go_to(0, 170)', 'while True:', '    change_y(-速さ)', '    if y_position() < -170:', '        go_to(random(-200, 200), 170)', '        速さ += 1'), others={'ネコ': CAT_STAY}),
    ex('l10e4', '正解するまで聞こう', 'ネコ', CAT_STAY + '\n    答え = input("3 × 4 は？")\n    # 答えが "12" とちがうあいだ、もう一度聞いて答えに入れる\n    say_for("正解！", 2)',
       ['答えが 12 とちがうあいだ、「もう一度！ 3 × 4 は？」と聞きなおす', '正解したら「正解！」と2秒言う'],
       ['「ちがうあいだ」は while 答え != "12":。', 'while の中で、答え = input("もう一度！ 3 × 4 は？")。', 'say_for("正解！", 2) は while の外のまま。'],
       [code('「ちがうあいだ」くり返している', pattern='^while 答え != 12:$', indent=1, fail='while 答え != "12": を書こう。'),
        run('10 → 12 と答えると「正解！」', 3600, [var('答え', '==', 12), said('ネコ', '正解')], '10 と答えたあとに聞きなおして、12 で「正解！」と言うようにしよう。', answers_=[{'at': 700, 'text': '10'}, {'at': 1500, 'text': '12'}])],
       CAT_STAY + '\n    答え = input("3 × 4 は？")\n    while 答え != "12":\n        答え = input("もう一度！ 3 × 4 は？")\n    say_for("正解！", 2)', others={'リンゴ': APPLE_STAY}),
    ex('l10e5', '数あてゲームを作ろう', 'ネコ', CAT_STAY + '\n    正解 = 7\n    予想 = int(input("1から10の数は？"))\n    # 予想が正解とちがうあいだ、くり返す\n    #   予想が小さければ「もっと大きい」、大きければ「もっと小さい」と1秒言う\n    #   そのあと、もう一度質問して予想に入れる\n    say_for("あたり！", 2)',
       ['予想が正解（7）とちがうあいだ、くり返す', '小さければ「もっと大きい」、大きければ「もっと小さい」と1秒言って、もう一度聞く', 'あたったら「あたり！」と言う'],
       ['while 予想 != 正解: で「ちがうあいだ」くり返す。', 'while の中に if 予想 < 正解: と else: を書く。', 'while の中のいちばん最後に、予想 = int(input("1から10の数は？")) を書く。'],
       [code('「ちがうあいだ」くり返している', pattern='^while .*予想.*:$', indent=1, fail='while 予想 != 正解: を書こう。'),
        run('3 → 9 → 7 と答えて遊べる', 5600, [said('ネコ', 'もっと大きい'), said('ネコ', 'もっと小さい'), said('ネコ', 'あたり')], '3、9、7 の順に答えたけれど、「もっと大きい」「もっと小さい」「あたり！」の順に言わなかったよ。', answers_=[{'at': 700, 'text': '3'}, {'at': 2300, 'text': '9'}, {'at': 3900, 'text': '7'}])],
       CAT_STAY + '\n    正解 = 7\n    予想 = int(input("1から10の数は？"))\n    while 予想 != 正解:\n        if 予想 < 正解:\n            say_for("もっと大きい", 1)\n        else:\n            say_for("もっと小さい", 1)\n        予想 = int(input("1から10の数は？"))\n    say_for("あたり！", 2)', others={'リンゴ': APPLE_STAY}),
])

l11 = lesson('l11', 'レッスン11　キーとメッセージのまとまり', [
    slide('キーが押されたとき',
          '@when_key_pressed("スペース") と def script2(): の2行で、「スペースキーが押されたとき」のまとまりになる（Scratchの「スペースキーが押されたとき」）。\n1つのスプライトに、まとまりをいくつも書ける。',
          prog('go_to(0, -140)') + '\n\n@when_key_pressed("スペース")\ndef script2():\n    say_for("ジャンプ！", 1)'),
    slide('メッセージを送る・受け取る',
          'broadcast("ミス") は、Scratchの「ミスを送る」。\n@when_broadcast_received("ミス") から始まるまとまりは、「ミスを受け取ったとき」に動く。ほかのスプライトに合図を送れる。',
          prog('broadcast("ミス")') + '\n\n@when_broadcast_received("ミス")\ndef script2():\n    say_for("あっ！", 1)'),
    slide('まとまりを書く場所',
          '新しいまとまりは、いまあるまとまりのあとに、1行あけて書く。@ の行と def の行は字下げしない（0段目）。\nscript1、script2 … の番号は、同じスプライトの中で重ならなければよい。',
          prog('go_to(0, -140)') + '\n\n@when_broadcast_received("スタート")\ndef script2():\n    say_for("スタート！", 1)'),
], [
    quiz('l11q1', 'どのブロック？', 'broadcast("ミス") と同じ意味のブロックをえらぼう。',
         [B('broadcast("ミス")'), B('say_for("ミス", 1)', 'それは「ミスと1秒言う」。'), B('print("ミス")', 'それは「ミスと言う」。')], 0, 'broadcast は「メッセージを送る」。'),
    ex('l11e1', 'スペースでジャンプしよう', 'ネコ', CAT,
       ['スペースキーが押されたら、50上に動いて0.3秒待ち、50下にもどる（ジャンプ）'],
       ['いまのまとまりのあとに、1行あけて新しいまとまりを書く。', '@when_key_pressed("スペース") の次の行に def script2(): を書く。', 'その中に change_y(50)、wait(0.3)、change_y(-50)。'],
       [code('スペースキーのまとまりがある', line='@when_key_pressed("スペース")', indent=0, fail='@when_key_pressed("スペース") を、字下げしないで書こう。'),
        run('スペースでジャンプする', 1600, [inc('ネコ', 'y', 40)], 'スペースキーを押したのに、ジャンプしないよ。', keys=SPACE)],
       CAT + '\n\n@when_key_pressed("スペース")\ndef script2():\n    change_y(50)\n    wait(0.3)\n    change_y(-50)', others={'リンゴ': APPLE_STAY}),
    ex('l11e2', 'サイコロのまとまりを作ろう', 'ネコ', CAT,
       ['スペースキーを押したら、1〜6の乱数を変数「目」に入れる', '「〇が出た！」と1秒言う（〇は目の数）'],
       ['@when_key_pressed("スペース") から始まるまとまりを、新しく書く。', '目 = random(1, 6) で、1〜6のどれかが入る。', 'say_for(str(目) + "が出た！", 1) で言える。'],
       [code('スペースキーのまとまりがある', line='@when_key_pressed("スペース")', indent=0, fail='@when_key_pressed("スペース") と def script2(): を書こう。'),
        code('1〜6の乱数を「目」に入れている', line='目 = random(1, 6)', indent=1, fail='目 = random(1, 6) を書こう。'),
        run('スペースで「〇が出た！」と言う', 1800, [said('ネコ', 'が出た'), var('目', '>=', 1), var('目', '<=', 6)], 'スペースキーを押したのに「〇が出た！」と言わなかったよ。', keys=SPACE)],
       CAT + '\n\n@when_key_pressed("スペース")\ndef script2():\n    目 = random(1, 6)\n    say_for(str(目) + "が出た！", 1)', others={'リンゴ': APPLE_STAY}),
    ex('l11e3', 'ミスを受け取ろう', 'ネコ', CAT,
       ['リンゴは下に着くと「ミス」を送る。ネコでそれを受け取る', '受け取ったら、ネコが「あっ！」と1秒言う'],
       ['いまのまとまりのあとに、1行あけて新しいまとまりを書く。', '@when_broadcast_received("ミス") の次の行に def script2(): を書く。', 'その中に say_for("あっ！", 1) を1段下げて書く。'],
       [code('「ミス」を受け取るまとまりがある', line='@when_broadcast_received("ミス")', indent=0, fail='@when_broadcast_received("ミス") を、字下げしないで書こう。'),
        run('ミスのとき「あっ！」と言う', 4500, [said('ネコ', 'あっ')], 'リンゴが下に着いたのに、ネコが「あっ！」と言わなかったよ。')],
       CAT + '\n\n@when_broadcast_received("ミス")\ndef script2():\n    say_for("あっ！", 1)', others={'リンゴ': APPLE_MISS}),
    ex('l11e4', 'ミスを送ろう', 'リンゴ', APPLE_RET,
       ['リンゴが下に着いたとき、「ミス」を送る', 'ネコには受け取るまとまりがもうある（「ドンマイ！」と言う）'],
       ['下に着いたときに動くのは、if y_position() < -170: の中。', 'その中に broadcast("ミス") を書く。', 'go_to と同じ深さ（3段目）に broadcast("ミス") を書く。'],
       [code('下に着いたとき「ミス」を送っている', line='broadcast("ミス")', indent=3, fail='broadcast("ミス") を、if の中に書こう。'),
        run('ネコが「ドンマイ！」と言う', 4500, [said('ネコ', 'ドンマイ')], 'リンゴが下に着いたのに、ネコが「ドンマイ！」と言わなかったよ。')],
       APPLE_MISS, others={'ネコ': CAT + '\n\n@when_broadcast_received("ミス")\ndef script2():\n    say_for("ドンマイ！", 1)'}),
    ex('l11e5', 'スタートの合図を作ろう', 'リンゴ', APPLE_RET,
       ['ネコは「よーい、スタート！」と言ってから「スタート」を送る', 'リンゴは、旗ではなく「スタート」を受け取ってから落ち始める'],
       ['リンゴのまとまりの、はじまりの行を変える。', '@when_flag_clicked を @when_broadcast_received("スタート") にする。', 'ほかの行はそのままでよい。'],
       [code('「スタート」で始まる', line='@when_broadcast_received("スタート")', indent=0, fail='はじまりの行を @when_broadcast_received("スタート") にしよう。'),
        run('合図のあとに落ち始める', 4200, [still('リンゴ', 'y', 300, 1700), dec('リンゴ', 'y', 40, 2400)], 'リンゴが、ネコの合図より前に落ち始めているか、落ちていないよ。', setup=[{'sprite': 'リンゴ', 'x': 0, 'y': 170, 'at': 0}])],
       APPLE_RET.replace('@when_flag_clicked', '@when_broadcast_received("スタート")'), others={'ネコ': CAT_STAY + '\n    say_for("よーい、スタート！", 2)\n    broadcast("スタート")'}),
])

l12 = lesson('l12', 'レッスン12　リスト', [
    slide('リストは、データをならべて入れる箱',
          '[ ] の中に , で区切ってならべると、リストになる（Scratchの「リスト」）。\n1つの変数に、いくつものデータを入れられる。',
          prog('ことば = ["やったね", "すごい", "その調子"]')),
    slide('番号で取り出す（0から数える）',
          'Pythonは 0 から数える。ことば[0] は "やったね"、ことば[2] は "その調子"。Scratchの「1番目」が、Pythonでは [0] になる。\nことば[random(0, 2)] で、どれか1つをえらべる。',
          prog('ことば = ["やったね", "すごい", "その調子"]', 'say_for(ことば[0], 1)', 'say_for(ことば[random(0, 2)], 1)')),
    slide('append で追加、len で長さ',
          '記録.append(120) は、リストのいちばん後ろに 120 を追加する（Scratchの「〇を追加する」）。\nlen(記録) は、リストに入っている数（長さ）。x_position() は「いまのx座標」。',
          prog('記録 = []', '記録.append(120)', '記録.append(x_position())', 'say_for(len(記録), 2)')),
], [
    quiz('l12q1', 'ことば[0] は？', 'ことば[0] は、どのことば？',
         [T('やったね'), T('すごい', 'Python は 0 から数えるよ。[0] がいちばん前。'), T('その調子', '[2] がその調子。')], 0, 'Python のリストは 0 から数える。[0] が1番目。',
         code_=prog('ことば = ["やったね", "すごい", "その調子"]', 'say_for(ことば[0], 1)')),
    ex('l12e1', '2番目のことばを言おう', 'ネコ', prog('ことば = ["やったね", "すごい", "その調子"]', 'say_for(ことば[0], 2)'),
       ['リストの2番目のことば（すごい）を2秒言う'],
       ['Python は 0 から数える。', '2番目は [1]。', 'say_for(ことば[1], 2) にする。'],
       [run('「すごい」と言う', 1200, [said('ネコ', 'すごい')], '「すごい」と言わなかったよ。')],
       prog('ことば = ["やったね", "すごい", "その調子"]', 'say_for(ことば[1], 2)')),
    ex('l12e2', 'ほめことばリストを作ろう', 'ネコ', CAT,
       ['スペースキーを押したら、リスト「ことば」に "やったね" "すごい" "その調子" の3つを入れる', 'その中からランダムに1つえらんで、1秒言う'],
       ['@when_key_pressed("スペース") のまとまりを新しく書く。', 'ことば = ["やったね", "すごい", "その調子"] でリストが作れる。', 'say_for(ことば[random(0, 2)], 1) で、ランダムに1つ言える。'],
       [code('ランダムな番号で取り出している', pattern='ことば\\[random\\(0, 2\\)\\]', fail='ことば[random(0, 2)] で、ランダムに取り出そう（0から2）。'),
        run('スペースで、ほめことばを言う', 1800, [{'kind': 'list', 'name': 'ことば', 'length': 3, 'includes': ['やったね', 'すごい', 'その調子']}, said('ネコ', '', texts=['やったね', 'すごい', 'その調子'])], 'スペースキーを押したのに、リストのことばを言わなかったよ。', keys=SPACE)],
       CAT + '\n\n@when_key_pressed("スペース")\ndef script2():\n    ことば = ["やったね", "すごい", "その調子"]\n    say_for(ことば[random(0, 2)], 1)', others={'リンゴ': APPLE_STAY}),
    quiz('l12q2', 'いくつと言う？', 'このコードを動かすと、ネコは何と言う？',
         [T('2'), T('3', 'append は2回だけだよ。'), T('120', 'len は「長さ（入っている数）」だよ。')], 0, 'append するたびに1つずつふえる。len(記録) は 2。',
         code_=prog('記録 = []', '記録.append(120)', '記録.append(-40)', 'say_for(len(記録), 2)')),
    ex('l12e3', '好きなものリストを作ろう', 'ネコ', prog('好きなもの = []', '# "りんご" "ねこ" "サッカー" の3つを、append で追加する', 'say_for(len(好きなもの), 2)'),
       ['リスト「好きなもの」に、"りんご" "ねこ" "サッカー" の3つを append で追加する', '最後にリストの長さ（3）を言う'],
       ['好きなもの.append("りんご") で1つ追加できる。', '3回 append する。', 'say_for の行より上に書く。'],
       [run('長さ3と言う', 1200, [{'kind': 'list', 'name': '好きなもの', 'length': 3, 'includes': ['りんご', 'ねこ', 'サッカー']}, said('ネコ', '3')], '3つ追加して、「3」と言うようにしよう。')],
       prog('好きなもの = []', '好きなもの.append("りんご")', '好きなもの.append("ねこ")', '好きなもの.append("サッカー")', 'say_for(len(好きなもの), 2)')),
    ex('l12e4', '落ちた場所を記録しよう', 'リンゴ', APPLE_RET.replace('    go_to(0, 170)\n', '    記録 = []\n    go_to(0, 170)\n', 1),
       ['リンゴが下に着くたびに、そのときのx座標をリスト「記録」に追加する'],
       ['下に着いたときに動くのは if の中。', 'x座標は x_position() 。', '記録.append(x_position()) を、if の中の go_to より前に書く。'],
       [code('x座標を記録に追加している', line='記録.append(x_position())', indent=3, fail='記録.append(x_position()) を、if の中に書こう。'),
        run('下に着くたびに記録がふえる', 6200, [{'kind': 'list', 'name': '記録', 'minLength': 2}], '下に着いたのに、記録がふえていないよ。')],
       APPLE_RET.replace('    go_to(0, 170)\n', '    記録 = []\n    go_to(0, 170)\n', 1).replace('            go_to(random', '            記録.append(x_position())\n            go_to(random'), others={'ネコ': CAT_STAY}),
])

JUMP_DEF = 'def ジャンプ():\n    change_y(50)\n    wait(0.3)\n    change_y(-50)\n    wait(0.3)\n\n'
JUMP_DEF_H = 'def ジャンプ(高さ):\n    change_y(高さ)\n    wait(0.3)\n    change_y(-高さ)\n    wait(0.3)\n\n'
l13 = lesson('l13', 'レッスン13　自分の命令を作る', [
    slide('いくつかの命令に、名前をつける def',
          'def ジャンプ(): と書くと、その下で字下げした行に「ジャンプ」という名前がつく（Scratchの「ブロックを作る」でできる定義ブロック）。\ndef の行は字下げしないで、はじまりの2行より上に書く。',
          JUMP_DEF + prog('ジャンプ()')),
    slide('作った命令を呼び出す',
          'ジャンプ() と書くと、def の中の行がまとめて動く。何回でも呼び出せる。\n同じ動きを何回も書かなくてよくなり、プログラムが読みやすくなる。',
          JUMP_DEF + prog('ジャンプ()', 'say_for("もう1回", 1)', 'ジャンプ()')),
    slide('( ) の中で「どれだけ」をわたす（引数）',
          'def ジャンプ(高さ): のように ( ) の中に名前を書くと、呼び出すときに値をわたせる（引数）。ジャンプ(80) なら、高さ に 80 が入る。\nScratchの定義ブロックの「引数を追加」と同じ。',
          JUMP_DEF_H + prog('ジャンプ(30)', 'ジャンプ(80)')),
], [
    quiz('l13q1', 'def はどのブロック？', 'def ジャンプ(): は、Scratchのどのブロックと同じ？',
         [T('定義ブロック（ブロックを作る）'), T('旗が押されたとき', 'それは @when_flag_clicked。'), T('ずっと', 'それは while True:。')], 0, 'def は、命令のまとまりに名前をつける（定義ブロック）。'),
    ex('l13e1', 'ジャンプを呼び出そう', 'ネコ', JUMP_DEF + prog('go_to(0, -140)', '# ここで、ジャンプを3回呼び出そう'),
       ['旗が押されたら、ジャンプを3回する（作った命令「ジャンプ」を呼び出す）'],
       ['呼び出すときは ジャンプ() と書く。', '3回くり返す for の中で呼び出してもよい。', 'for i in range(3): の中に ジャンプ()。'],
       [code('ジャンプを呼び出している', pattern='ジャンプ\\(\\)', indent=None, fail='ジャンプ() と書いて呼び出そう。'),
        run('3回ジャンプする', 3000, [varies('ネコ', 'y', 40), still('ネコ', 'y', 2600, 3000)], '3回ジャンプしていないよ。')],
       JUMP_DEF + prog('go_to(0, -140)', 'for i in range(3):', '    ジャンプ()')),
    ex('l13e2', 'ダッシュを作ろう', 'ネコ', 'def ダッシュ():\n    # ここに、右に10ずつ5回動く命令を書こう\n    wait(0.1)\n\n' + prog('go_to(-100, -140)', 'point_in_direction(90)', 'ダッシュ()', 'ダッシュ()'),
       ['「ダッシュ」の中身を書く：10歩動く を5回くり返す', '2回呼び出しているので、100歩動く'],
       ['def の中の行は1段字下げ。', 'for i in range(5): と move(10) を書く。', 'for は1段、move(10) は2段の字下げ。'],
       [run('100歩動く', 2000, [final('ネコ', 'x', '>=', -5), final('ネコ', 'x', '<=', 5)], '2回のダッシュで100歩動いていないよ。')],
       'def ダッシュ():\n    for i in range(5):\n        move(10)\n    wait(0.1)\n\n' + prog('go_to(-100, -140)', 'point_in_direction(90)', 'ダッシュ()', 'ダッシュ()')),
    quiz('l13q2', '高さに入る値は？', 'ジャンプ(80) と呼び出すと、def の中の 高さ はいくつになる？',
         [T('80'), T('50', 'わたした値が入るよ。'), T('高さ', '高さ は箱の名前。中に値が入るよ。')], 0, '呼び出すときに ( ) に書いた値が、引数に入る。',
         code_=JUMP_DEF_H + prog('ジャンプ(80)')),
    ex('l13e3', '高さを変えられるようにしよう', 'ネコ', JUMP_DEF + prog('go_to(0, -140)', 'ジャンプ()'),
       ['ジャンプに引数「高さ」をつけて、ジャンプ(100) で100の高さまでジャンプする'],
       ['def ジャンプ(高さ): にする。', 'change_y(50) を change_y(高さ)、change_y(-50) を change_y(-高さ) にする。', '呼び出しを ジャンプ(100) にする。'],
       [code('引数をわたして呼び出している', line='ジャンプ(100)', indent=1, fail='ジャンプ(100) と呼び出そう。'),
        run('100の高さまでジャンプ', 1500, [{'kind': 'reach', 'sprite': 'ネコ', 'prop': 'y', 'above': -45}], '100の高さまでジャンプしていないよ。')],
       JUMP_DEF_H + prog('go_to(0, -140)', 'ジャンプ(100)')),
])

d3 = lesson('d3', '道場3　クイズゲームを作ろう', [
    slide('リストでクイズを作る',
          '問題と正解をリストに入れておくと、for で順番に出せる。for i in range(3): なら i は 0, 1, 2 と変わるので、問題[i] で i 番目の問題を取り出せる。',
          prog('問題 = ["2 + 3 は？", "4 × 5 は？"]', 'for i in range(2):', '    答え = input(問題[i])')),
], [
    ex('d3e1', '3問クイズを作ろう', 'ネコ', CAT_STAY + '\n    問題 = ["2 + 3 は？", "4 × 5 は？", "10 - 7 は？"]\n    正解 = ["5", "20", "3"]\n    点数 = 0\n    # for を使って3問出す。正解なら点数を1ふやす\n    say_for("点数は" + str(点数) + "点", 2)',
       ['for で3回くり返して、問題を順に質問する', '答えが正解と同じなら、点数を1ふやす', '最後の「点数は〇点」はそのまま'],
       ['問題[i] で i 番目の問題、正解[i] で i 番目の正解。'],
       [code('for で3回くり返している', line='for i in range(0, 3):', indent=1, fail='for i in range(3): を書こう。'),
        run('5・20・4 と答えると 2点', 4600, [said('ネコ', '点数は2点')], '5、20、4 と答えたので「点数は2点」になるはずだよ。', answers_=[{'at': 700, 'text': '5'}, {'at': 1300, 'text': '20'}, {'at': 1900, 'text': '4'}])],
       CAT_STAY + '\n    問題 = ["2 + 3 は？", "4 × 5 は？", "10 - 7 は？"]\n    正解 = ["5", "20", "3"]\n    点数 = 0\n    for i in range(3):\n        答え = input(問題[i])\n        if 答え == 正解[i]:\n            点数 += 1\n    say_for("点数は" + str(点数) + "点", 2)', others={'リンゴ': APPLE_STAY}),
    ex('d3e2', '全問正解をほめよう', 'ネコ', CAT_STAY + '\n    問題 = ["2 + 3 は？", "4 × 5 は？", "10 - 7 は？"]\n    正解 = ["5", "20", "3"]\n    点数 = 0\n    for i in range(3):\n        答え = input(問題[i])\n        if 答え == 正解[i]:\n            点数 += 1\n    # 全問正解なら「全問正解！」、でなければ「点数は〇点」と2秒言う',
       ['点数が3なら「全問正解！」と2秒言う', 'そうでなければ「点数は〇点」と2秒言う'],
       ['if と else と == を使う。'],
       [run('全部正解なら「全問正解！」', 4600, [said('ネコ', '全問正解')], '全部正解したのに「全問正解！」と言わなかったよ。', answers_=[{'at': 700, 'text': '5'}, {'at': 1300, 'text': '20'}, {'at': 1900, 'text': '3'}]),
        run('1問まちがえたら「点数は2点」', 4600, [said('ネコ', '点数は2点'), notSaid('ネコ', '全問正解')], '1問まちがえたときは「点数は2点」と言うようにしよう。', answers_=[{'at': 700, 'text': '5'}, {'at': 1300, 'text': '20'}, {'at': 1900, 'text': '4'}])],
       CAT_STAY + '\n    問題 = ["2 + 3 は？", "4 × 5 は？", "10 - 7 は？"]\n    正解 = ["5", "20", "3"]\n    点数 = 0\n    for i in range(3):\n        答え = input(問題[i])\n        if 答え == 正解[i]:\n            点数 += 1\n    if 点数 == 3:\n        say_for("全問正解！", 2)\n    else:\n        say_for("点数は" + str(点数) + "点", 2)', others={'リンゴ': APPLE_STAY}),
], dojo=True)

GAME_APPLE = prog('ミス = 0', 'go_to(random(-200, 200), 170)', 'while ミス < 3:', '    change_y(-6)', '    if y_position() < -170:', '        ミス += 1', '        go_to(random(-200, 200), 170)', 'say_for("ゲームオーバー", 2)')
d4 = lesson('d4', '卒業道場　キャッチゲームを完成させよう', [
    slide('ゲームの終わりを作る',
          'ゲームには「終わり」が必要。ミスが3より小さいあいだだけくり返せば、3回ミスしたところでくり返しが終わる。\n終わったことをほかのスプライトに知らせるには、メッセージを送る。',
          prog('ミス = 0', 'while ミス < 3:', '    change_y(-6)', 'broadcast("おわり")')),
], [
    ex('d4e1', 'ミス3回でゲームオーバー', 'リンゴ', APPLE_STAY.replace('go_to(0, 170)', 'go_to(random(-200, 200), 170)') + '\n    # ここから書こう',
       ['変数「ミス」を 0 から始める', 'ミスが3より小さいあいだ、6ずつ下に動く', '下に着いたら、ミスを1増やして上（x座標はランダム）にもどる', 'ミスが3になったら「ゲームオーバー」と2秒言う'],
       ['while ミス < 3: でくり返す。'],
       [code('ミスの数でくり返しを止めている', pattern='^while .*ミス.*:$', indent=1, fail='while ミス < 3: のように、ミスを使った条件を書こう。'),
        run('3回落ちたらゲームオーバー', 7500, [var('ミス', '==', 3), said('リンゴ', 'ゲームオーバー'), back], '3回落ちたあとに「ゲームオーバー」と言って止まるようにしよう。')],
       GAME_APPLE.replace('    ミス = 0\n    go_to(random(-200, 200), 170)\n', '    go_to(random(-200, 200), 170)\n    ミス = 0\n'), others={'ネコ': CAT}),
    ex('d4e2', 'ゲームの終わりを知らせよう', 'ネコ', CAT,
       ['リンゴはゲームオーバーになると「おわり」を送る（もう書いてある）', 'ネコは「おわり」を受け取ったら、「またあそぼう！」と2秒言う'],
       ['受け取るまとまりを新しく書く。'],
       [code('「おわり」を受け取るまとまりがある', line='@when_broadcast_received("おわり")', indent=0, fail='「おわり」を受け取るまとまりを書こう。'),
        run('ゲームオーバーで「またあそぼう！」', 7800, [said('ネコ', 'またあそぼう')], 'ゲームオーバーになったのに、ネコが「またあそぼう！」と言わなかったよ。')],
       CAT + '\n\n@when_broadcast_received("おわり")\ndef script2():\n    say_for("またあそぼう！", 2)', others={'リンゴ': GAME_APPLE.replace('    say_for("ゲームオーバー", 2)', '    broadcast("おわり")\n    say_for("ゲームオーバー", 2)')}),
], dojo=True)

# ---------------------------------------------------------------- 「この課題で使うコード」（左の欄）
USES = [
    ('def', 'def ジャンプ():\n    change_y(50)', '命令のまとまりに名前をつける（定義ブロック）'),
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
    ('if', 'if 得点 == 3:\n    say_for("クリア！", 2)', 'もし〜なら。くらべるのは =='),
    ('else', 'else:\n    say_for("ざんねん", 2)', 'でなければ（if と同じ深さ）'),
    ('and', 'if A and B:', 'A かつ B（両方）'),
    ('!=', 'while 答え != "12":', 'ちがうあいだ'),
    ('y_position', 'if y_position() < -170:\n    go_to(0, 170)', 'y座標が -170 より小さいなら'),
    ('random', 'go_to(random(-200, 200), 170)', '-200 から 200 までの乱数'),
    ('input', '名前 = input("名前は？")', '質問して、答えを変数に入れる'),
    ('int', 'a = int(input("数は？"))', '答えを数にする'),
    ('str', 'say_for(str(目) + "が出た！", 1)', '数を文字にして、文字とつなぐ'),
    ('broadcast', 'broadcast("ミス")', 'メッセージを送る'),
    ('[', 'ことば = ["やったね", "すごい"]', 'リストを作る'),
    ('.append', '記録.append(x_position())', 'リストに追加する'),
    ('len', 'say_for(len(記録), 2)', 'len はリストの長さ（入っている数）'),
    ('x_position', 'x = x_position()', 'いまのx座標'),
    ('+=', '得点 += 1', '変数を〇ずつ変える（短い書き方）'),
    ('+=var', '得点 = 得点 + 1', '変数を1ずつ変える'),
    ('=var', '得点 = 0', '変数に入れる（なければ作られる）'),
]


def uses_for(e):
    text = e['starter'][e['sprite']] + '\n' + answers.get(e['id'], '')
    body = '\n'.join(l.split('#')[0] for l in text.split('\n'))
    has = lambda pat: re.search(pat, body, re.M) is not None
    out = []
    for key_, c, n in USES:
        if key_.startswith('@'): ok = key_ in body
        elif key_ == 'def': ok = has(r'^def (?!script)')
        elif key_ == 'while True': ok = 'while True:' in body
        elif key_ == 'while': ok = has(r'while (?!True:)')
        elif key_ == '[': ok = has(r'=\s*\[')
        elif key_ == '.append': ok = '.append(' in body
        elif key_ == 'and': ok = has(r'\band\b')
        elif key_ == '!=': ok = '!=' in body
        elif key_ == '+=': ok = '+=' in body
        elif key_ == '+=var': ok = has(r'(\S+) = \1 [+-]')
        elif key_ == '=var': ok = any(re.match(r'^\s*([^\s=()]+) = (?!\1 )(?!(?:int\()?input)[^=\[]', l) for l in body.split('\n'))
        elif key_ in ('if', 'else', 'for'): ok = has(r'^\s*' + key_ + r'\b') and (key_ != 'if' or has(r'^\s*if (?!key_pressed|touching|y_position)'))
        else: ok = has(r'\b' + re.escape(key_) + r'\(')
        if ok: out.append({'code': c, 'note': n})
    return out[:10]


course = {'version': 4, 'steps': [
    {'title': '章1　命令と順番', 'lessons': [l1, l2, l3, l4, d1]},
    {'title': '章2　キー・条件・変数', 'lessons': [l5, l6, l7, l8, d2]},
    {'title': '章3　質問・メッセージ・リスト', 'lessons': [l9, l10, l11, l12, l13, d3, d4]},
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
