"""막 심은 모습(흙무더기) 그림을 art/source/planted-mound.png에서 public/assets/plants/planted.png로 내보낸다.

사용: python3 tools/slice_planted_art.py
96x96 RGBA, 바닥 중앙 정렬(식물 그림과 같은 기준). 재색칠·배경 제거는 하지 않는다.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source" / "planted-mound.png"
OUT = ROOT / "public" / "assets" / "plants" / "planted.png"
SIZE, MAX_W, BOTTOM = 96, 88, 92


def export(source: Path, target: Path) -> None:
    im = Image.open(source).convert("RGBA")
    box = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    crop = im.crop(box)
    scale = min(MAX_W / crop.width, 84 / crop.height)
    crop = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.LANCZOS)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(crop, ((SIZE - crop.width) // 2, BOTTOM - crop.height), crop)
    out.save(target)
    print(f"{source.name} -> {target.relative_to(ROOT)} {out.size}")


def main() -> None:
    export(SRC, OUT)
    field = ROOT / 'art/source/field-planted.png'
    if field.exists():
        export(field, OUT.with_name('field-planted.png'))
    marker = ROOT / 'art/source/field-planted-marker.png'
    if marker.exists():
        export(marker, OUT.with_name('field-planted-marker.png'))


if __name__ == "__main__":
    main()
