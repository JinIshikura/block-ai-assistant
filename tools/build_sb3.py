# 学習用の土台（.sb3）を作る：python3 tools/build_sb3.py
import hashlib, json, zipfile, os
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'learn')

STAGE = '''<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><rect width="480" height="360" fill="#DCEFFF"/><rect y="320" width="480" height="40" fill="#BFE3B4"/></svg>'''
APPLE = '''<svg xmlns="http://www.w3.org/2000/svg" width="40" height="44" viewBox="0 0 40 44"><path d="M20 10 C 30 4, 40 12, 38 26 C 36 38, 28 44, 20 40 C 12 44, 4 38, 2 26 C 0 12, 10 4, 20 10 Z" fill="#E5484D" stroke="#A3262B" stroke-width="2"/><path d="M20 10 L 21 2" stroke="#6B4A2B" stroke-width="3" stroke-linecap="round"/><path d="M22 6 C 26 0, 34 2, 34 4 C 30 8, 25 8, 22 6 Z" fill="#59C059"/></svg>'''
CAT = '''<svg xmlns="http://www.w3.org/2000/svg" width="80" height="64" viewBox="0 0 80 64"><path d="M14 22 L 18 2 L 32 16 Z" fill="#F29D1A" stroke="#B36A00" stroke-width="2"/><path d="M66 22 L 62 2 L 48 16 Z" fill="#F29D1A" stroke="#B36A00" stroke-width="2"/><ellipse cx="40" cy="38" rx="32" ry="24" fill="#F29D1A" stroke="#B36A00" stroke-width="2"/><circle cx="29" cy="34" r="4" fill="#1F2328"/><circle cx="51" cy="34" r="4" fill="#1F2328"/><path d="M34 46 Q 40 52 46 46" fill="none" stroke="#1F2328" stroke-width="2" stroke-linecap="round"/></svg>'''

def asset(svg):
    data = svg.encode('utf-8')
    md5 = hashlib.md5(data).hexdigest()
    return md5, data

def costume(name, svg, cx, cy):
    md5, data = asset(svg)
    return {'name': name, 'dataFormat': 'svg', 'assetId': md5, 'md5ext': md5 + '.svg', 'rotationCenterX': cx, 'rotationCenterY': cy}, (md5 + '.svg', data)

def sprite(name, cos, layer, x, y):
    return {'isStage': False, 'name': name, 'variables': {}, 'lists': {}, 'broadcasts': {}, 'blocks': {}, 'comments': {},
            'currentCostume': 0, 'costumes': [cos], 'sounds': [], 'volume': 100, 'layerOrder': layer, 'visible': True,
            'x': x, 'y': y, 'size': 100, 'direction': 90, 'draggable': False, 'rotationStyle': 'all around'}

def build(path, sprites):
    files = {}
    st, f = costume('背景', STAGE, 240, 180); files[f[0]] = f[1]
    targets = [{'isStage': True, 'name': 'Stage', 'variables': {}, 'lists': {}, 'broadcasts': {}, 'blocks': {}, 'comments': {},
                'currentCostume': 0, 'costumes': [st], 'sounds': [], 'volume': 100, 'layerOrder': 0, 'tempo': 60,
                'videoTransparency': 50, 'videoState': 'on', 'textToSpeechLanguage': None}]
    for i, (name, svg, cx, cy, x, y) in enumerate(sprites):
        c, f = costume(name, svg, cx, cy); files[f[0]] = f[1]
        targets.append(sprite(name, c, i + 1, x, y))
    project = {'targets': targets, 'monitors': [], 'extensions': [], 'meta': {'semver': '3.0.0', 'vm': '0.2.0', 'agent': 'block-ai-assistant'}}
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_STORED) as z:
        z.writestr('project.json', json.dumps(project, ensure_ascii=False))
        for n, d in files.items():
            z.writestr(n, d)

build(os.path.join(OUT, 'catch.sb3'), [('リンゴ', APPLE, 20, 22, 0, 170), ('ネコ', CAT, 40, 32, 0, -140)])
print('ok')
