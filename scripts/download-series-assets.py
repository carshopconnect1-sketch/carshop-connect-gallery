"""Download only observed official image URLs; preserve source bytes and provenance."""
import concurrent.futures
import hashlib
import json
import urllib.request
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.source/series-reference'
DEST = ROOT / 'public/assets/series'
DEST.mkdir(parents=True, exist_ok=True)
rows = json.loads((SOURCE / 'selected-images.json').read_text(encoding='utf-8'))

def download(row):
    row = dict(row)
    filename = urlparse(row['url']).path.rsplit('/', 1)[1]
    path = DEST / filename
    try:
        if not path.exists():
            path.write_bytes(urllib.request.urlopen(row['url'], timeout=25).read())
        with Image.open(path) as img:
            row.update(width=img.width, height=img.height)
        row.update(local='/assets/series/'+filename, sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    except Exception as exc:
        row['error'] = str(exc)
    return row

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    result = list(pool.map(download, rows))
(ROOT / 'audit/series-assets.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
for r in result:
    print(r['name'], str((r.get('width'),r.get('height'))), r.get('error',''))
