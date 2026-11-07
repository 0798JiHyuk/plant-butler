"""Export the four orchard sprites from preserved transparent source PNGs.

Usage: python tools/slice_tree_art.py
No generation, recoloring, or background removal is performed here.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "art" / "source" / "trees"
OUTPUT = ROOT / "public" / "assets" / "plants"
NAMES = ("tree_young", "tree_grown", "apple_tree", "peach_tree")
SIZE = 192
CONTENT = 176
BASELINE = 188


def main():
    sprites = []
    report = {}
    # Validate all inputs before replacing any game asset.
    for name in NAMES:
        path = SOURCE / f"{name}.png"
        with Image.open(path) as raw:
            if raw.mode != "RGBA":
                raise ValueError(f"Expected true RGBA source: {name}")
            image = raw.copy()
        alpha = image.getchannel("A")
        if alpha.getextrema()[0] != 0:
            raise ValueError(f"Missing transparency: {name}")
        # Generated alpha may contain near-invisible specks outside the sprite.
        # Use a visible-alpha crop box without changing the retained alpha pixels.
        box = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
        if not box:
            raise ValueError(f"Empty sprite: {name}")
        crop = image.crop(box)
        scale = min(CONTENT / crop.width, CONTENT / crop.height)
        dimensions = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
        resized = crop.resize(dimensions, Image.Resampling.LANCZOS)
        sprite = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        sprite.alpha_composite(resized, ((SIZE - resized.width) // 2, BASELINE - resized.height))
        sprites.append((name, sprite))
        report[name] = {
            "source": str(path.relative_to(ROOT)).replace("\\", "/"),
            "source_size": list(image.size),
            "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "source_crop_bbox": list(box),
            "crop_alpha_threshold": 8,
            "output_size": [SIZE, SIZE],
            "output_alpha_bbox": list(sprite.getchannel("A").getbbox()),
            "ground_baseline": BASELINE,
        }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, sprite in sprites:
        sprite.save(OUTPUT / f"{name}.png")
    (SOURCE / "export-manifest.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("Exported 4 RGBA orchard sprites: 192x192, shared baseline 188.")


if __name__ == "__main__":
    main()
