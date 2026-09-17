import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {filterCases,emptyFilters} from '../public/filter.js';
import {findSeries} from '../public/series-data.js';
const read=async name=>JSON.parse(await readFile(new URL('../'+name,import.meta.url),'utf8'));
const data=await read('public/data/catalog.json');
const audit=await read('audit/data-extraction.json');
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
 assert.equal(crv.productUrl,'https://seatcover.jp/c/seatcovermaker/refinad/refinad-leatherdx/refinad-dx00067');

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
 assert.equal(canbus.length,143);assert.equal(data.cases.filter(x=>x.car==='メルセデス・ベンツ Aクラス').length,0);
 assert.equal(audit.brands.IXUS,143);assert.ok(data.featuredIds.every(id=>data.cases.some(x=>x.id===id)));
 for(const item of canbus){const detail=await read(`public/data/details/${item.id}.json`);assert.equal(detail.sourceFile,'daihatsu_movecanbus.html');}
});

test('color labels are explicitly present in source descriptions; IXUS gaps are preserved',async()=>{
 assert.equal(data.cases.filter(c=>c.colorName).length,audit.withColorName);
 for(const c of data.cases){
  const detail=await read(`public/data/details/${c.id}.json`);
  if(c.colorName){assert.ok(detail.alt.includes(' '+c.colorName+' シートカバー装着写真'));assert.ok(c.colors.length);assert.equal(detail.colorSource,'保存HTMLの写真説明（alt）');}
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
  const galleryPage=item.galleryUrl.split('#')[0];
  const destination=detail.productUrl||findSeries(item.brand,item.series)?.productUrl||data.vehicleProductUrls[galleryPage];
  assert.match(destination,/^https:\/\/seatcover.jp\/(?:c|f)\//,`${item.car} / ${item.brand} ${item.series}`);
 }
 const hs=data.cases.find(item=>item.car==='レクサスHS'&&item.brand==='Dotty'&&item.series==='DIA-LUX');
 assert.equal(findSeries(hs.brand,hs.series).productUrl,'https://seatcover.jp/c/seatcovermaker/dotty/dotty-dialux');
});
