"""art/source 의 생성 이미지를 게임이 쓰는 개별 PNG로 자른다. 실행: python3 tools/slice_art.py"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from slice_tree_art import main as export_trees

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art' / 'source'
OUT = ROOT / 'public' / 'assets'
UI_OUT = ROOT / 'src' / 'assets' / 'ui'   # CSS가 상대 경로로 불러와 빌드가 해시·경로를 처리한다


def load(name):
    return Image.open(SRC / f'{name}.webp').convert('RGBA')


def components(im, dilate, min_area=2000):
    a = np.array(im)[:, :, 3] > 40
    lab, _ = ndi.label(ndi.binary_dilation(a, iterations=dilate))
    boxes = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        m = (lab[sl] == i) & a[sl]
        if m.sum() < min_area:
            continue
        ys, xs = np.where(m)
        boxes.append((sl[1].start + xs.min(), sl[0].start + ys.min(), sl[1].start + xs.max() + 1, sl[0].start + ys.max() + 1))
    return boxes


def reading_order(boxes, per_row):
    """위에서 아래, 왼쪽에서 오른쪽 순서. 행 높이가 조금씩 달라도 per_row개씩 끊어 정렬한다."""
    by_y = sorted(boxes, key=lambda b: (b[1] + b[3]) / 2)
    rows = [by_y[i:i + per_row] for i in range(0, len(by_y), per_row)]
    return [b for row in rows for b in sorted(row, key=lambda b: b[0])]


def square(im, box, size, pad=0.04):
    """상자 안의 그림을 투명 정사각형 캔버스 가운데에 넣고 size로 줄인다."""
    c = im.crop(box)
    s = max(c.size)
    canvas = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    canvas.alpha_composite(c, ((s - c.width) // 2, (s - c.height) // 2))
    inner = round(size * (1 - pad * 2))
    small = canvas.resize((inner, inner), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.alpha_composite(small, ((size - inner) // 2, (size - inner) // 2))
    return out


def save_grid(name, ids, per_row, size, folder):
    im = load(name)
    boxes = reading_order(components(im, 10), per_row)
    assert len(boxes) == len(ids), (name, len(boxes), len(ids))
    (OUT / folder).mkdir(parents=True, exist_ok=True)
    for id_, box in zip(ids, boxes):
        square(im, box, size).save(OUT / folder / f'{id_}.png')


# ---- 아이콘 ----
save_grid('icons-ui', ['records', 'decorate', 'settings', 'talk', 'packet', 'leaf', 'back', 'close', 'check', 'clock', 'flag', 'sprout'], 4, 96, 'icons-ui')
save_grid('icons-activity', ['cafe', 'near-home', 'door-out', 'walk5', 'meal', 'shower', 'wash', 'water', 'window', 'music', 'draw', 'book', 'message', 'call', 'water-plant', 'sunlight'], 4, 128, 'activities')

save_grid('plants', ['dandelion', 'violet', 'clover', 'sunflower', 'cosmos', 'lavender', 'hydrangea', 'tulip', 'daisy', 'hibiscus', 'lily-of-valley', 'narcissus'], 4, 96, 'plants')

# ---- UI 프레임 (정사각형이 아니라 잘라낸 그대로, 크기만 줄인다) ----
UI_PIECES = {
    # 이름: (왼, 위, 오른, 아래, 축소 비율)
    'name-sign': (37, 0, 580, 368, 0.5),
    'panel': (605, 18, 1499, 489, 0.5),
    'btn-primary': (47, 366, 363, 486, 0.5),
    'btn-primary-pressed': (53, 493, 348, 588, 0.5),
    'btn-primary-disabled': (53, 597, 348, 686, 0.5),
    'btn-secondary': (376, 422, 595, 518, 0.5),
    'btn-secondary-pressed': (376, 534, 595, 629, 0.5),
    'icon-frame': (659, 510, 834, 684, 0.5),
    'round-frame': (870, 511, 1055, 702, 0.5),
    'toast': (995, 765, 1499, 938, 0.5),
}
kit = load('ui-kit')
UI_OUT.mkdir(parents=True, exist_ok=True)
for name, (x0, y0, x1, y1, k) in UI_PIECES.items():
    c = kit.crop((x0, y0, x1, y1))
    c = c.resize((round(c.width * k), round(c.height * k)), Image.LANCZOS)
    c.save(UI_OUT / f'{name}.png')

# ---- 패널: 덩굴이 가린 두 모서리를 깨끗한 반대쪽 모서리를 뒤집어 복원하고, 덩굴은 따로 떼어 낸다 ----
panel = Image.open(UI_OUT / 'panel.png').convert('RGBA')
W, H = panel.size
C = 44
orig = panel.copy()
OW, OH = orig.size
# 패널 프레임은 조각을 이어 붙이지 않고 직접 그린다(9-slice에 쓰기 좋게 사방 두께가 같다). 색은 원본 프레임에서 뽑았다.
SS, PW, PH, R = 4, 96, 72, 12
def rr(d, box, r, fill):
    d.rounded_rectangle([v * SS for v in box], radius=r * SS, fill=fill)
big = Image.new('RGBA', (PW * SS, PH * SS), (0, 0, 0, 0))
d = ImageDraw.Draw(big)
rr(d, (0, 0, PW - 1, PH - 1), R, (80, 46, 21, 255))                 # 바깥 윤곽
rr(d, (2, 2, PW - 3, PH - 3), R - 2, (219, 153, 81, 255))            # 나무 띠
rr(d, (2, 2, PW - 3, 8), R - 2, (245, 192, 115, 255))                # 윗면 하이라이트
rr(d, (2, 7, PW - 3, PH - 3), R - 2, (219, 153, 81, 255))
d.rounded_rectangle([2 * SS, 2 * SS, (PW - 3) * SS, (PH - 3) * SS], radius=(R - 2) * SS, outline=(245, 192, 115, 255), width=SS)
rr(d, (10, 10, PW - 11, PH - 11), 4, (178, 123, 74, 255))            # 안쪽 윤곽
rr(d, (11, 11, PW - 12, PH - 12), 3, (251, 236, 202, 255))           # 크림 바탕
for cx, cy in ((7, 7), (PW - 8, 7), (7, PH - 8), (PW - 8, PH - 8)):  # 모서리 못
    d.ellipse([(cx - 1.4) * SS, (cy - 1.4) * SS, (cx + 1.4) * SS, (cy + 1.4) * SS], fill=(150, 96, 48, 255))
panel = big.resize((PW, PH), Image.LANCZOS)
W, H = PW, PH
panel.save(UI_OUT / 'panel.png')


def vine(box, name):
    c = orig.crop(box)
    a = np.array(c).astype(int)
    green = (a[:, :, 3] > 40) & (a[:, :, 1] > a[:, :, 0] + 10) & (a[:, :, 1] > a[:, :, 2] + 30)  # 초록·흰 꽃만
    flower = (a[:, :, 3] > 40) & (a[:, :, 0] > 240) & (a[:, :, 1] > 240) & (a[:, :, 2] > 232)
    keep = ndi.binary_fill_holes(ndi.binary_dilation(green | flower, iterations=3))
    a[:, :, 3] = np.where(keep, a[:, :, 3], 0)
    img = Image.fromarray(a.astype('uint8'))
    bb = img.getchannel('A').getbbox()
    img.crop(bb).save(UI_OUT / f'{name}.png')
    print(name, 'offset from corner', (box[0] + bb[0], box[1] + bb[1]), 'size', (bb[2] - bb[0], bb[3] - bb[1]))


vine((0, 0, 150, 110), 'vine-tl')
vine((OW - 100, OH - 100, OW, OH), 'vine-br')
print('done')


# =====================================================================
# 팀 가이드(art/guide, A 테마) 에셋: 배경·캐릭터·소품
# 월드 배율: 배경 1672px → 1266px(0.757). 소품은 가이드 장면 안의 크기에 맞춰 0.333배.
# =====================================================================
GUIDE = ROOT / 'art' / 'guide'
GOUT = OUT / 'garden'
(GOUT / 'props').mkdir(parents=True, exist_ok=True)
(GOUT / 'sprout').mkdir(parents=True, exist_ok=True)

WORLD_W, WORLD_H = 1266, 712
bg = Image.open(GUIDE / 'theme_a_empty.png').convert('RGB').resize((WORLD_W, WORLD_H), Image.LANCZOS)
bg.save(GOUT / 'background.webp', quality=92, method=6)


def defringe(im):
    """반투명 가장자리에 남은 어두운/붉은 번짐을 줄인다: 알파가 낮은 픽셀은 투명으로 만든다."""
    a = np.array(im)
    a[:, :, 3] = np.where(a[:, :, 3] < 24, 0, a[:, :, 3])
    return Image.fromarray(a)


def boxes_of(path, min_area=3000):
    im = Image.open(path).convert('RGBA')
    return im, components(im, 14, min_area)


# ---- 캐릭터 8포즈(위→아래, 왼→오른): idle wave joy rest / point water read write ----
im, boxes = boxes_of(GUIDE / 'character_poses.png')
boxes = reading_order(boxes, 4)
POSES = ['idle', 'wave', 'joy', 'rest', 'point', 'water', 'read', 'write']
IDLE_H = boxes[0][3] - boxes[0][1]
K = 72 / IDLE_H            # 새싹이 키 72px
CANVAS, BOTTOM = 90, 88    # 발 위치: 캔버스 아래에서 2px 위
for name, box in zip(POSES, boxes):
    c = defringe(im.crop((box[0] - 2, box[1] - 2, box[2] + 2, box[3] + 2)))
    a = np.array(c)[:, :, 3] > 40
    cx = np.where(a)[1].mean()                                  # 질량 중심으로 가로 정렬
    small = c.resize((max(1, round(c.width * K)), max(1, round(c.height * K))), Image.LANCZOS)
    out = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    out.alpha_composite(small, (round(CANVAS / 2 - cx * K), BOTTOM - small.height))
    out.save(GOUT / 'sprout' / f'{name}.png')

# ---- 소품 6종 ----
im, boxes = boxes_of(GUIDE / 'theme_a_props.png')
boxes = sorted(boxes, key=lambda b: b[0])
by_name = {}
for b in boxes:
    w, h = b[2] - b[0], b[3] - b[1]
    cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
    by_name[(int(cy // 470), int(cx // 557))] = b      # 3열×2행 시트의 칸
ORDER = {(0, 0): 'bench', (0, 1): 'table', (0, 2): 'birdbath', (1, 0): 'shelf', (1, 1): 'hammock', (1, 2): 'flowerpot'}
PS = 0.333
for key, name in ORDER.items():
    b = by_name[key]
    c = defringe(im.crop((b[0] - 2, b[1] - 2, b[2] + 2, b[3] + 2)))
    c = c.resize((round(c.width * PS), round(c.height * PS)), Image.LANCZOS)
    c.save(GOUT / 'props' / f'{name}.png')
    print(name, c.size)
print('guide assets done')


# ---- 새싹이 점프 4프레임(웅크림·도약·정점·착지)과 뒷모습: 팀 가이드 프롬프트로 만든 시트 ----
def sprout_frame(im, box, k, name):
    c = defringe(im.crop((box[0] - 2, box[1] - 2, box[2] + 2, box[3] + 2)))
    a = np.array(c)[:, :, 3] > 40
    cx = np.where(a)[1].mean()
    small = c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.LANCZOS)
    out = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    out.alpha_composite(small, (round(CANVAS / 2 - cx * k), BOTTOM - small.height))   # 발 끝을 같은 높이에 맞춘다(공중 높이는 게임이 움직임으로 표현)
    out.save(GOUT / 'sprout' / f'{name}.png')


jim = Image.open(ROOT / 'art' / 'source' / 'sprout-jump.webp').convert('RGBA')
jboxes = sorted(components(jim, 10), key=lambda b: b[0])
assert len(jboxes) == 4, len(jboxes)
JK = 57 / ((jboxes[0][2] - jboxes[0][0] + jboxes[3][2] - jboxes[3][0]) / 2)   # 서 있는 두 칸(1·4번)의 평균 너비가 57px: 기존 새싹이(기쁨 포즈 61px)와 크기를 맞춘다
for n, b in zip(['jump1', 'jump2', 'jump3', 'jump4'], jboxes):
    sprout_frame(jim, b, JK, n)

bim = Image.open(ROOT / 'art' / 'source' / 'sprout-back.webp').convert('RGBA')
bb = components(bim, 10)
assert len(bb) == 1
sprout_frame(bim, bb[0], 66 / (bb[0][3] - bb[0][1]), 'back')
print('jump/back done')


# =====================================================================
# 새싹이 2차: 올려 준 새 기준 그림(갈색 윤곽, 올리브 잎)으로 모든 동작을 다시 만든 시트
# 시트마다 그려진 크기가 조금씩 달라서, 잎이 펼쳐진 너비(잎은 어떤 동작에서도 크기가 같다)로 크기를 맞춘다.
# =====================================================================
S2 = GOUT / 'sprout2'
S2.mkdir(parents=True, exist_ok=True)
SRC2 = ROOT / 'art' / 'source'


def leaf_span(c):
    a = np.array(c).astype(int)
    green = (a[:, :, 3] > 40) & (a[:, :, 1] > a[:, :, 0] + 15) & (a[:, :, 1] > a[:, :, 2] + 40)
    xs = np.where(green.any(axis=0))[0]
    return (xs.max() - xs.min() + 1, (xs.max() + xs.min()) / 2) if len(xs) else (1, c.width / 2)


def frames_of(name, n):
    im = Image.open(SRC2 / f'{name}.webp').convert('RGBA')
    bx = sorted(components(im, 10), key=lambda b: b[0])
    assert len(bx) == n, (name, len(bx))
    return [defringe(im.crop((b[0] - 2, b[1] - 2, b[2] + 2, b[3] + 2))) for b in bx]


sheets = {
    'idle': ('sprout2-basic', 4), 'walk_front': ('sprout2-walk-front', 4), 'walk_back': ('sprout2-walk-back', 4),
    'walk_side': ('sprout2-walk-side', 4), 'jump': ('sprout2-jump', 4), 'back': ('sprout2-back', 1),
}
data = {k: frames_of(v[0], v[1]) for k, v in sheets.items()}
# 시트마다 캐릭터를 그린 크기·비율이 달라서(잎이 큰 시트, 몸이 둥근 시트), 서 있는 모습의 키를 72px로 맞춘다.
# 기준 칸: 기본 시트는 첫 칸, 걷기는 두 발을 모은 칸(2·4번), 점프는 웅크림·착지(1·4번, 서 있을 때보다 약 5% 낮음).
def mean_h(frames, idx):
    return sum(frames[i].height for i in idx) / len(idx)


SCALE = {
    'idle': 72 / data['idle'][0].height,
    'walk_front': 72 / mean_h(data['walk_front'], (1, 3)),
    'walk_back': 72 / mean_h(data['walk_back'], (1, 3)),
    'walk_side': 72 / mean_h(data['walk_side'], (1, 3)),
    'jump': 69 / mean_h(data['jump'], (0, 3)),
    'back': 72 / data['back'][0].height,
}


def put(c, name, sheet):
    span, cx = leaf_span(c)
    k = SCALE[sheet]
    small = c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.LANCZOS)
    out = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    # 가로는 잎·머리 가운데에 맞추고(걸을 때 몸이 흔들려도 머리가 같은 자리), 세로는 발 끝을 같은 높이에 맞춘다.
    out.alpha_composite(small, (round(CANVAS / 2 - cx * k), BOTTOM - small.height))
    out.save(S2 / f'{name}.png')


# 걷기·점프 시트가 서로 같은 그림체(굵은 갈색 윤곽, 둥근 잎)라서, 서 있는 모습·기쁨·뒷모습도 거기서 가져온다.
# 기본 시트(손 흔들기·쉬는 모습)와 뒷모습 시트는 윤곽이 가늘고 잎이 길쭉한 다른 그림체라 쉬는 모습만 임시로 쓴다.
put(data['walk_front'][1], 'idle', 'walk_front')
put(data['walk_back'][1], 'back', 'walk_back')
put(data['jump'][2], 'joy', 'jump')
put(data['idle'][3], 'rest', 'idle')
for i in range(4):
    put(data['walk_front'][i], f'walk_front{i + 1}', 'walk_front')
    put(data['walk_back'][i], f'walk_back{i + 1}', 'walk_back')
    put(data['walk_side'][i], f'walk_side{i + 1}', 'walk_side')
    put(data['jump'][i], f'jump{i + 1}', 'jump')
print('sprout2 done')


# ---- 밭(나무 틀 텃밭): 투명 여백을 잘라 내고 게임에서 쓰는 크기의 1.5배로 줄인다(표시는 폭 239px). ----
bed = Image.open(SRC2 / 'field-bed2.webp').convert('RGBA')
bb = bed.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
bed = bed.crop(bb)
bed = bed.resize((359, round(bed.height * 359 / bed.width)), Image.LANCZOS)
bed.save(GOUT / 'field.png')
print('field', bb, bed.size)


# ---- 주민 3종: 앞모습·옆모습·옆 걷기·뒷모습 4칸 시트. 발 끝을 맞추고 시트마다 앞모습 키가 같게 줄인다. ----
NPC_OUT = GOUT / 'npc'
NPC_OUT.mkdir(exist_ok=True)
NPC_CANVAS = 108
NPC_H = 92   # 앞모습 키. 더듬이가 긴 느리도 칸 안에 들어가게 칸보다 조금 작게
NPC_POSES = ['front', 'side', 'walk', 'back']


def biggest(im):
    """시트 칸에서 가장 큰 덩어리만 남긴다(생성 이미지의 옅은 얼룩을 버린다)."""
    a = np.array(im)
    lab, n = ndi.label(ndi.binary_dilation(a[:, :, 3] > 40, iterations=3))
    keep = lab == (1 + int(np.argmax(ndi.sum(np.ones_like(lab), lab, range(1, n + 1)))))
    a[:, :, 3] = np.where(keep, a[:, :, 3], 0)
    out = Image.fromarray(a)
    return out.crop(out.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox())


for npc in ['nuri', 'moru', 'pio']:
    sheet = load(f'npc-{npc}')
    w = sheet.width / 4
    frames = [biggest(sheet.crop((round(w * i), 0, round(w * (i + 1)), sheet.height))) for i in range(4)]
    k = NPC_H / frames[0].height
    for pose, c in zip(NPC_POSES, frames):
        small = c.resize((round(c.width * k), round(c.height * k)), Image.LANCZOS)
        out = Image.new('RGBA', (NPC_CANVAS, NPC_CANVAS), (0, 0, 0, 0))
        out.alpha_composite(small, ((NPC_CANVAS - small.width) // 2, NPC_CANVAS - 4 - small.height))
        out.save(NPC_OUT / f'{npc}_{pose}.png')
print('npc done')


# ---- 정원 아이콘 6개: 정원열매·씨앗·새싹·꽃봉오리·방문 선물함·상점 ----
sheet = load('icons-garden')
cw, ch = sheet.width / 3, sheet.height / 2
for i, name in enumerate(['fruit', 'seed', 'seedling', 'bud', 'gift', 'shop']):
    col, row = i % 3, i // 3
    c = biggest(sheet.crop((round(cw * col), round(ch * row), round(cw * (col + 1)), round(ch * (row + 1)))))
    k = 88 / max(c.size)
    small = c.resize((round(c.width * k), round(c.height * k)), Image.LANCZOS)
    out = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
    out.alpha_composite(small, ((96 - small.width) // 2, (96 - small.height) // 2))
    out.save(OUT / 'icons-ui' / f'{name}.png')
print('garden icons done')

# Orchard sprites use their preserved transparent sources and shared ground baseline.
export_trees()
