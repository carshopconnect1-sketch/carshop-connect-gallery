import {emptyFilters, facet, filterCases, normalize, colorOptions} from './filter.js';
import {findSeries} from './series-data.js';

export const conditionLabels={q:'キーワード',maker:'メーカー',car:'車種',brand:'ブランド',category:'カテゴリ',series:'シリーズ',color:'色',colorName:'色名',review:'コメント'};
export function conditionText(filters,key){
  const value=filters[key];
  if(key==='review')return 'コメントあり';
  if(key==='color')return colorOptions.find(([id])=>id===value)?.[1]||value;
  if(key==='series')return findSeries(filters.brand,value)?.label||value;
  if(key==='category')return value==='panel'?'インテリアパネル':'シートカバー';
  return value;
}
export function removeCondition(filters,key){
  const next={...filters,[key]:key==='review'?false:''};
  if(key==='maker')next.car='';
  if(key==='brand'){next.series='';next.colorName='';}
  if(key==='color')next.colorName='';
  return next;
}
export function recoveryOptions(cases,filters){
  const seen=new Set();const options=[];
  for(const key of ['q','colorName','color','series','car','maker','brand','category','review']){
    if(!filters[key])continue;
    const next=removeCondition(filters,key);const signature=JSON.stringify(next);
    if(seen.has(signature))continue;seen.add(signature);
    const count=filterCases(cases,next).length;
    if(count)options.push({key,next,count,label:`${conditionLabels[key]}「${conditionText(filters,key)}」を外す`});
  }
  return options.slice(0,3);
}
export function carChoices(cases,filters,query=''){
  const all=facet(cases,{...emptyFilters(),maker:filters.maker},'car');
  const counts=new Map(facet(cases,{...filters,car:''},'car'));
  if(filters.car&&!all.some(([name])=>name===filters.car))all.push([filters.car,0]);
  const search=normalize(query);
  return all.filter(([name])=>normalize(name).includes(search)).map(([name])=>({name,count:counts.get(name)||0}));
}
