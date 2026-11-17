"""학교·직장 실내 그림 위에 걸을 수 있는 곳을 겹쳐 그린다.

그림을 바꾸면 src/core/places.ts 의 blocked 를 다시 재서 이 도구로 확인한다.
    python3 -I tools/place_overlay.py <출력폴더>
빨강=가구가 막는 곳, 초록 테두리=바닥 범위, 파랑 점=시작 위치, 노랑 점=문, 보라 점=메모 자리.
"""
import re
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / 'src/core/places.ts').read_text(encoding='utf-8')


def block(place: str) -> str:
    start = SOURCE.index(f"  {place}: {{")
    end = SOURCE.index("\n  },", start)
    return SOURCE[start:end]


def numbers(text: str, key: str):
    return [tuple(int(n) for n in m) for m in re.findall(key, text)]


def draw(place: str, out: Path) -> None:
    text = block(place)
    rects = numbers(text, r'\{ x: (\d+), y: (\d+), w: (\d+), h: (\d+) \}')
    floor = re.search(r'floor: \{ left: (\d+), right: (\d+), top: (\d+), bottom: (\d+) \}', text)
    spawn = re.search(r'spawn: \{ x: (\d+), y: (\d+) \}', text)
    door = re.search(r'door: \{ x: (\d+), y: (\d+) \}', text)
    memo = re.search(r'memo: \{ x: (\d+), y: (\d+) \}', text)
    image = Image.open(ROOT / f'art/source/{place}-interior.png').convert('RGBA')
    layer = Image.new('RGBA', image.size, (0, 0, 0, 0))
    painter = ImageDraw.Draw(layer)
    for x, y, w, h in rects:
        painter.rectangle([x, y, x + w, y + h], fill=(220, 40, 40, 90), outline=(220, 40, 40, 255), width=2)
    left, right, top, bottom = (int(n) for n in floor.groups())
    painter.rectangle([left, top, right, bottom], outline=(40, 200, 60, 255), width=3)
    for match, color in ((spawn, (40, 90, 255, 255)), (door, (255, 220, 0, 255)), (memo, (170, 60, 220, 255))):
        x, y = (int(n) for n in match.groups())
        painter.ellipse([x - 9, y - 9, x + 9, y + 9], fill=color)
    Image.alpha_composite(image, layer).convert('RGB').save(out / f'{place}-overlay.png')


if __name__ == '__main__':
    target = Path(sys.argv[1])
    target.mkdir(parents=True, exist_ok=True)
    for name in ('school', 'work'):
        draw(name, target)
    print('saved', target)
