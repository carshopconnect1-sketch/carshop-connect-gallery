import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {filterCases,emptyFilters} from '../public/filter.js';
import {findSeries} from '../public/series-data.js';
const read=async name=>JSON.parse(await readFile(new URL('../'+name,import.meta.url),'utf8'));
const data=await read('public/data/catalog.json');
const audit=await read('audit/data-extraction.json');
test('every retained source record is accounted for; IDs and detail files are consistent',async()=>{
 assert.equal(audit.rawRecords+audit.importedRecords,data.cases.length+audit.deduplicated+audit.excluded.reduce((n,x)=>n+x.count,0));
 assert.equal(new Set(data.cases.map(x=>x.id)).size,data.cases.length);
 for(const c of data.cases){
  assert.match(c.id,/^[a-f0-9]{12}$/);const detail=await read(`public/data/details/${c.id}.json`);
  assert.equal(detail.images.length,c.photoCount);assert.equal(detail.images[0],c.image);
  assert.equal(c.hasReview,!!detail.review.trim());assert.ok(['seatcover','panel'].includes(c.category));
  for(const s of detail.images){const u=new URL(s);assert.equal(u.protocol,'https:');assert.ok(!u.username&&!u.password);}
 }
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
