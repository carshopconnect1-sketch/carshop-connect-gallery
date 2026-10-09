const newPeriod=30*24*60*60*1000;

export function isNewCase(item,at=Date.now()){
  const first=Date.parse(item.firstPublishedAt);
  const age=at-first;
  return Number.isFinite(first)&&age>=0&&age<newPeriod;
}
