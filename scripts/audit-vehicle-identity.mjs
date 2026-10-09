import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {emptyFilters,filterCases,facet,readFilters} from '../public/filter.js';
import {carChoices} from '../public/finder-state.js';
import {canonicalVehicle} from '../public/vehicle-identity.js';
import {lifestyleThemes} from '../public/lifestyle-data.js';
const root=new URL('../',import.meta.url);
const before=JSON.parse(await readFile(new URL('.preview/vehicle-identity-20261006/before-catalog.json',root)));
const response=await fetch('http://127.0.0.1:4180/api/gallery/catalog');
assert.equal(response.status,200);
const catalog=await response.json();
const audit=JSON.parse(await readFile(new URL('audit/vehicle-identity-2026-10-06.json',root)));
const cases=catalog.cases;
assert.equal(cases.length,before.cases.length,'case loss');
const prior=new Map(before.cases.map(item=>[item.id,item]));
const changedLabels=[];
for(const item of cases){
 const old=prior.get(item.id);assert.ok(old,`new or changed ID ${item.id}`);
 const {car:beforeCar,...beforeFields}=old,{car:afterCar,...afterFields}=item;
 assert.deepEqual(afterFields,beforeFields,`unexpected non-vehicle change ${item.id}`);
 if(beforeCar!==afterCar)changedLabels.push({id:item.id,maker:item.maker,from:beforeCar,to:afterCar});
 assert.equal(afterCar,canonicalVehicle(item.maker,beforeCar));
}
const makers=[...new Set(cases.map(item=>item.maker))];
const choiceChecks=[];
for(const maker of makers){
 for(const option of carChoices(cases,{...emptyFilters(),maker})){
  const filters={...emptyFilters(),maker,car:option.name};
  const count=filterCases(cases,filters).length;
  assert.equal(option.count,count,`${maker}/${option.name}`);
  for(const brand of ['Refinad','Sandii','Dotty','IXUS']){
   const state={...filters,brand};
   assert.equal(carChoices(cases,state).find(v=>v.name===option.name)?.count,filterCases(cases,state).length);
  }
  choiceChecks.push({maker,car:option.name,count});
 }
}
const oldNames=[...new Map(before.cases.filter(v=>v.carKnown!==false).map(v=>[`${v.maker}|${v.car}`,{maker:v.maker,car:v.car}])).values()];
for(const old of oldNames){
 const state=readFilters(new URLSearchParams(old));
 const option=choiceChecks.find(v=>v.maker===old.maker&&v.car===state.car);
 assert.ok(option,`lost old URL: ${old.maker}/${old.car}`);
 assert.equal(filterCases(cases,state).length,option.count);
}
for(const group of audit.groups){
 const found=filterCases(cases,{...emptyFilters(),maker:group.maker,car:group.car});
 assert.equal(found.length,group.expectedCount,group.car);
 assert.deepEqual(found.map(v=>v.id).sort(),[...group.caseIds].sort());
}
const editorial=[];
for(const id of catalog.featuredIds){
 const item=cases.find(v=>v.id===id);assert.ok(item,`missing featured ${id}`);
 const count=filterCases(cases,{...emptyFilters(),maker:item.maker,car:item.car}).length;
 assert.equal(count,choiceChecks.find(v=>v.maker===item.maker&&v.car===item.car)?.count);
 editorial.push({id,car:item.car,count});
}
const lifestyle=[];
for(const theme of lifestyleThemes)for(const pick of theme.picks){
 const result=filterCases(cases,{...emptyFilters(),...pick.filters});assert.ok(result.length,`${theme.id}/${pick.car}`);
 if(pick.scope==='vehicle')assert.equal(result.length,choiceChecks.find(v=>v.maker===pick.filters.maker&&v.car===canonicalVehicle(pick.filters.maker,pick.filters.car||pick.car))?.count);
 lifestyle.push({theme:theme.id,car:pick.car,count:result.length,scope:pick.scope||'combination'});
}
// Independent base-detail snapshots cover old installations; IDs and photo
// counts cover every publication, including the shared CMS records.
const savedDetails=JSON.parse(await readFile(new URL('.preview/migration-check-20261005/local-details.json',root)));
const detailBaseline=Object.fromEntries(savedDetails.map(v=>[v.id,v.detail]));
const permitted=new Set(audit.metadataCorrections.map(v=>v.caseId));
const comparedFields=['images','review','productUrl','photoInfo','alt','productLinkStatus','productLinkReason'];
const detailChanges=[];let checkedDetails=0;
for(let index=0;index<cases.length;index+=32){
 const batch=await Promise.all(cases.slice(index,index+32).map(async item=>{
  const response=await fetch(`http://127.0.0.1:4180/api/gallery/details/${item.id}`);
  assert.equal(response.status,200,item.id);const detail=await response.json();
  assert.equal(detail.images.length,item.photoCount,item.id);
  const baseline=detailBaseline[item.id];
  if(baseline){
   // The Oct 5 rebuild also added provenance-only sourceCorrection notes.
   // Compare all customer-facing content and link decisions, not object order.
   const original=Object.fromEntries(comparedFields.map(key=>[key,baseline[key]]));
   const current=Object.fromEntries(comparedFields.map(key=>[key,detail[key]]));
   const changed=!isDeepStrictEqual(original,current);
   if(changed){
    assert.ok(permitted.has(item.id),`unexpected detail change ${item.id}`);
    const {photoInfo:p1,...a}=original;
    const {photoInfo:p2,...b}=current;
    assert.deepEqual(b,a,item.id);detailChanges.push(item.id);
   }
  }
  return item.id;
 }));checkedDetails+=batch.length;
}
const result={checkedAt:new Date().toISOString(),caseCount:cases.length,previousVehicleChoices:oldNames.length,
 vehicleChoices:choiceChecks.length,aliasGroupsFixed:audit.groups.length,changedLabels,choiceChecks,
 oldUrlsChecked:oldNames.length,brandFilteredChoiceChecks:choiceChecks.length*4,editorial,lifestyle,
 detailApisChecked:checkedDetails,permittedDetailChanges:detailChanges,unexpectedChanges:0,
 limits:['車種未記載の旧IXUS事例は車種候補・車種別の照合対象外。','世代・車体・ハイブリッド・定員の明示区分は保持。','原写真404の旧ムーヴキャンバス1事例の移行保留は別件として継続。']};
await writeFile(new URL('audit/vehicle-identity-verification-2026-10-06.json',root),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({caseCount:result.caseCount,vehicleChoices:result.vehicleChoices,aliasGroupsFixed:result.aliasGroupsFixed,
 oldUrlsChecked:result.oldUrlsChecked,brandFilteredChoiceChecks:result.brandFilteredChoiceChecks,
 editorialLinks:editorial.length,lifestyleLinks:lifestyle.length,detailApisChecked:checkedDetails,
 changedLabels:changedLabels.length,permittedDetailChanges:detailChanges,unexpectedChanges:0},null,2));
