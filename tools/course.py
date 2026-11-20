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

# ================================================================ ステップ1　読む
k1 = {'id': 'k1', 'title': '第1回　1つのブロックは、コードの1行', 'slides': [
    slide('ブロックは、コードでも書ける',
          'Scratchで作るプログラムは、文字（コード）でも書ける。この教室では Python（パイソン）という言葉で書く。\n左のブロックと右のコードは、同じ行どうしが同じ命令。「10歩動かす」は move(10) になる。',
          prog('move(10)')),
    slide('はじまりの2行',
          '「旗が押されたとき」は、コードでは2行でセットになる（@when_flag_clicked と def script1():）。\nそのまとまりの中に入る命令は、行の頭にスペースを4つ入れて、右に下げて書く（Tabキーでも下げられる）。',
          prog('say_for("こんにちは！", 2)')),
    slide('入れる値は ( ) の中',
          'ブロックの白いまる（入れる値）は、コードの ( ) の中に書く。値が2つあるときは , で区切る。\n文字は " " でかこむ（"こんにちは！"）。数はそのまま書く（2、-140）。',
          prog('go_to(0, -140)', 'say_for("こんにちは！", 2)')),
    slide('この回で使う命令',
          'go_to は「x座標を〇、y座標を〇にする」。最初の場所にもどすときに使う。\nwait は「〇秒待つ」。',
          prog('go_to(0, -140)', 'move(10)', 'say_for("やあ", 1)', 'wait(1)')),
], 'exercises': [
    ex('k1e1', 'ネコを100歩動かそう', 'ネコ', prog('go_to(0, -140)', 'move(10)'),
       ['ネコが100歩動くようにする'],
       ['「10歩動かす」は move(10)。', '( ) の中の数が歩数。', 'move(10) を move(100) にする。'],
       [code('100歩動かしている', line='move(100)', indent=1, fail='move の ( ) の中を 100 にしよう。'),
        run('ネコが右へ100歩動く', 1200, [final('ネコ', 'x', '>=', 95)], 'ネコが100歩動いていないよ。')],
       prog('go_to(0, -140)', 'move(100)')),
    ex('k1e2', '言うことを変えよう', 'ネコ', prog('go_to(0, -140)', 'say_for("こんにちは！", 2)'),
       ['「よろしくね」と3秒言うようにする'],
       ['say_for の1つめの値が言うこと、2つめが秒数。', '文字は " " でかこんだまま書きかえる。', 'say_for("よろしくね", 3) にする。'],
       [code('「よろしくね」と3秒言う', line='say_for("よろしくね", 3)', indent=1, fail='say_for("よろしくね", 3) にしよう。" " と , を消さないでね。'),
        run('「よろしくね」と言う', 1200, [said('ネコ', 'よろしくね')], '「よろしくね」と言わなかったよ。')],
       prog('go_to(0, -140)', 'say_for("よろしくね", 3)')),
    ex('k1e3', '「1秒待つ」を書きくわえよう', 'ネコ', prog('go_to(0, -140)', 'move(50)', '# この行に、1秒待つ命令を書こう', 'move(50)'),
       ['50歩動いて、1秒待ってから、もう一度50歩動く'],
       ['「〇秒待つ」は wait(〇)。', '# の行は、命令の説明（メモ）。そこを書きかえてよい。', '2つの move(50) のあいだに wait(1) を書く。'],
       [code('動く→待つ→動くの順', order=['move(50)', 'wait(1)', 'move(50)'], fail='move(50) と move(50) のあいだに wait(1) を書こう。'),
        run('とちゅうで1秒止まる', 2200, [still('ネコ', 'x', 300, 900), final('ネコ', 'x', '>=', 95)], '50歩動いたところで1秒止まっていないよ。')],
       prog('go_to(0, -140)', 'move(50)', 'wait(1)', 'move(50)')),
]}

