import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {filterCases,emptyFilters} from '../public/filter.js';
import {findSeries} from '../public/series-data.js';
import {productLink} from '../public/product-link.js';
const read=async name=>JSON.parse(await readFile(new URL('../'+name,import.meta.url),'utf8'));
const data=await read('public/data/catalog.json');
const audit=await read('audit/data-extraction.json');
const linkAudit=await read('audit/direct-product-links-2026-09-25.json');
const auditedLinks=new Map(linkAudit.entries.map(row=>[row.caseId,row]));
const sourceReview=await read('audit/yellow-color-review-2026-10-01.json');
const allColorReview=await read('audit/all-color-review-2026-10-02.json');
const correctedColors=new Map([...sourceReview.entries,...allColorReview.entries].filter(row=>row.correction?.colorName).map(row=>[row.caseId,row]));
test('every retained source record is accounted for; IDs and detail files are consistent',async()=>{
 assert.equal(audit.rawRecords+audit.importedRecords,data.cases.length+audit.deduplicated+audit.curatedMergedRecords+audit.excluded.reduce((n,x)=>n+x.count,0));
 assert.equal(new Set(data.cases.map(x=>x.id)).size,data.cases.length);
 for(const c of data.cases){
  assert.match(c.id,/^[a-f0-9]{12}$/);const detail=await read(`public/data/details/${c.id}.json`);
  assert.equal(detail.images.length,c.photoCount);assert.equal(detail.images[0],c.image);
  assert.equal(c.hasReview,!!detail.review.trim());assert.ok(['seatcover','panel'].includes(c.category));
  for(const s of detail.images){const u=new URL(s);assert.equal(u.protocol,'https:');assert.ok(!u.username&&!u.password);}
 }
});

test('Jimny Heritage Mesh contains only the visually verified installation set',async()=>{
 const matches=data.cases.filter(c=>c.maker==='スズキ'&&c.car==='ジムニー'&&c.brand==='Refinad'&&c.series==='Heritage Mesh');
 assert.equal(matches.length,1);
 assert.equal(matches[0].photoCount,9);
 const detail=await read(`public/data/details/${matches[0].id}.json`);
 assert.equal(detail.images.length,9);
 assert.ok(detail.images.every(src=>/jimny_heritage_mesh_ig\.jpg|ig_post2_(?:01|04|06)\.jpg|jimny_mesh_brown\/(?:02|03|04|05|06)\.jpg$/.test(src)));
 assert.ok(detail.images.every(src=>!/(?:ig_post2_(?:02|03|05|07|08|09|10|11|12|13)|jimny_mesh_brown\/01)\.jpg$/.test(src)));
 assert.match(detail.curationNote,/別車種・別シリーズ/);
});
test('reviewed source corrections keep vehicle, series, and product assignments coherent',async()=>{
 const expectedCars=new Map([
  ['345ead70e6af','A4アバント'],
  ['e6d516dffffa','A3スポーツバック'],
  ['248e988d1ded','A3スポーツバック'],
  ['d83e3ce10702','TT'],
  ['8cb2354f7e2c','CR-V'],
  ['05922a028139','MINI CROSSOVER'],
  ['0d5801bb112a','MINI クーパーS'],
 ]);
 for(const [id,car] of expectedCars){
  assert.equal(data.cases.find(item=>item.id===id)?.car,car);
  const detail=await read(`public/data/details/${id}.json`);
  assert.ok(detail.sourceCorrection);
 }
 const crv=await read('public/data/details/8cb2354f7e2c.json');
 assert.equal(auditedLinks.get('8cb2354f7e2c').originalUrl,'https://seatcover.jp/c/seatcovermaker/refinad/refinad-leatherdx/refinad-dx00067');
 assert.equal(crv.productUrl,'https://seatcover.jp/c/honda/crv/refinad-dx00067');

 const owners=new Map();
 for(const item of data.cases){
  const detail=await read(`public/data/details/${item.id}.json`);
  for(const image of detail.images){
   const assignment={maker:item.maker,car:item.car,brand:item.brand,series:item.series};
   const prior=owners.get(image);
   if(prior) assert.deepEqual(assignment,prior,`cross-assigned image: ${image}`);
   else owners.set(image,assignment);
  }
 }
 const leather=data.cases.find(item=>item.id==='ea5470899f1a');
 const leatherDetail=await read(`public/data/details/${leather.id}.json`);
 assert.equal(leather.photoCount,6);
 assert.ok(!leatherDetail.images.includes('https://refinad.com/wp-content/uploads/2021/11/bmw3.jpg-1.jpeg.webp'));
 const quiltDetail=await read('public/data/details/2b45a610bbee.json');
 assert.ok(quiltDetail.images.includes('https://refinad.com/wp-content/uploads/2021/11/bmw3.jpg-1.jpeg.webp'));
});
test('Canbus copies are not attributed to Mercedes; archive gaps stay explicit',async()=>{
 const canbus=filterCases(data.cases,{...emptyFilters(),maker:'ダイハツ',q:'ムーヴキャンバス'});
 assert.equal(canbus.length,144);assert.equal(data.cases.filter(x=>x.car==='メルセデス・ベンツ Aクラス').length,0);
 assert.equal(audit.brands.IXUS,143);assert.ok(data.featuredIds.every(id=>data.cases.some(x=>x.id===id)));
 for(const item of canbus){const detail=await read(`public/data/details/${item.id}.json`);assert.ok(['daihatsu_movecanbus.html','daihatsu_move.html'].includes(detail.sourceFile));}
});

