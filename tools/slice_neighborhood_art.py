"""Export isolated A-theme buildings from the preserved imagegen source."""
from pathlib import Path
from PIL import Image

def export():
    root = Path(__file__).resolve().parents[1]
    image = Image.open(root / 'art/source/neighborhood-buildings.png').convert('RGBA')
    target = root / 'public/assets/garden'
    for name, left, right in [('moru-shop', 0, image.width // 2), ('cafe-exterior', image.width // 2, image.width)]:
        part = image.crop((left, 0, right, image.height))
        part = part.crop(part.getbbox())
        part.thumbnail((300, 250), Image.Resampling.LANCZOS)
        part.save(target / (name + '.png'))
    for name, size in [('wood-wayfinder', (150, 110)), ('map-board', (108, 110))]:
        part = Image.open(root / 'art/source' / (name + '.png')).convert('RGBA')
        alpha = part.getchannel('A')
        cutoff = 32 if name == 'wood-wayfinder' else 12
        part.putalpha(alpha.point(lambda value: value if value >= cutoff else 0))
        part = part.crop(part.getbbox())
        part.thumbnail(size, Image.Resampling.LANCZOS)
        part.save(target / (name + '.png'))


if __name__ == '__main__':
    export()
