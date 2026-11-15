"""Join four independently repainted, overlapping world regions.

Run after saving the imagegen outputs as art/source/world-hd/{nw,ne,sw,se}.png.
Requires Pillow and numpy (art tooling only). Originals are never overwritten.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art/source/world-hd'


def cut_path(a, b):
    """Minimum-error seam through an overlap, top to bottom."""
    # Blur tiny texture differences, retaining building and path silhouettes.
    aa = np.asarray(Image.fromarray(a).filter(ImageFilter.GaussianBlur(2)), dtype=np.float32)
    bb = np.asarray(Image.fromarray(b).filter(ImageFilter.GaussianBlur(2)), dtype=np.float32)
    cost = np.mean((aa - bb) ** 2, axis=2)
    h, w = cost.shape
    # Prefer the middle unless a mismatching object warrants a detour.
    cost += ((np.arange(w) - w / 2) / w) ** 2 * 120
    parent = np.zeros((h, w), dtype=np.int8)
    prev = cost[0].copy()
    for y in range(1, h):
        choices = np.stack([np.r_[np.inf, prev[:-1]], prev, np.r_[prev[1:], np.inf]])
        step = choices.argmin(axis=0)
        parent[y] = step - 1
        prev = cost[y] + choices[step, np.arange(w)]
    path = np.empty(h, dtype=np.int32)
    path[-1] = prev.argmin()
    for y in range(h - 1, 0, -1):
        path[y - 1] = path[y] + parent[y, path[y]]
    return path


def join(a, b, overlap):
    """Keep sharp detail either side of a narrow feathered content-aware seam."""
    left, right = a[:, -overlap:], b[:, :overlap]
    path = cut_path(left, right)
    weight = np.clip((np.arange(overlap)[None, :] - path[:, None] + 12) / 24, 0, 1)
    weight = weight * weight * (3 - 2 * weight)
    blend = np.rint(left * (1 - weight[..., None]) + right * weight[..., None]).astype(np.uint8)
    return np.concatenate([a[:, :-overlap], blend, b[:, overlap:]], axis=1)


def main(boundaries=False):
    output=ROOT/'art/source/world-boundaries' if boundaries else SOURCE
    layout = json.loads((SOURCE / 'layout.json').read_text('utf8'))
    guide = Image.open(ROOT / 'art/source/garden-world-wide.png').convert('RGB').resize(tuple(layout['world']), Image.Resampling.LANCZOS)
    regions = {}
    report = {}
    for name, box in layout['boxes'].items():
        target_source=output/f'{name}.png' if boundaries and name in ['sw','se'] else SOURCE/f'{name}.png'
        with Image.open(target_source) as raw:
            report[name] = {'native': list(raw.size), 'world_box': box}
            target = (box[2] - box[0], box[3] - box[1])
            image = raw.convert('RGB').resize(target, Image.Resampling.LANCZOS)
        # Match only broad color/lighting; retain newly drawn texture and edges.
        old_low = np.asarray(guide.crop(tuple(box)).filter(ImageFilter.GaussianBlur(90)), dtype=np.float32)
        new_low = np.asarray(image.filter(ImageFilter.GaussianBlur(90)), dtype=np.float32)
        correction = np.clip(old_low - new_low, -24, 24) * .55
        regions[name] = np.clip(np.asarray(image, dtype=np.float32) + correction, 0, 255).astype(np.uint8)
    overlap = layout['overlap'] * 2
    north = join(regions['nw'], regions['ne'], overlap)
    south = join(regions['sw'], regions['se'], overlap)
    # Transpose so the same algorithm finds a horizontal seam through both rows.
    joined = join(north.transpose(1, 0, 2), south.transpose(1, 0, 2), overlap).transpose(1, 0, 2)
    assert list(joined.shape[:2][::-1]) == layout['world']
    Image.fromarray(joined).save(output / 'stitched.png')
    (output / 'report.json').write_text(json.dumps(report, indent=2), 'utf8')
    preview = Image.fromarray(joined)
    preview.thumbnail((1440, 1080))
    preview.save(output / 'preview.jpg', quality=94)
    print('Stitched four repaints:', {name: data['native'] for name, data in report.items()})


if __name__ == '__main__':
    import sys
    main('--boundaries' in sys.argv)
