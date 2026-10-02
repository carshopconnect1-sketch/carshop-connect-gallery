"""Read public brand installation pages and compare only body seat colors by exact photos.

Run after supplying official sitemap XMLs in .preview; --offline uses the ignored
source cache. The audit never modifies the catalog or guesses colors from photos.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen
import gzip, hashlib, json, re, sys, xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'scripts'))
from gallery_metadata import COLOR_NAMES, image_key
CACHE = ROOT/'.source/color-review-2026-10-02'
CACHE.mkdir(exist_ok=True)
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}

def fetch(url):
    with urlopen(Request(quote(url,safe=':/?=&%'), headers={'User-Agent':'CAR-SHOP-CONNECT-Data-Review/1.0','Accept-Encoding':'gzip'}), timeout=25) as response:
        data=response.read()
        if response.headers.get('Content-Encoding')=='gzip': data=gzip.decompress(data)
        return data.decode('utf-8'), response.url

class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.stack=[];self.images=[];self.fields={};self.heading=None;self.mode=None;self.parts=[];self.links=[];self.title='';self.titleparts=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs);classes=attrs.get('class','')
        if tag not in VOID:self.stack.append((tag,classes))
        media=any('portfolio-media' in c or 'mkdf-ps-image-holder' in c for t,c in self.stack)
        content=any('portfolio-content' in c or 'mkdf-ps-content-item' in c for t,c in self.stack)
        if tag=='a':
            href=attrs.get('href','');self.links.append(href)
            if media and '/wp-content/uploads/' in href:self.images.append(href)
        if tag=='img' and media:
            for key in ('src','data-src'):
                if '/wp-content/uploads/' in attrs.get(key,''):self.images.append(attrs[key])
        if content and tag in ('h6','p'):
            self.mode=tag;self.parts=[]
        if tag=='title':self.titleparts=[]
    def handle_data(self,data):
        if self.mode:self.parts.append(data)
        if any(t=='title' for t,c in self.stack):self.titleparts.append(data)
    def handle_endtag(self,tag):
        if tag==self.mode:
            text=' '.join(''.join(self.parts).split())
            if tag=='h6':self.heading=text
            elif self.heading:
                self.fields[self.heading]=' / '.join(filter(None,[self.fields.get(self.heading,''),text]));self.heading=None
            self.mode=None
        if tag=='title':self.title=' '.join(''.join(self.titleparts).split())
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i][0]==tag:del self.stack[i:];break

def parse(url,html):
    p=Page();p.feed(html)
    return {'url':url,'fields':p.fields,'images':list(dict.fromkeys(p.images)), 'title':p.title,'schema':3}

def get_source(url):
    file=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.json')
    if file.exists():
        d=json.loads(file.read_text(encoding='utf-8'))
        if d.get('schema')==3 and not d.get('error'):return d
    try:
        html,resolved=fetch(url);result=parse(resolved,html)
    except Exception as exc:result={'url':url,'error':str(exc),'schema':3}
    file.write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
    return result

def sitemap(file):
    return [e.text for e in ET.fromstring(file.read_text(encoding='utf-8')).iter() if e.tag.endswith('}loc')]


extra_names={'キャラメル':['brown'],'アースグレー':['gray'],'ビターCCL':['brown']}
all_names={**COLOR_NAMES,**extra_names}
names_re=re.compile('|'.join(sorted(map(re.escape,all_names),key=len,reverse=True)))
english={'BLACK':'ブラック','WHITE':'ホワイト','IVORY':'アイボリー','BEIGE':'ベージュ','CAMEL':'キャメル','GRAY':'グレー','GREY':'グレー','RED':'レッド','BLUE':'ブルー','GREEN':'グリーン','BROWN':'ブラウン','SILVER':'シルバー'}
def main_color_text(text):
    # Some Dotty body color fields append stitch/piping notes; those are not seat colors.
    tokens='|'.join(sorted(map(re.escape,[*all_names,*english,'黒','白','赤','青','緑']),key=len,reverse=True))
    text=re.split(r'(?:'+tokens+r')\s*(?:ステッチ|パイピング|STITCH(?:ES)?|PIPING)',text,flags=re.I)[0]
    text=re.split(r'(?:STITCH|PIPING|ステッチ|パイピング)\s*[:：]',text,flags=re.I)[0]
    text=re.sub(r'\b(?:'+ '|'.join(english)+r')\b',lambda m:english[m[0].upper()],text,flags=re.I)
    text=re.sub(r'(?<![ぁ-んァ-ヶ一-龯])[黒白赤青緑](?![ぁ-んァ-ヶ一-龯])',lambda m:dict(黒='ブラック',白='ホワイト',赤='レッド',青='ブルー',緑='グリーン')[m[0]],text)
    return text.replace('ビターCCL','ビターショコラ').replace('シルキーBEG','シルキーベージュ')


def main():
    urls=set()
    offline='--offline' in sys.argv
    for file in (ROOT/'.preview').glob('*sitemap*.xml'):
        if file.name.startswith(('sandii.net','refinad.com')):urls.update(u for u in sitemap(file) if '/portfolio-item/' in u)
    dotty=Page();dotty.feed((ROOT/'.preview/dotty-gallery.html').read_text(encoding='utf-8'))
    archives=set(u for u in dotty.links if re.fullmatch(r'https://www\.dotty\.co\.jp/gallery/[^/]+/',u))
    for url in ([] if offline else sorted(archives)):
        html,resolved=fetch(url);p=Page();p.feed(html);urls.update(u for u in p.links if '/portfolio-item/' in u)
    if offline:
        urls={json.loads(f.read_text(encoding='utf-8'))['url'] for f in CACHE.glob('*.json')}
    print(json.dumps({'sourcePages':len(urls),'dottyArchives':len(archives)},ensure_ascii=False),flush=True)
    sources=[]
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures={pool.submit(lambda u:json.loads((CACHE/(hashlib.sha256(u.encode()).hexdigest()+'.json')).read_text(encoding='utf-8')) if offline else get_source(u),url):url for url in sorted(urls)}
        for f in as_completed(futures):
            sources.append(f.result())
            if len(sources)%100==0:print(json.dumps({'collected':len(sources),'errors':sum('error' in s for s in sources)},ensure_ascii=False),flush=True)
    
    by_image={}
    for source in sources:
        for image in source.get('images',[]):by_image.setdefault(image_key(image),[]).append(source)
    catalog=json.loads((ROOT/'public/data/catalog.json').read_text(encoding='utf-8'))
    entries=[]
    for case in catalog['cases']:
        detail=json.loads((ROOT/f'public/data/details/{case["id"]}.json').read_text(encoding='utf-8'))
        row={'caseId':case['id'],'brand':case['brand'],'car':case['car'],'series':case['series'],'savedColor':case['colorName'],'savedColors':case['colors'],'images':detail['images']}
        keys={image_key(image) for image in detail['images']}
        candidates={s['url']:s for image in keys for s in by_image.get(image,[]) if keys.issubset({image_key(i) for i in s['images']})}
        row['candidateUrls']=sorted(candidates)
        if len(candidates)==1:
            source=next(iter(candidates.values()))
            fields=source['fields']
            colors={k:v for k,v in fields.items() if ('カラー' in k or k in ('色','色名','COLOR','Color')) and not any(w in k for w in ('ステッチ','パイピング','ベルト','刺繍'))}
            text=' / '.join(colors.values())
            names=list(dict.fromkeys(names_re.findall(main_color_text(text))))
            families=list(dict.fromkeys(f for name in names for f in all_names[name]))
            row.update({'status':'matched','sourceUrl':source['url'],'officialColor':text,'colorFields':colors,'officialColorNames':names,'officialColors':families,'officialPhotoInfo':{k:v for k,v in fields.items() if k in ('車種と型式','品番','商品シリーズ')},'verifiedImages':detail['images']})
            compatible_names={name.replace('キャラメル','キャメル') for name in names}
            saved_names={n.replace('キャラメル','キャメル') for n in case['colorName'].split(' / ')}
            row['colorMismatch']=bool(names and case['colorName'] and not saved_names.issubset(compatible_names))
            row['familyMismatch']=bool(families and case['colors'] and not set(case['colors']).intersection(families))
        else:row['status']='ambiguous_source' if candidates else 'source_not_matched'
        entries.append(row)
    result={'checkedAt':'2026-10-02','scope':'All 2895 cases. Every case image must match one official installation media set. Only body color fields are compared, not tags, stitches, piping, reviews or visual estimates.','sourcePages':len(urls),'sourceErrors':[s for s in sources if 'error' in s],'entries':entries}
    (ROOT/'.preview/all-color-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    counts={brand:{status:sum(r['brand']==brand and r['status']==status for r in entries) for status in ['matched','ambiguous_source','source_not_matched']} for brand in sorted(set(r['brand'] for r in entries))}
    anomalies=[{k:r[k] for k in ('caseId','brand','car','savedColor','officialColor','sourceUrl')} for r in entries if r.get('colorMismatch')]
    print(json.dumps({'coverage':counts,'colorMismatches':len(anomalies),'familyMismatches':sum(r.get('familyMismatch',False) for r in entries),'anomalies':anomalies,'errors':result['sourceErrors']},ensure_ascii=False,indent=2),flush=True)

if __name__ == "__main__":
    main()
