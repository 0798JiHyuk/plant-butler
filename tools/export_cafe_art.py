"""Export approved café sources; do not regenerate or overwrite garden originals."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / 'art/source/cafe'
target = root / 'public/assets/garden/cafe'
target.mkdir(parents=True, exist_ok=True)
Image.open(source / 'interior.png').convert('RGB').save(target / 'interior.webp', quality=95)
chair = Image.open(source / 'chair.png').convert('RGBA')
alpha = chair.getchannel('A')
# Ignore faint generation residue outside the visible chair, preserving its soft edge.
bounds = alpha.point(lambda a: 255 if a > 64 else 0).getbbox()
chair = chair.crop(bounds)
chair.thumbnail((104, 120), Image.Resampling.LANCZOS)
chair.save(target / 'chair.png')
