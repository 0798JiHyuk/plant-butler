"""Normalize generated seated/reclining poses to game sprite canvases."""
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]

def export_furniture_poses():
    out=ROOT/'public/assets/garden/sprout2'
    out.mkdir(parents=True,exist_ok=True)
    for name in ['sit','lie']:
        with Image.open(ROOT/f'art/source/furniture-poses/{name}.png') as source:
            image=source.convert('RGBA')
            box=image.getchannel('A').point(lambda v:255 if v>24 else 0).getbbox()
            image=image.crop(box)
            if name=='sit':
                scale=72/image.height
                image=image.resize((round(image.width*scale),72),Image.Resampling.LANCZOS)
                canvas=Image.new('RGBA',(90,90));canvas.alpha_composite(image,((90-image.width)//2,88-image.height))
            else:
                scale=min(90/image.width,64/image.height)
                image=image.resize((round(image.width*scale),round(image.height*scale)),Image.Resampling.LANCZOS)
                canvas=Image.new('RGBA',(112,80));canvas.alpha_composite(image,((112-image.width)//2,(80-image.height)//2))
            canvas.save(out/f'{name}.png')

if __name__=='__main__':
    export_furniture_poses()
