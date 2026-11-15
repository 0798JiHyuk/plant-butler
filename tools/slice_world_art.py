"""Export generated A-theme backgrounds without modifying the source references."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public/assets/garden'

def export_world_art():
    for name, size in [('home-interior', (1266, 712)), ('garden-meadow', (1266, 480)), ('garden-connected', (1266, 1474)), ('garden-world-v2', (1266, 1474)), ('resident-map-base', (1266, 712)), ('garden-world-wide', (4096, 3072))]:
        source = ROOT / 'art/source' / f'{name}.png'
        if source.exists():
            with Image.open(source) as image:
                image.convert('RGB').resize(size, Image.Resampling.LANCZOS).save(OUTPUT / f'{name}.webp', quality=92)
    # Crop BEFORE scaling: each texture keeps original detail without an enlarged,
    # lossy intermediate image. Odd source dimensions use the same shared boundary.
    boundary=ROOT/'art/source/world-boundaries/stitched.png'
    hd = boundary if boundary.exists() else ROOT / 'art/source/world-hd/stitched.png'
    source = hd if hd.exists() else ROOT / 'art/source/garden-world-wide.png'
    if source.exists():
        with Image.open(source) as image:
            image = image.convert('RGB')
            width, height = image.size
            mx, my = width // 2, height // 2
            boxes = {'nw': (0, 0, mx, my), 'ne': (mx, 0, width, my),
                     'sw': (0, my, mx, height), 'se': (mx, my, width, height)}
            for name, box in boxes.items():
                prefix = 'world-boundaries' if source == boundary else 'world-hd' if source == hd else 'world'
                image.crop(box).save(OUTPUT / f'{prefix}-{name}.webp', lossless=True)
    if hd.exists():
        from export_resident_paintings import export_resident_paintings
        export_resident_paintings()
    if (ROOT/'art/source/furniture-poses/sit.png').exists():
        from export_furniture_poses import export_furniture_poses
        export_furniture_poses()

if __name__ == '__main__':
    export_world_art()
