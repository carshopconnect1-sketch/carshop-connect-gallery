import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {emptyFilters,filterCases} from '../public/filter.js';

const read=async file=>JSON.parse(await readFile(new URL('../'+file,import.meta.url),'utf8'));
const catalog=await read('public/data/catalog.json');
const review=await read('audit/all-color-review-2026-10-02.json');

test('confirmed color corrections move the actual cases between color families',async()=>{
 for(const entry of review.entries.filter(e=>e.correction)){
  const item=catalog.cases.find(c=>c.id===entry.caseId);
  assert.equal(item.colorName,entry.correction.colorName,item.id);
  assert.deepEqual(item.colors,entry.correction.colors,item.id);
  for(const color of entry.savedColors.filter(c=>!item.colors.includes(c)))
   assert.ok(!filterCases(catalog.cases,{...emptyFilters(),color}).some(c=>c.id===item.id),item.id);
  for(const color of item.colors)
   assert.ok(filterCases(catalog.cases,{...emptyFilters(),color}).some(c=>c.id===item.id),item.id);
  const detail=await read(`public/data/details/${item.id}.json`);
  assert.deepEqual(detail.images,entry.verifiedImages);
  assert.equal(detail.colorReview.url,entry.sourceUrl);
  assert.deepEqual(detail.colorReview.colorFields,entry.colorFields);
 }
 assert.equal(review.confirmedCorrections,14);
});

test('the corrected Macaron photo opens the Smile product and its matching fitment',async()=>{
 const item=catalog.cases.find(c=>c.id==='db14494a0265');
 const detail=await read(`public/data/details/${item.id}.json`);
 const fitment=await read('public/data/fitment.json');
 assert.equal(item.car,'ワゴンＲスマイル');
 assert.equal(detail.productUrl,'https://seatcover.jp/c/suzuki/wagonrsmile/sandii-mc00561');
 assert.equal(detail.photoInfo[0]['品番'],'S0561-01');
 assert.equal(fitment.cases[item.id].code,'S0561-01');
 assert.ok(fitment.cases[item.id].rows.every(row=>row.model.includes('MX81S')||row.model.includes('MX91S')));
});

test('the four previously pending photos use user-confirmed names and color families',async()=>{
 const confirmed=[['59a755160844','ミッドオレンジ','orange'],['615e38a9ff54','ダークブラウン','brown'],
  ['24eb4b9aaa35','ビンテージ','blue'],['b325a85665c8','ボルドー','red']];
 for(const [id,name,color] of confirmed){
  const item=catalog.cases.find(c=>c.id===id);
  const entry=review.entries.find(e=>e.caseId===id);
  const detail=await read(`public/data/details/${id}.json`);
  assert.equal(item.colorName,name);
  assert.deepEqual(item.colors,[color]);
  assert.equal(entry.decision,'user_confirmed');
  assert.equal(detail.colorSource,'ユーザー確認（同一写真を提示して色名を確認）');
  assert.equal(detail.colorReview.userConfirmation.colorName,name);
  assert.deepEqual(detail.photoInfo,entry.savedPhotoInfo);
 }
 assert.equal(review.pendingPaletteReviews,0);
 assert.equal(review.pendingSourceReviews,0);
 assert.equal(review.catalogCases,catalog.cases.length);
 assert.equal(Object.values(review.coverage).reduce((n,row)=>n+Object.values(row).reduce((a,b)=>a+b,0),0),catalog.cases.length);
});

test('contradictory official Dayz metadata cannot replace the installed orange color or photo code',async()=>{
 const item=catalog.cases.find(c=>c.id==='59a755160844');
 const detail=await read(`public/data/details/${item.id}.json`);
 assert.equal(item.colorName,'ミッドオレンジ');
 assert.deepEqual(item.colors,['orange']);
 assert.equal(detail.photoInfo[0]['品番'],'MI0373-02');
 assert.equal(detail.colorReview.userConfirmation.colorName,'ミッドオレンジ');
 assert.equal(detail.colorReview.colorFields['カラー1'],'S02ビターショコラ');
 assert.equal(review.entries.find(e=>e.caseId===item.id).decision,'user_confirmed');
});
