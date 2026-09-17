"""Extract a searchable snapshot from the actual handoff HTML, without executing it."""
from pathlib import Path
from html import unescape
from urllib.parse import urlparse, unquote
import hashlib, json, re, unicodedata
from inspect_source import GalleryParser, ROOT, SOURCE
from gallery_metadata import photo_color, image_key

MAKERS = {'toyota':'トヨタ','suzuki':'スズキ','honda':'ホンダ','daihatsu':'ダイハツ','nissan':'日産','mitsubishi':'三菱','mazda':'マツダ','subaru':'スバル','lexus':'レクサス','volkswagen':'フォルクスワーゲン','vw':'フォルクスワーゲン','audi':'アウディ','bmw':'BMW','mercedes':'メルセデス・ベンツ','benz':'メルセデス・ベンツ','fiat':'フィアット','jeep':'ジープ','renault':'ルノー','citroen':'シトロエン','volvo':'ボルボ','porsche':'ポルシェ','chrysler':'クライスラー','isuzu':'いすゞ','rover':'ローバー','smart':'スマート','chevrolet':'シボレー','chevy':'シボレー'}
TRUSTED_IMAGES = {'seatcover.jp','refinad.com','sandii.net','www.dotty.co.jp','dotty.co.jp','ixus.life','carshopconnect.itembox.cloud','carshopconnect.itembox.design'}
MAKERS.update({'mini':'MINI','peugeot':'プジョー','ford':'フォード'})
# These templates copy other vehicles' complete photo sets, without vehicle metadata.
# The matching Canbus/Delica source includes data-photo-info identifying the actual car.
QUARANTINE = {'mercedes_aclass.html','mercedes_bclass.html','mercedes_cclass.html','mercedes_eclass.html','mercedes_vclass.html','welfare_welfare-cx5.html'}

# The saved Jimny page bundled three promotional Heritage Mesh cards. Two of
# those cards also contained exterior shots and photos of unrelated vehicles or
# seat-cover series. Keep only the images that were visually verified as Jimny
# Heritage Mesh installations, and present them as one coherent gallery.
JIMNY_HERITAGE_MESH_IMAGES = [
    'https://seatcover.jp/gallerys/v2/heritage_mesh_ig/jimny_heritage_mesh_ig.jpg',
    'https://seatcover.jp/gallerys/v2/ig_posts/jimny_mesh_brown/05.jpg',
    'https://seatcover.jp/gallerys/v2/ig_posts/jimny_mesh_brown/03.jpg',
    'https://seatcover.jp/gallerys/v2/heritage_mesh_ig/ig_post2_06.jpg',
    'https://seatcover.jp/gallerys/v2/heritage_mesh_ig/ig_post2_01.jpg',
    'https://seatcover.jp/gallerys/v2/heritage_mesh_ig/ig_post2_04.jpg',
    'https://seatcover.jp/gallerys/v2/ig_posts/jimny_mesh_brown/06.jpg',
    'https://seatcover.jp/gallerys/v2/ig_posts/jimny_mesh_brown/04.jpg',
    'https://seatcover.jp/gallerys/v2/ig_posts/jimny_mesh_brown/02.jpg',
]
JIMNY_HERITAGE_MESH_SOURCE_IMAGES = {
    'https://seatcover.jp/gallerys/v2/heritage_mesh_ig/jimny_heritage_mesh_ig.jpg',
    'https://seatcover.jp/gallerys/v2/heritage_mesh_ig/ig_post2_01.jpg',
    'https://seatcover.jp/gallerys/v2/ig_posts/jimny_mesh_brown/01.jpg',
}

def clean_car(value):
    value=re.sub(r'\s+', ' ', value).strip()
    # Product names accidentally appear in some Dotty page titles. Strip only known suffixes.
    value=re.sub(r'[-‐](?:DEP[-‐][A-Z-]+|DPE[-‐][A-Z-]+|DEV[-‐][A-Za-z-]+|EURO[-‐][A-Z-]+|COX[-‐][A-Z-]+|LUXUR[-‐][A-Z-]+|DIA[-‐][A-Z-]+|GT[-‐][A-Z-]+)$','',value)
    return value

def norm(value):
    return re.sub(r'[\s・:：/／（）()\-−ー]', '', unicodedata.normalize('NFKC', value).lower())

def safe_url(value, image=False):
    try:
        u=urlparse(value)
        return value if u.scheme=='https' and u.hostname in TRUSTED_IMAGES and not u.username and not u.password else ''
    except ValueError: return ''

def parse_json(value, default):
    try: return json.loads(value)
    except (ValueError, TypeError): return default

