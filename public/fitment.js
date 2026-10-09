import {canonicalVehicle,fitmentVehicleMatches} from './vehicle-identity.js';
const codeKey=value=>String(value||'').normalize('NFKC').trim().toUpperCase();
const group=brand=>['Refinad','Sandii','Refinad/Sandii'].includes(brand)?'Refinad/Sandii':brand;
const rowFields=['car','year','yearStart','yearEnd','model','grade','seats'];
const safeRow=row=>Object.fromEntries(rowFields.filter(k=>row[k]!==undefined).map(k=>[k,row[k]]));

export function formatFitmentPeriod(row) {
  const month=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.slice(0,7).replace('-','/'):'';
  const start=month(row.yearStart),end=month(row.yearEnd);
  return start||end?`${start} ～ ${end}`.trim():'';
}

export function createFitmentResolver(snapshot) {
  const byCode=new Map();
  const records=Array.isArray(snapshot.records)?snapshot.records:
    Object.values(snapshot.cases||{}).flatMap(v=>(v.rows||[]).map(row=>({...row,car:row.car||v.car,code:v.code,group:group(v.brand)})));
  for(const row of records){
    const k=`${group(row.group)}|${codeKey(row.code)}`;
    if(!byCode.has(k))byCode.set(k,[]);
    byCode.get(k).push(row);
  }
  return (item,detail)=>{
    if(item.category!=='seatcover')return null;
    const codes=[...new Set((detail?.photoInfo||[]).map(v=>codeKey(v?.['品番'])).filter(Boolean))];
    if(codes.length!==1)return null;
    const candidates=byCode.get(`${group(item.brand)}|${codes[0]}`)||[];
    const unique=new Map();
    for(const row of candidates.filter(v=>fitmentVehicleMatches(item.car,v.car))){
      const safe=safeRow(row);unique.set(JSON.stringify(safe),safe);
    }
    if(!unique.size)return null;
    return {brand:item.brand,car:canonicalVehicle(item.maker,item.car),code:codes[0],rows:[...unique.values()]};
  };
}