k2 = {'id': 'k2', 'title': '第2回　上から順番に動く', 'slides': [
    slide('上から1行ずつ動く',
          'プログラムは、上の行から順番に1行ずつ動く。ブロックを上からつなげたのと同じ。',
          prog('go_to(0, -140)', 'say_for("いくよ", 1)', 'move(100)', 'say_for("ついた！", 1)')),
    slide('順番を変えると、動きが変わる',
          '同じ命令でも、順番がちがうとちがう動きになる。下のコードは、「いくよ」と言う前に動いてしまう。',
          prog('go_to(0, -140)', 'move(100)', 'say_for("いくよ", 1)')),
    slide('向きを変える命令',
          'point_in_direction(90) は「90度に向ける」（右向き）。\nturn_right(90) は「右に90度回す」、turn_left(90) は「左に90度回す」。',
          prog('point_in_direction(90)', 'turn_right(90)', 'wait(1)', 'turn_left(90)')),
], 'exercises': [
    ex('k2e1', '順番を直そう', 'ネコ', prog('go_to(0, -140)', 'move(100)', 'say_for("いくよ", 1)'),
       ['「いくよ」と1秒言ってから、100歩動く'],
       ['いまは、動いてから「いくよ」と言っている。', '2つの行の順番を入れかえる。', 'say_for("いくよ", 1) を move(100) の上の行にする。'],
       [code('言ってから動く順番', order=['say_for("いくよ", 1)', 'move(100)'], fail='say_for の行を move の行より上にしよう。'),
        run('言っているあいだは動かない', 2200, [still('ネコ', 'x', 200, 800), final('ネコ', 'x', '>=', 95)], '「いくよ」と言っているあいだに動いているよ。')],
       prog('go_to(0, -140)', 'say_for("いくよ", 1)', 'move(100)')),
    ex('k2e2', '行って、もどってこよう', 'ネコ', prog('go_to(0, -140)', 'move(100)', '# ここに、1秒待ってから -100歩動く行を書こう'),
       ['100歩動いて、1秒待ってから、-100歩動いてもとの場所にもどる'],
       ['-100歩動くと、反対向きに100歩もどる。', 'wait(1) のあとに move(-100) を書く。', 'move(100) の下に、wait(1) と move(-100) を1行ずつ。'],
       [code('-100歩もどっている', line='move(-100)', indent=1, fail='move(-100) を書こう。'),
        run('行ってもどる', 2200, [varies('ネコ', 'x', 90), still('ネコ', 'x', 200, 800), final('ネコ', 'x', '<', 5), final('ネコ', 'x', '>', -5)], '100歩動いて、1秒止まって、もとの場所にもどるようにしよう。')],
       prog('go_to(0, -140)', 'move(100)', 'wait(1)', 'move(-100)')),
    ex('k2e3', 'くるっと回ろう', 'ネコ', prog('point_in_direction(90)', '# ここに、右に90度回る→1秒待つ→左に90度回る を書こう'),
       ['右に90度回って、1秒待って、左に90度回ってもとの向きにもどる'],
       ['右に回すのは turn_right、左に回すのは turn_left。', '( ) の中は回る角度。', 'turn_right(90)、wait(1)、turn_left(90) の3行。'],
       [code('右に90度回る', line='turn_right(90)', indent=1, fail='turn_right(90) を書こう。'),
        code('左に90度回る', line='turn_left(90)', indent=1, fail='turn_left(90) を書こう。'),
        run('回って、もとの向きにもどる', 2200, [varies('ネコ', 'dir', 80), final('ネコ', 'dir', '>', 85), final('ネコ', 'dir', '<', 95)], '右に回って、1秒後にもとの向き（90度）にもどるようにしよう。')],
       prog('point_in_direction(90)', 'turn_right(90)', 'wait(1)', 'turn_left(90)')),
]}

