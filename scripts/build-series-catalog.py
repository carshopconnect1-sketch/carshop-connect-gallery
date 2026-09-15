"""Map the official portrait collection to explicitly named gallery series."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
assets = json.loads((ROOT/'audit/series-assets.json').read_text(encoding='utf-8'))
refinad = {
 'refinad-leather': ['Leather Series'], 'refinad-leatherdx': ['Leather Deluxe Series'],
 'refinad-quilt': ['Quilt Series'], 'refinad-harmonious': ['Harmonious Leather Series'],
 'refinad-avantgarde': ['Avant-Garde Series'], 'refinad-alcantara': ['Alcantara Series'],
 'refinad-custom': ['Custom Series'], 'refinad-exclusive': ['Exclusive Design Series'],
 'refinad-oldleather': ['Old Leather Series'],
 'refinad-corduroy': ['Corduroy Series', 'Corduroy Denim'],
 'refinad-astraea': ['Astraea Series', 'Astraea Leaf'],
 'refinad-heritage': ['Heritage Series', 'Heritage'],
 'refinad-heritagemesh': ['Heritage Mesh Series', 'Heritage Mesh'],
}
sandii_aliases = {
 'カヌレ': ['CANELE カヌレ シリーズ'], 'カヌレグラッセ': ['CANELE GLACE カヌレグラッセ シリーズ'],
 'コロール': ['color コロール シリーズ'], 'デニムサンド': ['Denim Sand デニムサンド シリーズ'],
 'ドルチェ': ['DOLCE ドルチェ シリーズ'], 'マカロン': ['macaron マカロンシリーズ'],
 'ワッフル': ['WAFFLE ワッフル シリーズ'],
}
brand_names = {'refinad':'Refinad','sandii':'Sandii','dotty':'Dotty','ixus':'IXUS'}
definitions = []
for asset in assets:
    assert asset.get('local') and asset['height'] > asset['width'], asset
    brand = brand_names[asset['page'].split('/seatcovermaker/')[1].split('/')[0]]
    slug = asset['page'].rstrip('/').rsplit('/',1)[1]
    label = asset['name']
    # Source alt text is wrong for these two tiles; visible caption and destination agree.
    if slug == 'sandii-galette': label = 'ガレット'
    if slug == 'ixus-denim': label = 'デニム'
    values = [label]
    if brand == 'Refinad': values = refinad.get(slug, values)
    if brand == 'Sandii': values += sandii_aliases.get(label, [])
    if slug == 'ixus-ly': values = ['レザリーデニム']
    if slug == 'fnclass': values = ['FN-Class']
    definitions.append(dict(id=slug, brand=brand, label=label, values=values,
        image=asset['local'], width=asset['width'], height=asset['height'], productUrl=asset['page']))
order = ['Refinad','Sandii','Dotty','IXUS']
definitions.sort(key=lambda x: order.index(x['brand']))
payload = json.dumps(definitions,ensure_ascii=False,indent=2)
(ROOT/'public/series-data.js').write_text(
    '// Official portraits from https://seatcover.jp/c/seatcovermaker; see audit/series-assets.json.\n'
    'export const seriesCatalog = '+payload+';\n'
    'export function findSeries(brand, value) {\n'
    '  return seriesCatalog.find(s => (!brand || s.brand === brand) && s.values.includes(value));\n'
    '}\n'
    'export function canonicalSeries(brand, value) {return findSeries(brand, value)?.values[0] || value;}\n',
    encoding='utf-8')
print(f'{len(definitions)} official portrait series')
