"""Export already approved images for delivery; no retouching or original overwrites."""
from pathlib import Path
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor
import json, hashlib, shutil
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / '.preview/photo-appearance-20261006'
STATE = ROOT / '.preview/photo-replacement-20261009'
PUBLIC = ROOT / 'public'

def load(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def js(p): return json.loads(p.read_text(encoding='utf-8').split('=', 1)[1].strip().rstrip(';'))
def normal(url):
    u = urlparse(url)
    return u.path if u.hostname in ('localhost', '127.0.0.1') else url
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()

rows = js(AUDIT / 'corrections-data.js')['rows']
originals = {x['key']: x for x in load(AUDIT / 'manifest.json')['images']}
local = load(STATE / 'local-catalog.json')
details = load(STATE / 'local-details.json')
base = load(PUBLIC / 'data/catalog.json')
assert len(rows) == 1458 == len({r['key'] for r in rows})
refs = []
for row in rows:
    original = originals[row['key']]
    for ref in original['refs']:
        images = details[ref['id']]['images']
        assert normal(images[ref['photo'] - 1]) == normal(original['url']), ('Photo changed', row['key'], ref)
        refs.append((row, ref, original['url']))

target = PUBLIC / 'assets/gallery/corrected-20261009-lite'
target.mkdir(parents=True, exist_ok=True)
def export(row):
    source = AUDIT / row['edited']
    sha = digest(source)
    stem = f"{row['key']}-{sha[:12]}-1280q84"
    full, thumb = target / (stem + '.webp'), target / (stem + '-480.webp')
    with Image.open(source) as im:
        im.load()
        im = ImageOps.exif_transpose(im).convert('RGB')
        im.thumbnail((1280, 1280))
        if not full.exists(): im.save(full, 'WEBP', quality=84, method=4)
        small = im.copy(); small.thumbnail((480, 480))
        if not thumb.exists(): small.save(thumb, 'WEBP', quality=80, method=4)
        size = list(im.size)
    for file in (full, thumb):
        with Image.open(file) as check: check.load()
    return {'key':row['key'], 'url':'/assets/gallery/corrected-20261009-lite/' + full.name,
            'thumbnail':'/assets/gallery/corrected-20261009-lite/' + thumb.name,
            'previewImage':'/assets/gallery/corrected-20261009-lite/' + full.name,
            'privacy':row.get('sourcePrivacyRedacted', False), 'size':size,
            'approvedSha256':sha, 'sha256':digest(full), 'thumbnailSha256':digest(thumb)}

with ThreadPoolExecutor(max_workers=8) as pool:
    exports = {x['key']:x for x in pool.map(export, rows)}
mapping = {}
for row, ref, source in refs:
    entry = {k:v for k,v in exports[row['key']].items() if k not in ('size','approvedSha256','sha256','thumbnailSha256')}
    entry['source'] = normal(source)
    mapping.setdefault(ref['id'], []).append(entry)

base_ids = {x['id'] for x in base['cases']}
new_cases = [dict(x) for x in local['cases'] if x['id'] not in base_ids]
assert len(new_cases) == 64
mail_target = PUBLIC / 'assets/gallery/mail-20261009-lite'
mail_target.mkdir(parents=True, exist_ok=True)
new_details = {}
transported = {}
for item in new_cases:
    detail = dict(details[item['id']]); rewritten = []
    matches = {x['source']:x for x in mapping.get(item['id'], [])}
    for url in detail['images']:
        source = normal(url)
        if source in matches:
            rewritten.append(matches[source]['url']); continue
        if source.startswith('/media/gallery/'):
            if source not in transported:
                raw = STATE / 'media' / source.rsplit('/', 1)[1]
                out = mail_target / (raw.name + '-1280q84.webp')
                with Image.open(raw) as im:
                    im.load(); im=ImageOps.exif_transpose(im).convert('RGB'); im.thumbnail((1280,1280))
                    if not out.exists(): im.save(out,'WEBP',quality=84,method=4)
                transported[source] = '/assets/gallery/mail-20261009-lite/' + out.name
            rewritten.append(transported[source])
        else: rewritten.append(url)
    detail['images'] = rewritten; new_details[item['id']] = detail
    first = normal(item['image'])
    if first in matches:
        item.update({k:matches[first][k] for k in ('url','thumbnail','previewImage')})
        item['image'] = item.pop('url')
    elif first in transported: item['image'] = transported[first]
    if any(x['privacy'] for x in matches.values()): item['galleryUrl'] = ''
    assert len(detail['images']) == item['photoCount']
    assert item.get('firstPublishedAt')

manifest = {'version':1,'date':'2026-10-09','photos':len(rows),'cases':mapping}
snapshot = {'version':1,'capturedAt':load(STATE/'capture.json')['capturedAt'], 'cases':new_cases,'details':new_details}
for filename, data in [('photo-replacements.json',manifest), ('mail-publications.json',snapshot)]:
    encoded = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    assert '127.0.0.1' not in encoded and 'localhost' not in encoded
    (PUBLIC / 'data' / filename).write_text(encoded + '\n', encoding='utf-8')
receipt = {'photos':len(rows),'cases':len(mapping),'references':len(refs),'newCases':len(new_cases),
           'transportedOriginalPhotos':len(transported),'exportBytes':sum(f.stat().st_size for f in target.glob('*.webp')),
           'exports':list(exports.values())}
(STATE / 'export-verification.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in receipt.items() if k != 'exports'}))