k3 = {'id': 'k3', 'title': '第3回　くり返しと字下げ', 'slides': [
    slide('「ずっと」は while True:',
          '「ずっと」は while True: と書く。最後の : （コロン）をわすれずに。',
          prog('point_in_direction(90)', 'while True:', '    turn_right(15)', '    wait(0.1)')),
    slide('字下げ＝くり返しの中',
          'while True: の次の行から、もう1段（スペース4つ）下げた行が、くり返しの中に入る。Scratchで「ずっと」の口の中にブロックを入れるのと同じ。\n字下げをもどした行は、くり返しの外になる。',
          prog('while True:', '    turn_right(15)', '    wait(0.1)')),
    slide('「〇回繰り返す」は for',
          '「3回繰り返す」は for i in range(3): と書く。range(3) の 3 が回数。\ni は「いま何回目か」が入る変数（いまは気にしなくてよい）。',
          prog('go_to(-150, -140)', 'for i in range(3):', '    move(50)', '    wait(0.5)')),
], 'exercises': [
    ex('k3e1', 'ずっと回そう', 'ネコ', prog('point_in_direction(90)', 'turn_right(15)', 'wait(0.1)'),
       ['turn_right と wait を「ずっと」の中に入れて、ずっと回るようにする'],
       ['「ずっと」は while True:。', 'point_in_direction の次の行に while True: を書く。', 'turn_right と wait の行の頭に、スペースを4つ足して1段下げる。'],
       [code('「ずっと」を使っている', line='while True:', indent=1, fail='while True: を書こう。'),
        code('回る命令がくり返しの中にある', line='turn_right(15)', indent=2, fail='turn_right(15) を1段下げて、くり返しの中に入れよう。'),
        run('ずっと回り続ける', 2500, [varies('ネコ', 'dir', 30, 1000)], 'ネコがずっと回っていないよ。')],
       prog('point_in_direction(90)', 'while True:', '    turn_right(15)', '    wait(0.1)')),
    ex('k3e2', '3回くり返しで短くしよう', 'ネコ', prog('go_to(-150, -140)', 'move(50)', 'wait(0.5)', 'move(50)', 'wait(0.5)', 'move(50)', 'wait(0.5)'),
       ['for を使って、move(50) と wait(0.5) を1回ずつだけ書く', '動きは同じ（50歩ずつ3回）'],
       ['同じ2行が3回ある。', 'for i in range(3): の中に move(50) と wait(0.5) を入れる。', '残りの4行は消す。'],
       [code('3回のくり返しを使っている', line='for i in range(0, 3):', indent=1, fail='for i in range(3): を書こう。'),
        code('move(50) は1回だけ', line='move(50)', count=1, indent=2, fail='move(50) は、くり返しの中に1回だけ書こう。'),
        run('50歩ずつ3回動く', 2500, [final('ネコ', 'x', '>', -5), final('ネコ', 'x', '<', 5)], '150歩動いていないよ。')],
       prog('go_to(-150, -140)', 'for i in range(3):', '    move(50)', '    wait(0.5)')),
    ex('k3e3', 'くり返しの中に入れよう', 'ネコ', prog('go_to(0, 0)', 'point_in_direction(90)', 'for i in range(4):', '    move(50)', 'turn_right(90)', 'wait(0.5)'),
       ['「50歩動く→右に90度回る→0.5秒待つ」を4回くり返して、四角を書くように動く', 'もとの場所・もとの向きにもどってくる'],
       ['いまは move(50) だけがくり返しの中。', 'turn_right と wait も1段下げる。', 'turn_right(90) と wait(0.5) の行の頭にスペースを4つ足す。'],
       [code('回る命令がくり返しの中にある', line='turn_right(90)', indent=2, fail='turn_right(90) を1段下げよう。'),
        run('四角に動いて、もどってくる', 3000, [varies('ネコ', 'y', 40), final('ネコ', 'x', '<', 5), final('ネコ', 'x', '>', -5), final('ネコ', 'dir', '>', 85), final('ネコ', 'dir', '<', 95)], 'もとの場所・もとの向きにもどってこないよ。')],
       prog('go_to(0, 0)', 'point_in_direction(90)', 'for i in range(4):', '    move(50)', '    turn_right(90)', '    wait(0.5)')),
]}