test('color labels are explicitly present in source descriptions; IXUS gaps are preserved',async()=>{
 assert.equal(data.cases.filter(c=>c.colorName).length,audit.withColorName);
 for(const c of data.cases){
  const detail=await read(`public/data/details/${c.id}.json`);
  if(c.colorName){
   assert.ok(detail.alt.includes(' '+c.colorName+' シートカバー装着写真'));assert.ok(c.colors.length);
   const corrected=correctedColors.get(c.id);
   if(corrected){
    assert.equal(detail.colorSource,corrected.userConfirmation?'ユーザー確認（同一写真を提示して色名を確認）':`${c.brand}公式装着ページのカラー欄（同一写真URLを照合）`);
    assert.equal((detail.colorReview||detail.sourceMetadata).url,corrected.sourceUrl);
    assert.deepEqual(detail.images,corrected.verifiedImages);
    assert.deepEqual(c.colors,corrected.correction.colors);
   }else assert.equal(detail.colorSource,'保存HTMLの写真説明（alt）');
  }
  else assert.deepEqual(c.colors,[]);
  if(c.brand==='IXUS'){assert.equal(c.carKnown,false);assert.equal(c.colorName,'');assert.equal(detail.sourceFile,'old.zip/old/v2/index.html');}
 }
});
test('featured set has distinct cars and retains source product links',async()=>{
 const featured=data.featuredIds.map(id=>data.cases.find(x=>x.id===id));assert.ok(featured.length>=10);assert.equal(new Set(featured.map(x=>x.car)).size,featured.length);
 const detail=await read(`public/data/details/${featured[0].id}.json`);assert.match(detail.productUrl,/^https:\/\/seatcover.jp\/c\//);
});
test('every gallery detail resolves to an available product destination',async()=>{
 for(const item of data.cases){
  const detail=await read(`public/data/details/${item.id}.json`);
  const destination=detail.productUrl||data.vehicleProductLinks[`${item.maker}|${item.car}`]||findSeries(item.brand,item.series)?.productUrl||'https://seatcover.jp/f/carlist_renewal.html';
  assert.match(destination,/^https:\/\/seatcover.jp\/(?:c|f)\//,`${item.car} / ${item.brand} ${item.series}`);
 }
 const hs=data.cases.find(item=>item.car==='レクサスHS'&&item.brand==='Dotty'&&item.series==='DIA-LUX');
 assert.equal(findSeries(hs.brand,hs.series).productUrl,'https://seatcover.jp/c/seatcovermaker/dotty/dotty-dialux');
});

test('mismatched product URLs are withheld and lead to the matching vehicle category',async()=>{
 const rejected=await read('audit/rejected-product-links-2026-09-25.json');
 for(const entry of rejected.entries){
  const item=data.cases.find(x=>x.id===entry.caseId);
  const detail=await read(`public/data/details/${entry.caseId}.json`);
  assert.equal(detail.productUrl,'',entry.caseId);
  assert.ok(detail.productLinkAudit);
  assert.ok(item);
 }
 assert.equal(data.vehicleProductLinks['スズキ|ジムニーノマド'],'https://seatcover.jp/c/suzuki/jimnynomade');
 assert.equal(data.vehicleProductLinks['ダイハツ|ムーヴキャンバス'],'https://seatcover.jp/c/daihatsu/movecanbus');
 assert.equal(data.vehicleProductLinks['ダイハツ|キャストスタイル'],'https://seatcover.jp/c/daihatsu/caststyle');
 assert.equal(data.vehicleProductLinks['アウディ|A4アバント'],'https://seatcover.jp/c/audi/audia4');
});

test('Nomad installations do not display copied JB64 Jimny fitment',async()=>{
 const nomads=data.cases.filter(item=>item.maker==='スズキ'&&item.car==='ジムニーノマド');
 assert.equal(nomads.length,15);
 for(const item of nomads){
  const detail=await read(`public/data/details/${item.id}.json`);
  assert.deepEqual(detail.photoInfo,[],item.id);
  assert.match(detail.sourceCorrection,/旧ジムニーJB64/);
 }
 const heritage=await read('public/data/details/7fce0f7893a6.json');
 assert.equal(auditedLinks.get('7fce0f7893a6').originalUrl,'https://seatcover.jp/c/seatcovermaker/refinad/refinad-heritage/refinad-ht00646');
 assert.equal(heritage.productUrl,'');
});

test('only audited product pages get a direct CTA; unresolved links use safe destinations',async()=>{
 assert.equal(linkAudit.entries.length,2632);
 assert.equal(linkAudit.counts.verified_product_page+linkAudit.counts.unverified,linkAudit.entries.length);
 assert.equal(auditedLinks.size,linkAudit.entries.length);
 for(const item of data.cases){
  const detail=await read(`public/data/details/${item.id}.json`);
  const review=auditedLinks.get(item.id);
  if(!review)continue;
  assert.equal(detail.productLinkStatus,review.status,item.id);
  const destination=productLink(item,detail.productUrl,data.vehicleProductLinks,detail.productLinkReason);
  if(review.status==='verified_product_page'){
   assert.equal(detail.productUrl,review.approvedUrl,item.id);
   assert.equal(destination.label,'この商品を見る ↗',item.id);
   assert.ok(review.evidence.some(value=>/^live_product_page_photo_code_selectable_2026-10-0[12]$/.test(value)));
   assert.match(review.salesState,/^公開商品ページの品番選択肢を確認（2026-10-0[12]）$/);
  }else{
   assert.equal(detail.productUrl,'',item.id);
   assert.equal(review.approvedUrl,null);
   assert.notEqual(destination.label,'この商品を見る ↗',item.id);
   if(review.originalUrl.includes('/seatcovermaker/'))assert.notEqual(destination.url,review.originalUrl,item.id);
   assert.equal(review.salesState,'写真品番と商品ページの対応は未確認');
  }
  assert.equal(review.fitmentScope,'年式・型式・グレード未確認');
 }
});

test('a photo code absent from the linked product cannot keep a direct product CTA',async()=>{
 const item=data.cases.find(row=>row.id==='4247722a9cd4');
 const detail=await read('public/data/details/4247722a9cd4.json');
 assert.equal(detail.photoInfo[0]['品番'],'T0043-06');
 assert.equal(detail.productUrl,'');
 const destination=productLink(item,detail.productUrl,data.vehicleProductLinks,detail.productLinkReason);
 assert.equal(destination.url,'https://seatcover.jp/f/match_renewal');
 assert.notEqual(destination.label,'この商品を見る ↗');
});

test('a live product with the photo code available may be linked despite an old unlisted flag',async()=>{
 const detail=await read('public/data/details/0808fe604942.json');
 assert.equal(detail.photoInfo[0]['品番'],'S0113-02');
 assert.equal(detail.productUrl,'https://seatcover.jp/c/suzuki/jimny/refinad-ex00113');
 assert.equal(detail.productLinkStatus,'verified_product_page');
});

test('the Move Canvas photo is searchable under its verified vehicle',async()=>{
 const item=data.cases.find(row=>row.id==='8be9c8b0594c');
 assert.equal(item.car,'ムーヴキャンバス');
 const detail=await read('public/data/details/8be9c8b0594c.json');
 assert.equal(detail.photoInfo[0]['品番'],'D0488-01');
 assert.equal(detail.productUrl,'https://seatcover.jp/c/seatcovermaker/sandii/sandii-waffle/sandii-wf00488');
});

test('live selectable product codes override an old manager flag; published vehicle pages replace archive URLs',async()=>{
 const unlisted=linkAudit.entries.find(row=>row.car==='ジムニー'&&row.originalUrl.endsWith('/refinad-ex00113'));
 assert.equal(unlisted.shopListing.status,'未掲載');
 assert.equal(unlisted.status,'verified_product_page');
 assert.equal((await read(`public/data/details/${unlisted.caseId}.json`)).productUrl,'https://seatcover.jp/c/suzuki/jimny/refinad-ex00113');
 const hiace=linkAudit.entries.find(row=>row.car==='ハイエース'&&row.originalUrl.endsWith('/refinad-00026'));
 assert.equal(hiace.shopListing.status,'公開中');
 assert.equal(hiace.approvedUrl,'https://seatcover.jp/c/toyota/hiace2/refinad-00026');
 assert.equal((await read(`public/data/details/${hiace.caseId}.json`)).productUrl,hiace.approvedUrl);
});
