"""Extract existing painted map pixels; no redraw, recolor or image generation.

Masks are edited in art/source/resident-extract/masks.json using preview coordinates.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/source/resident-extract'


def export_resident_maps():
    source = ROOT / 'art/source/world-hd/stitched.png'
    image = Image.open(source).convert('RGB')
    config = json.loads((ART / 'masks.json').read_text('utf8'))
    sx, sy = image.width / config['referenceSize'][0], image.height / config['referenceSize'][1]
    def points(values):
        return [(round(x*sx), round(y*sy)) for x, y in values]
    def stroke(draw, values, width):
        p = points(values)
        width = round(width*sx)
        draw.line(p, fill=255, width=width, joint='curve')
        r = width/2
        for x, y in p:
            draw.ellipse((x-r, y-r, x+r, y+r), fill=255)
    for name in ['nature', 'roads']:
        mask = Image.new('L', image.size, 0)
        draw = ImageDraw.Draw(mask)
        if name == 'nature':
            for polygon in config['trees']:
                draw.polygon(points(polygon), fill=255)
            for wall in config['walls']:
                stroke(draw, wall['points'], wall['width'])
            for x, y, rx, ry in config['stones']:
                draw.polygon(points([(x-rx,y),(x-rx*.6,y-ry),(x+rx*.45,y-ry),(x+rx,y),(x+rx*.5,y+ry),(x-rx*.6,y+ry)]), fill=255)
        else:
            for road in config['roads']:
                stroke(draw, road['points'], road['width'])
        for box in config['excludeBuildings'] + (config['excludeNature'] if name == 'nature' else []):
            draw.rectangle(box, fill=0)
        if name == 'roads':
            for x0,y0,x1,y1 in config['excludeRoadPreview']:
                draw.rectangle((round(x0*sx),round(y0*sy),round(x1*sx),round(y1*sy)), fill=0)
        # Only alpha is softened. The original RGB values are never changed.
        mask = mask.filter(ImageFilter.GaussianBlur(1.2))
        # Zero only fully invisible pixels so the browser does not download a
        # hidden copy of the whole world. Visible RGB stays exactly original.
        visible = mask.point(lambda value: 255 if value else 0)
        layer = Image.composite(image, Image.new('RGB', image.size), visible).convert('RGBA')
        layer.putalpha(mask)
        layer.save(ROOT / f'public/assets/garden/resident-{name}-original.webp', lossless=True, exact=True)
        mask.save(ART / f'{name}-mask.png')
        preview = Image.new('RGB', image.size, '#f4e8c8')
        preview.paste(image, mask=mask)
        preview.thumbnail((1440,1080))
        preview.save(ART / f'{name}-preview.jpg', quality=95)
    (ART / 'source.json').write_text(json.dumps({'source':'art/source/world-hd/stitched.png','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'size':list(image.size)},indent=2),'utf8')


if __name__ == '__main__':
    export_resident_maps()