CAT_RL = prog('go_to(0, -140)', 'while True:', '    if key_pressed("右向き矢印"):', '        change_x(10)')
CAT_LR = prog('go_to(0, -140)', 'while True:', '    if key_pressed("右向き矢印"):', '        change_x(10)', '    if key_pressed("左向き矢印"):', '        change_x(-10)')
k4 = {'id': 'k4', 'title': '第4回　もし〜なら', 'slides': [
    slide('「もし〜なら」は if',
          '「もし〈 〉なら」は if 条件: と書く。条件が正しいときだけ、1段下げた行が動く。\nキーで動かすときは、「ずっと」の中に「もし」を入れる。',
          CAT_RL),
    slide('キーとx座標',
          'key_pressed("右向き矢印") は「右向き矢印キーが押された」。キーの名前は "右向き矢印" "左向き矢印" "上向き矢印" "下向き矢印" "スペース" など。\nchange_x(10) は「x座標を10ずつ変える」（右へ）。左は change_x(-10)。',
          prog('while True:', '    if key_pressed("スペース"):', '        say_for("ニャー", 1)', '    if key_pressed("左向き矢印"):', '        change_x(-10)', hat=FLAG)),
    slide('上下と「触れた」',
          'change_y(-5) は「y座標を-5ずつ変える」（下へ）。上へは ＋。\ntouching("ネコ") は「ネコに触れた」。リンゴがネコに触れたら、上にもどす例。',
          prog('go_to(0, 170)', 'while True:', '    change_y(-5)', '    if touching("ネコ"):', '        go_to(0, 170)')),
], 'exercises': [
    ex('k4e1', '左にも動かそう', 'ネコ', CAT_RL,
       ['左向き矢印キーを押すと、ネコが左に動く'],
       ['右のときと同じ形の if を、もう1つ書く。', 'if key_pressed("左向き矢印"): を、右の if と同じ深さに。', 'その中に change_x(-10) を1段下げて書く。'],
       [code('左向き矢印キーで分けている', line='if key_pressed("左向き矢印"):', indent=2, fail='if key_pressed("左向き矢印"): を、右の if と同じ深さに書こう。'),
        run('左キーで左に動く', 1600, [{'kind': 'decrease', 'sprite': 'ネコ', 'prop': 'x', 'min': 30}], '左向き矢印キーを押しても、左に動かないよ。', keys=[{'key': '左向き矢印', 'at': 300, 'hold': 600}])],
       CAT_LR),
    ex('k4e2', 'スペースで鳴こう', 'ネコ', CAT_RL,
       ['スペースキーを押すと、「ニャー」と1秒言う'],
       ['if key_pressed("スペース"): を、右の if と同じ深さに書く。', 'その中に say_for("ニャー", 1)。', '字下げは、if が2段、say_for が3段。'],
       [code('スペースキーで分けている', line='if key_pressed("スペース"):', indent=2, fail='if key_pressed("スペース"): を書こう。'),
        run('スペースで「ニャー」', 1600, [said('ネコ', 'ニャー')], 'スペースキーを押しても「ニャー」と言わないよ。', keys=SPACE)],
       prog('go_to(0, -140)', 'while True:', '    if key_pressed("右向き矢印"):', '        change_x(10)', '    if key_pressed("スペース"):', '        say_for("ニャー", 1)')),
    ex('k4e3', 'キャッチしたら上にもどそう', 'リンゴ', prog('go_to(0, 170)', 'while True:', '    change_y(-5)'),
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
k5 = {'id': 'k5', 'title': '第5回　変数', 'slides': [
    slide('変数は、名前のついた箱',
          '得点 = 0 は「得点を0にする」。= は「右の値を、左の変数に入れる」という意味。\n変数がまだなければ、自動で作られてステージに表示される。',
          prog('得点 = 0')),
    slide('1ずつ変える',
          '得点 = 得点 + 1 は「得点を1ずつ変える」。右の 得点 + 1 を計算して、左の 得点 に入れなおす。',
          prog('得点 = 0', 'while True:', '    if key_pressed("スペース"):', '        得点 = 得点 + 1', '        wait(0.3)')),
    slide('変数の値を言わせる',
          'say_for の言うことに、変数を書くこともできる（" " ではかこまない）。',
          prog('得点 = 0', '得点 = 得点 + 1', 'say_for(得点, 1)')),
], 'exercises': [
    ex('k5e1', 'スペースで得点をふやそう', 'ネコ', SCORE,
       ['スペースキーを押すたびに、得点が1ふえる'],
       ['「得点を1ずつ変える」は 得点 = 得点 + 1。', 'if の中（wait と同じ深さ）に書く。', 'wait(0.3) の上の行に 得点 = 得点 + 1。'],
       [code('得点を1ずつ変えている', line='得点 = 得点 + 1', indent=3, fail='得点 = 得点 + 1 を、if の中に書こう。'),
        run('スペースを1回押すと1点', 1500, [var('得点', '==', 1)], 'スペースキーを1回押したのに、得点が1にならないよ。', keys=SPACE)],
       SCORE1),
    ex('k5e2', '2点ずつふやそう', 'ネコ', SCORE1,
       ['スペースキーを押すたびに、得点が2ふえる'],
       ['ふえる数は + のうしろの数。', '+ 1 を + 2 にする。', '得点 = 得点 + 2。'],
       [code('得点を2ずつ変えている', line='得点 = 得点 + 2', indent=3, fail='得点 = 得点 + 2 にしよう。'),
        run('スペースを1回押すと2点', 1500, [var('得点', '==', 2)], 'スペースキーを1回押したのに、得点が2にならないよ。', keys=SPACE)],
       score('得点 = 得点 + 2')),
    ex('k5e3', '得点を言おう', 'ネコ', SCORE1,
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
m1 = {'id': 'm1', 'title': 'ステップ1　まとめテスト', 'slides': [
    slide('ランダムな数 random',
          'random(-200, 200) は「-200 から 200 までの乱数」。毎回ちがう数になる。\ngo_to(random(-200, 200), 170) なら、上のどこかランダムな場所へ行く。',
          prog('go_to(random(-200, 200), 170)')),
    slide('比べる < と >',
          'y_position() は「いまのy座標」。\ny_position() < -170 は「y座標が -170 より小さい」（下に行きすぎた）。> は「より大きい」。口が開いている方が大きい。',
          prog('if y_position() < -170:', '    go_to(0, 170)', 'if y_position() > 170:', '    say_for("上に行きすぎ", 1)')),
    slide('キャッチゲームを読もう',
          'ここまでの命令でできたリンゴのプログラム。1行ずつ、ブロックと見比べて読んでみよう。',
          APPLE),
], 'exercises': [
    ex('m1e1', 'リンゴを速くしよう', 'リンゴ', APPLE,
       ['リンゴの落ちる速さを2倍にする', 'ほかの動きは変えない'],
       ['落ちる速さを決めているのは change_y の数。'],
       [code('1回に動く量を2倍にしている', line='change_y(-10)', indent=2, fail='change_y の数を見直そう。いまの2倍になっているかな？'),
        run('速く落ちて、上にもどる', 5000, [{'kind': 'returnAfter', 'sprite': 'リンゴ', 'prop': 'y', 'below': -60, 'above': 120}], 'リンゴが下まで落ちて上にもどっていないよ。')],
       apple('change_y(-10)')),
    ex('m1e2', 'ミスを数えよう', 'リンゴ', APPLE,
       ['変数「ミス」を使う', '旗が押されたら、ミスを0にする', 'リンゴが下まで落ちるたびに、ミスを1ふやす'],
       ['得点と同じ書き方で、ミスの変数を作る。'],
       [code('ミスを0にしている', line='ミス = 0', indent=1, fail='得点 = 0 の近くに ミス = 0 を書こう。'),
        code('ミスを1ずつふやしている', line='ミス = ミス + 1', indent=3, fail='下に落ちたとき（y座標が -170 より下の if の中）に ミス = ミス + 1。'),
        run('落ちるとミスがふえる', 4500, [var('ミス', '>=', 1)], 'リンゴが下に落ちたのに、ミスがふえていないよ。')],
       apple(miss=True)),
]}

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

course = {'version': 2, 'steps': [
    {'title': 'ステップ1　読む', 'lessons': [k1, k2, k3, k4, k5, m1]},
    {'title': 'ステップ2　直す', 'lessons': [k6, k7, k8, m2]},
    {'title': 'ステップ3　書く', 'lessons': step3},
]}
json.dump(course, open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(answers, open(A, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
n = sum(len(l['exercises']) for st_ in course['steps'] for l in st_['lessons'])
print('ok', n, 'exercises,', len(answers), 'answers')
