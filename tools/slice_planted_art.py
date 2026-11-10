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


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    box = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    crop = im.crop(box)
    scale = MAX_W / crop.width
    crop = crop.resize((MAX_W, max(1, round(crop.height * scale))), Image.LANCZOS)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(crop, ((SIZE - crop.width) // 2, BOTTOM - crop.height), crop)
    out.save(OUT)
    print(f"{SRC.name} -> {OUT.relative_to(ROOT)} {out.size}")


if __name__ == "__main__":
    main()
