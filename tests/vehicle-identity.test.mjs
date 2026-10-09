import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canonicalVehicle,fitmentVehicleMatches} from '../public/vehicle-identity.js';
import {emptyFilters,filterCases,facet,readFilters} from '../public/filter.js';
import {carChoices} from '../public/finder-state.js';
import {productLink} from '../public/product-link.js';
const audit=JSON.parse(await readFile(new URL('../audit/vehicle-identity-2026-10-06.json',import.meta.url)));
const catalog=JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url)));

test('all reviewed spelling groups share a facet, old URL and selected-car count',()=>{
 for(const group of audit.groups){
  const names=group.before.map(v=>v.car);
  const fixture=names.map((car,index)=>({id:String(index),maker:group.maker,car,brand:'Sandii',colors:[]}));
  for(const car of names){
   assert.equal(canonicalVehicle(group.maker,car),group.car,car);
   const state=readFilters(new URLSearchParams({maker:group.maker,car}));
   assert.equal(state.car,group.car);
   assert.equal(filterCases(fixture,state).length,names.length,car);
   assert.deepEqual(carChoices(fixture,state),[{name:group.car,count:names.length}],car);
  }
  assert.deepEqual(facet(fixture,{...emptyFilters(),maker:group.maker},'car'),[[group.car,names.length]]);
  const existing=group.caseIds.filter(id=>catalog.cases.some(item=>item.id===id));
  const found=new Set(filterCases(catalog.cases,{...emptyFilters(),maker:group.maker,car:group.car}).map(item=>item.id));
  for(const id of existing)assert.ok(found.has(id),`${group.car}: lost ${id}`);
 }
});

test('old English, abbreviated and typo queries find the entire canonical group',()=>{
 for(const group of audit.groups){
  const fixture=[{maker:group.maker,car:group.car,colors:[]}];
  for(const {car} of group.before){
   assert.equal(carChoices(fixture,{...emptyFilters(),maker:group.maker},car)[0]?.name,group.car,car);
   assert.equal(filterCases(fixture,{...emptyFilters(),q:car}).length,1,car);
  }
 }
});

test('vehicle variants remain distinct and never share fitment by name',()=>{
 for(const names of audit.keepSeparate)for(const left of names)for(const right of names){
  if(left===right)continue;
  assert.notEqual(canonicalVehicle('',left),canonicalVehicle('',right),`${left}/${right}`);
  assert.equal(fitmentVehicleMatches(left,right),false,`${left}/${right}`);
 }
 assert.equal(canonicalVehicle('トヨタ','ソリオバンデット'),'ソリオバンデット');
});

test('renamed vehicles keep the audited category destination and ambiguous mappings stay unresolved',()=>{
 for(const group of audit.groups){
  const urls=[...new Set(group.before.map(v=>catalog.vehicleProductLinks[`${group.maker}|${v.car}`]).filter(Boolean))];
  if(urls.length!==1)continue;
  assert.equal(productLink({maker:group.maker,car:group.car},'',catalog.vehicleProductLinks).url,urls[0],group.car);
 }
 assert.equal(productLink({maker:'BMW',car:'BMW 3シリーズ'},'',{'BMW|BMW3Series':'https://example.com/a','BMW|BMW3シリーズ':'https://example.com/b'}).url,'https://seatcover.jp/f/carlist_renewal.html');
 assert.equal(productLink({maker:'BMW',car:'BMW 3シリーズ'},'https://example.com/product',catalog.vehicleProductLinks).url,'https://example.com/product');
 assert.equal(productLink({maker:'BMW',car:'BMW 3シリーズ'},'',catalog.vehicleProductLinks,'identity_unresolved').url,'https://seatcover.jp/f/match_renewal');
});

test('two copied metadata sets agree with the original photo-matched official posts',async()=>{
 for(const entry of audit.metadataCorrections){
  const detail=JSON.parse(await readFile(new URL(`../public/data/details/${entry.caseId}.json`,import.meta.url)));
  assert.deepEqual(detail.images,entry.verifiedImages);
  assert.deepEqual(detail.photoInfo,entry.photoInfo,entry.caseId);
  assert.deepEqual(detail.originalPhotoInfo,entry.originalPhotoInfo);
  assert.equal(detail.vehicleMetadataSource.url,entry.sourceUrl);
 }
});