if __name__=='__main__':
    public=ROOT/'public'; public.mkdir(exist_ok=True)
    records={}; exclusions=[]; raw=0; duplicates=0; duplicate_details=[]; curated_merged=0; curated_details=[]; vehicle_product_urls={}
    files=sorted(SOURCE.glob('*.html'), key=lambda p: ('combined' in p.stem or p.stem.endswith('_series'), len(p.stem), p.stem))
    for file in files:
        parser=GalleryParser(); parser.feed(file.read_text(encoding='utf-8-sig'))
        raw+=len(parser.cards)
        gallery_page='https://seatcover.jp/gallerys/gallery/'+file.name
        page_product=safe_url(parser.shop_url)
        if page_product: vehicle_product_urls[gallery_page]=page_product
        if file.name in QUARANTINE:
            exclusions.append({'file':file.name,'reason':'vehicle identity conflict; quarantined for source review','count':len(parser.cards)}); continue
        car=clean_car(re.split(r'\s*シートカバー', parser.title)[0].strip())
        maker=MAKERS.get(file.stem.split('_')[0], '')
        if not maker:
            exclusions.append({'file':file.name,'reason':'unknown maker','count':len(parser.cards)}); continue
        for a in parser.cards:
            brand=a.get('data-brand','').strip()
            series=a.get('data-series','').strip()
            images=list(dict.fromkeys(safe_url(x, True) for x in parse_json(a.get('data-imgs',''),[]) if isinstance(x,str)))
            images=[x for x in images if x and not re.search(r'(?:_logo|logo180|noimage|placeholder)',x,re.I)]
            if not images or brand not in ['Refinad','Sandii','Dotty','IXUS']:
                exclusions.append({'file':file.name,'index':a.get('data-idx'),'reason':'missing images or brand'}); continue
            other=next((b for b in ['Refinad','Sandii','Dotty','IXUS'] if series.lower().startswith(b.lower())),brand)
            if other != brand:
                exclusions.append({'file':file.name,'index':a.get('data-idx'),'reason':'brand/series conflict'}); continue
            # Exact image+brand+series duplicates arise from combined/per-design pages.
            identity=brand+'|'+series+'|'+images[0]
            if identity in records:
                duplicates+=1
                duplicate_details.append({'kept':records[identity]['detail']['sourceFile'],'omitted':file.name,'image':images[0]})
                continue
            name=a.get('data-model') or car
            sid=hashlib.sha256(identity.encode()).hexdigest()[:12]
            design=re.sub(r'^(Refinad|Sandii|Dotty|IXUS)\s*','',series,flags=re.I).strip() or 'シリーズ名の記載なし'
            info=parse_json(a.get('data-photo-info',''),[])
            gallery=gallery_page+'#card-'+a.get('data-idx','0')
            product=safe_url(a.get('data-product-url',''))
            category='panel' if re.search(r'interior\s*panel|インテリアパネル',series,re.I) else 'seatcover'
            records[identity]={'id':sid,'maker':maker,'car':name,'brand':brand,'series':design,'category':category,'image':images[0],'photoCount':len(images),'galleryUrl':gallery,'hasReview':bool(a.get('data-review','').strip()),'detail':{'images':images,'review':a.get('data-review','').strip(),'productUrl':product,'photoInfo':info,'alt':a.get('alt',''),'sourceFile':file.name}}
    cases=list(records.values())
    heritage_sources=[case for case in cases if case['image'] in JIMNY_HERITAGE_MESH_SOURCE_IMAGES]
    heritage_base=next((case for case in heritage_sources if case['image']==JIMNY_HERITAGE_MESH_IMAGES[0]),None)
    if heritage_base and len(heritage_sources)==3:
        heritage_base['detail']['images']=JIMNY_HERITAGE_MESH_IMAGES
        heritage_base['detail']['curationNote']='保存HTMLで混在していた車外・別車種・別シリーズの写真を除外し、ジムニー Heritage Mesh の装着写真のみ統合。'
        heritage_base['image']=JIMNY_HERITAGE_MESH_IMAGES[0]
        heritage_base['photoCount']=len(JIMNY_HERITAGE_MESH_IMAGES)
        omitted=[case for case in heritage_sources if case is not heritage_base]
        cases=[case for case in cases if case not in omitted]
        curated_merged=len(omitted)
        curated_details.append({
            'kept':heritage_base['id'],
            'merged':[case['id'] for case in omitted],
            'reason':'Jimny Heritage Mesh promotional cards contained unrelated imagery',
            'keptImages':JIMNY_HERITAGE_MESH_IMAGES,
        })
    # The original photo description explicitly includes these color labels.
    for case in cases:
        case['colorName'],case['colors']=photo_color(case['detail']['alt'])
        if case['colorName']: case['detail']['colorSource']='保存HTMLの写真説明（alt）'
    uploaded=ROOT/'.source/old-upload/v2/index.data.json'
    imported=0; enriched_series=0
    if uploaded.is_file():
        old_rows=json.loads(uploaded.read_text(encoding='utf-8'))
        by_image={(r['b'],image_key(r['imgs'][0])):r for r in old_rows if r.get('imgs')}
        for case in cases:
            row=by_image.get((case['brand'],image_key(case['image'])))
            if row and row.get('s') and case['series']=='シリーズ名の記載なし':
                case['series']=re.sub(r'^(Refinad|Sandii|Dotty|IXUS)\s*','',row['s'],flags=re.I).strip()
                case['detail']['seriesSource']='old.zip / old/v2/index.html'
                enriched_series+=1
        # IXUS was absent from the handoff pages. The upload has maker labels but no car names.
        for row in old_rows:
            if row['b']!='IXUS': continue
            images=list(dict.fromkeys(safe_url(x,True) for x in row['imgs']))
            if not images or not all(images): raise ValueError('Untrusted IXUS image URL')
            sid=hashlib.sha256(('old-upload|IXUS|'+images[0]).encode()).hexdigest()[:12]
            series=re.sub(r'^IXUS\s*','',row['s']).strip() or 'シリーズ名の記載なし'
            maker={'ベンツ':'メルセデス・ベンツ'}.get(row['m'],row['m'])
            known=bool(row['c'] and row['c']!=row['m'])
            car=row['c'] if known else '車種名未掲載'
            review=row.get('r','').strip()
            cases.append({'id':sid,'maker':maker,'car':car,'carKnown':known,'brand':'IXUS','series':series,'category':'seatcover','image':images[0],'photoCount':len(images),'galleryUrl':'https://seatcover.jp/gallerys/','hasReview':bool(review),'colorName':'','colors':[],
                'detail':{'images':images,'review':review,'productUrl':safe_url(row['u']),'photoInfo':[],'alt':maker+' IXUS '+series+' 装着写真','sourceFile':'old.zip/old/v2/index.html','sourceCarLabel':row['c'],'carNote':'旧資料にはメーカー名のみ記載されています。車種名・色名は未確認です。'}})
            imported+=1
    # Opening selection uses actual data and keeps a mix of vehicles and brands.
    targets=[('ジムニー','Refinad','Heritage Mesh'),('ムーヴキャンバス','Sandii','マカロン'),('ハイエース','Refinad','Leather Deluxe'),('N-BOX','Sandii','オールドカヌレ'),('ハスラー','Sandii','カヌレ'),('アルファード','Refinad','Quilt'),('デリカ','Refinad','Leather'),('シエンタ','Sandii','ビスキュイ'),('カングー','Sandii','カヌレ'),('FIAT','Sandii','マカロン'),('ヤリス','Refinad','Leather'),('ラパン','Sandii','マカロン')]
    featured=[]
    for car,brand,series in targets:
        found=next((x for x in cases if norm(car) in norm(x['car']) and x['brand']==brand and series.lower() in x['series'].lower() and x['category']=='seatcover' and x not in featured),None)
        if found: featured.append(found)
    ids={x['id'] for x in featured}
    cases=featured+[x for x in cases if x['id'] not in ids]
    detail_dir=public/'data/details'; detail_dir.mkdir(parents=True,exist_ok=True)
    for stale in detail_dir.glob('*.json'): stale.unlink()
    for x in cases:
        details=x.pop('detail')
        (detail_dir/(x['id']+'.json')).write_text(json.dumps(details,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
        if (public/f"assets/gallery/{x['id']}-480.webp").is_file():
            x['thumbnail']=f"/assets/gallery/{x['id']}-480.webp"
            x['previewImage']=f"/assets/gallery/{x['id']}-960.webp"
    data={'version':2,'sourceDate':'2026-06-04','additionalSource':'old.zip（2026-09-14受領）' if imported else '', 'sourceRepository':'https://github.com/carshopconnect1-sketch/csc-gallery-handoff','sourceCommit':'290401cb164b6fdf6d1dccaff4da8252e7b45269','note':'保存資料と提供ZIPから再構成。色名は写真説明の明示値。公開サイトとの最新同期は未実施。','featuredIds':[x['id'] for x in featured],'vehicleProductUrls':vehicle_product_urls,'cases':cases}
    (public/'data/catalog.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    report={'files':len(files),'rawRecords':raw,'deduplicated':duplicates,'duplicateDetails':duplicate_details,'curatedMergedRecords':curated_merged,'curatedDetails':curated_details,'excluded':exclusions,'caseCount':len(cases),'makers':len(set(x['maker'] for x in cases)),'cars':len(set((x['maker'],x['car']) for x in cases if x.get('carKnown') is not False)),'brands':{b:sum(x['brand']==b for x in cases) for b in ['Refinad','Sandii','Dotty','IXUS']},'sourceDate':data['sourceDate'],'catalogBytes':(public/'data/catalog.json').stat().st_size,'featured':featured}
    (ROOT/'audit').mkdir(exist_ok=True)
    report.update({'importedRecords':imported,'enrichedSeries':enriched_series,'withColorName':sum(bool(c['colorName']) for c in cases),'withoutColorName':sum(not c['colorName'] for c in cases),'colorNames':sorted({c['colorName'] for c in cases if c['colorName']})})
    (ROOT/'audit/data-extraction.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k not in ['excluded','featured','duplicateDetails','curatedDetails']},ensure_ascii=False))
    print('EXCLUSIONS',len(exclusions))
