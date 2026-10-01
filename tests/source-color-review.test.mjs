import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {emptyFilters,filterCases} from '../public/filter.js';

const read=async file=>JSON.parse(await readFile(new URL('../'+file,import.meta.url),'utf8'));
const catalog=await read('public/data/catalog.json');
const review=await read('audit/yellow-color-review-2026-10-01.json');

test('the beige Spacia is excluded from yellow and included in beige',async()=>{
 const item=catalog.cases.find(c=>c.id==='e2d0548abb55');
 assert.equal(item.colorName,'ベージュ');
 assert.deepEqual(item.colors,['beige']);
 const filters={...emptyFilters(),brand:'Sandii',series:'カヌレ'};
 assert.ok(!filterCases(catalog.cases,{...filters,color:'yellow'}).some(c=>c.id===item.id));
 assert.ok(filterCases(catalog.cases,{...filters,color:'beige'}).some(c=>c.id===item.id));
 const detail=await read(`public/data/details/${item.id}.json`);
 assert.match(detail.colorSource,/公式装着ページのカラー欄/);
 assert.equal(detail.sourceMetadata.officialColor,'ベージュA701');
 assert.equal(detail.originalAlt,'スペーシア Sandii カヌレ マスタード シートカバー装着写真');
 assert.equal(detail.photoInfo[0]['品番'],'S0361-09');
 const fitment=await read('public/data/fitment.json');
 assert.equal(fitment.cases[item.id].code,'S0361-09');
 assert.ok(fitment.cases[item.id].rows.every(row=>row.model.includes('MK94S')));
});

test('all reviewed yellow cases retain the exact official photos and photo code',async()=>{
 assert.equal(review.entries.length,32);
 for(const entry of review.entries){
  const item=catalog.cases.find(c=>c.id===entry.caseId);
  const detail=await read(`public/data/details/${item.id}.json`);
  assert.equal(new URL(entry.sourceUrl).hostname,'sandii.net');
  assert.deepEqual(detail.images,entry.verifiedImages,item.id);
  assert.ok(detail.photoInfo.length);
  assert.ok(detail.photoInfo.every(info=>info['品番']===entry.officialCode),item.id);
  assert.ok(entry.colorNames.includes(item.colorName),item.id);
 }
 const corrected=catalog.cases.find(c=>c.id==='eb70dd87dd6e');
 assert.equal(corrected.car,'ワゴンＲスマイル');
 const detail=await read(`public/data/details/${corrected.id}.json`);
 assert.equal(detail.productUrl,'https://seatcover.jp/c/suzuki/wagonrsmile/sandii-bc00561');
});
