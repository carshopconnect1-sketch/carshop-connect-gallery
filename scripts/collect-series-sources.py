"""Read official product pages linked by the supplied old gallery. No JS execution."""
import concurrent.futures
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.source/series-reference'
URLS = json.loads((OUT / 'product-urls.json').read_text(encoding='utf-8'))

def collect(pair):
    name, url = pair
    filename = url.rstrip('/').rsplit('/', 1)[1] + '.html'
    target = OUT / filename
    try:
        if not target.exists():
            target.write_bytes(urllib.request.urlopen(url, timeout=25).read())
        html = target.read_text(encoding='utf-8')
        images = list(dict.fromkeys(re.findall(r'<img[^>]+src=["\']([^"\']+)', html)))
        images = [x for x in images if '/item_renewal/' in x]
        portraits = [x for x in images if re.search(r'(?<!gallery)02\.(webp|jpg|png)', x)]
        return {'series': name, 'page': url, 'file': filename, 'portraits': portraits, 'images': images}
    except Exception as exc:
        return {'series': name, 'page': url, 'error': str(exc)}

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    rows = list(pool.map(collect, URLS.items()))
(OUT / 'source-images.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
for row in rows:
    print(json.dumps({k: v for k, v in row.items() if k != 'images'}, ensure_ascii=False))
