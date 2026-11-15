"""Export newly generated resident map layers, preserving their alpha and framing."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def export_resident_paintings():
    for name in ['nuri','moru','pio']:
        source = ROOT / f'art/source/resident-painted/{name}.png'
        if source.exists():
            with Image.open(source) as image:
                assert image.mode == 'RGBA', f'{name}: alpha channel required'
                assert image.getchannel('A').getextrema()[0] < 255, f'{name}: opaque background'
                image.save(ROOT / f'public/assets/garden/resident-{name}-painted.webp', quality=95, method=6)


if __name__ == '__main__':
    export_resident_paintings()
