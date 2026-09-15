"""Make deterministic web thumbnails for the featured, source-backed photos only."""
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image, ImageOps
import json

root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/'public/data/catalog.json').read_text(encoding='utf-8'))
source=root/'.source/featured';source.mkdir(parents=True,exist_ok=True)
target=root/'public/assets/gallery';target.mkdir(parents=True,exist_ok=True)
featured=set(catalog['featuredIds']);manifest=[]
for case in catalog['cases']:
    if case['id'] not in featured:continue
    raw=source/(case['id']+'.original')
    if not raw.exists():
        with urlopen(Request(case['image'],headers={'User-Agent':'CONNECT-Gallery-Preview/1.0'}),timeout=40) as response:raw.write_bytes(response.read())
    with Image.open(raw) as im:
        im=ImageOps.exif_transpose(im).convert('RGB')
        for size in [480,960]:
            photo=im.copy();photo.thumbnail((size,size));photo.save(target/f"{case['id']}-{size}.webp",'WEBP',quality=80,method=6)
    manifest.append({'id':case['id'],'sourceUrl':case['image'],'files':[f"/assets/gallery/{case['id']}-{size}.webp" for size in [480,960]]})
(root/'audit/featured-assets.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'cases':len(manifest),'webpBytes':sum(p.stat().st_size for p in target.glob('*.webp'))}))
