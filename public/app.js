import {mountLifestyle} from './lifestyle.js';
import {emptyFilters, filterCases, facet, readFilters, filtersToParams, colorOptions} from './filter.js';
import {seriesCatalog, findSeries} from './series-data.js';
import {makerCatalog} from './maker-data.js';
import {conditionLabels,conditionText,removeCondition,recoveryOptions,carChoices} from './finder-state.js';
import {mountPhotoStory} from './photo-story.js';
import {vehicleImageCandidates} from './vehicle-images.js';
import {productLink as resolveProductLink} from './product-link.js';

const $ = id => document.getElementById(id);
const number = n => n.toLocaleString('ja-JP');
const pageSize = 18;
let cases = [], filtered = [], shown = 0, vehicleProductUrls = {}, vehicleProductLinks = {}, filters = readFilters(new URLSearchParams(location.search));
let makerRegion = makerCatalog.find(m=>m.name===filters.maker)?.region || 'domestic';
let activePanel=filters.brand?'brand':filters.color||filters.colorName?'color':'vehicle';
let dockFrame=0;
let detailAbort, activeDetail = null, photoIndex = 0;
const detailCache = new Map();
const photoIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="15" height="15" rx="2"/><path d="M17 3H4a1 1 0 0 0-1 1v13"/></svg>';
function el(tag, cls, text) {const e = document.createElement(tag); if(cls)e.className=cls; if(text!==undefined)e.textContent=text; return e;}
function link(text, url, cls) {const a=el('a',cls,text);a.href=url;a.target='_blank';a.rel='noopener';return a;}
function productLink(item, directUrl='') {
  return resolveProductLink(item,directUrl,vehicleProductLinks);
}
function image(src, alt, eager=false) {
  const img = el('img');img.src=src;img.alt=alt;img.loading=eager?'eager':'lazy';img.decoding='async';
  img.addEventListener('error',()=>{const fallback=el('span','image-unavailable','写真を読み込めませんでした');fallback.setAttribute('role','img');fallback.setAttribute('aria-label',alt+'（画像を読み込めませんでした）');img.replaceWith(fallback);},{once:true});
  return img;
}
function card(item) {
  const b=el('button','photo-card');b.type='button';b.dataset.id=item.id;
  b.setAttribute('aria-label',`${item.car} / ${item.brand} ${item.series} / 装着写真${item.photoCount}枚を見る`);
  const picture=el('div','card-image');picture.append(image(item.thumbnail||item.image,`${item.car} ${item.brand} ${item.series}の装着写真`));
  const count=el('span','photo-count');count.innerHTML=photoIcon;count.append(document.createTextNode(item.photoCount+'枚'));
  picture.append(count,el('span','card-open','↗'));
  const body=el('div','card-content');const top=el('div','card-topline');top.append(el('span','card-brand',item.brand),el('span','',item.maker));
  body.append(top,el('h3','',item.car),el('p','card-series',item.series));
  if(item.colorName)body.append(el('p','card-color',item.colorName));
  if(item.hasReview)body.append(el('p','card-extra','掲載コメントあり'));
  else if(item.category==='panel')body.append(el('p','card-extra','インテリアパネル'));
  b.append(picture,body);b.addEventListener('click',()=>openDetail(item));return b;
}
function updateOptions(key, allLabel) {
  const input=$(key);const entries=facet(cases,filters,key);const current=filters[key];
  input.replaceChildren(new Option(allLabel,''));
  for(const [value,n]of entries){if(value)input.add(new Option(`${value} (${number(n)})`,value));}
  if(current&&!entries.some(([v])=>v===current))input.add(new Option(`${current} (0)`,current));
  input.value=current;
}
function renderFilters() {
  updateOptions('colorName','色名は指定しない');
  $('category').value=filters.category;$('reviewOnly').checked=filters.review;$('keyword').value=filters.q;
  const currentFocus=document.activeElement?.dataset.brand;
  const brandFilters={...filters,series:'',colorName:''};
  const brandCounts=new Map(facet(cases,brandFilters,'brand'));
  const brands=['Refinad','Sandii','Dotty','IXUS'];
  const brandNames={Refinad:'レフィナード',Sandii:'サンディ',Dotty:'ダティ',IXUS:'イクサス'};
  $('brandTabs').replaceChildren(...brands.map(brand=>{
    const b=el('button','brand-choice');b.type='button';b.dataset.brand=brand;b.setAttribute('aria-pressed',String(filters.brand===brand));
    const n=brand===filters.brand?filtered.length:brandCounts.get(brand)||0;
    b.setAttribute('aria-label',`${brand}で探す ${number(n)}件`);
    const name=el('span','brand-logo-wrap');
    const logo=el('img','brand-logo');logo.src=`/assets/brands/brand-${brand.toLowerCase()}.jpg`;logo.alt=brand;logo.width=480;logo.height=270;logo.decoding='async';name.append(logo);
    b.append(name,el('span','brand-reading',brandNames[brand]),el('small','brand-count',number(n)+'件'));
    b.addEventListener('click',()=>commit(filters.brand===brand?removeCondition(filters,'brand'):{...filters,brand,series:'',colorName:''}));return b;
  }));
  if(currentFocus!==undefined)[...$('brandTabs').children].find(b=>b.dataset.brand===currentFocus)?.focus({preventScroll:true});
  renderMakers();renderCars();renderSeries();renderColors();
  const chips=[];
  for(const [key,value]of Object.entries(filters))if(value){
    const text=conditionText(filters,key);
    const chip=el('button','',text);chip.type='button';chip.setAttribute('aria-label',`${conditionLabels[key]}：${text}の条件を解除`);chip.append(el('span','','×'));
    chip.addEventListener('click',()=>{commit(removeCondition(filters,key));focusSelection();});chips.push(chip);
  }
  $('selectedFilters').replaceChildren(...chips);
  $('filterOverview').hidden=!chips.length&&!!filtered.length;
  $('resetAll').disabled=!chips.length;
  renderFinderSummary();renderRecovery();scheduleFinderAction();
}
function renderMakers(){
  const focused=document.activeElement?.dataset.maker;
  const counts=new Map(facet(cases,{...filters,car:''},'maker'));
  document.querySelectorAll('[data-maker-region]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.makerRegion===makerRegion)));
  $('makerGrid').replaceChildren(...makerCatalog.filter(m=>m.region===makerRegion).map(m=>{
    const b=el('button','maker-choice');b.type='button';b.dataset.maker=m.name;
    const active=filters.maker===m.name;const n=active?filtered.length:counts.get(m.name)||0;
    b.setAttribute('aria-pressed',String(active));b.setAttribute('aria-label',`${m.name}で絞り込む ${number(n)}件`);b.disabled=!n&&!active;
    const circle=el('span','maker-logo-wrap');const logo=el('img');logo.src=`/assets/makers/maker-${m.slug}.webp`;logo.alt='';logo.width=160;logo.height=160;logo.decoding='async';circle.append(logo);
    b.append(circle,el('span','maker-name',m.name),el('small','maker-count',`${number(n)}件`));
    b.addEventListener('click',()=>{$('carSearch').value='';commit({...filters,maker:active?'':m.name,car:''});});return b;
  }));
  if(focused!==undefined)[...$('makerGrid').children].find(b=>b.dataset.maker===focused)?.focus({preventScroll:true});
}
function renderCars(){
  $('carChooser').hidden=!filters.maker&&!filters.car;
  if($('carChooser').hidden){$('carOptions').replaceChildren();return;}
  $('carTitle').textContent=filters.maker?`${filters.maker}の車種を選ぶ`:'車種を選ぶ';
  const focused=document.activeElement?.dataset.car;
  const choices=carChoices(cases,filters,$('carSearch').value);
  const previousScroll=$('carOptions').scrollTop;
  $('carOptions').replaceChildren(...choices.map(({name,count})=>{
    const b=el('button','car-choice');b.type='button';b.dataset.car=name;
    const active=filters.car===name;b.setAttribute('aria-pressed',String(active));b.disabled=!count&&!active;
    b.setAttribute('aria-label',`${name}を選ぶ ${number(count)}件`);
    const allVehicleCases=cases.filter(item=>item.carKnown!==false&&item.car===name&&(!filters.maker||item.maker===filters.maker));
    const matchingVehicleCases=filterCases(allVehicleCases,{...filters,car:name});
    const visualCases=matchingVehicleCases.length?matchingVehicleCases:allVehicleCases;
    const fallbackItem=visualCases.find(item=>item.thumbnail||item.image)||allVehicleCases[0];
    const sources=vehicleImageCandidates(visualCases.length?visualCases:allVehicleCases,vehicleProductUrls);
    const visual=el('span','car-choice-visual');const carImage=el('img');carImage.alt=`${name}の車種画像`;carImage.loading='lazy';carImage.decoding='async';
    let sourceIndex=0;let fallback=fallbackItem?.thumbnail||fallbackItem?.image||'';
    const loadNext=()=>{if(sourceIndex<sources.length){carImage.src=sources[sourceIndex++];return;}if(fallback){carImage.classList.add('is-gallery-image');carImage.src=fallback;fallback='';return;}carImage.remove();visual.append(el('span','car-choice-no-image','IMAGE'))};
    carImage.addEventListener('error',loadNext);loadNext();visual.append(carImage,el('span','car-choice-check',active?'✓':''));
    const body=el('span','car-choice-body');body.append(el('span','car-choice-name',name),el('small','car-choice-count',`${number(count)}件`));
    b.append(visual,body);
    b.addEventListener('click',()=>commit({...filters,car:active?'':name}));return b;
  }));
  $('carOptions').scrollTop=previousScroll;
  if(focused!==undefined)[...$('carOptions').children].find(b=>b.dataset.car===focused)?.focus({preventScroll:true});
  $('carCandidateStatus').textContent=`選べる車種：${choices.filter(c=>c.count>0).length}車種${filters.car?' / 選択中：'+filters.car:''}`;
  const available=choices.some(c=>c.count);
  $('carOptions').hidden=!available&&!filters.car;
  $('noCarCandidates').hidden=!!choices.length&&(available||!!filters.car);
  $('noCarCandidates').textContent=!choices.length?'候補がありません。短い名前で探すか、入力を消してみてください。':'今の条件では、選べる車種がありません。メーカーだけで写真を見るか、ブランド・色の条件を見直してください。';
}
function setPanel(panel,{focus=false,scroll=false}={}){
  activePanel=panel;
  document.querySelectorAll('[data-panel]').forEach(b=>{
    const active=b.dataset.panel===panel;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;
    $(`panel-${b.dataset.panel}`).hidden=!active;
  });
  if(focus)$(`tab-${panel}`).focus({preventScroll:true});
  if(scroll)$('filterWorkbench').scrollIntoView({block:'start',behavior:'instant'});
  scheduleFinderAction();
}
function renderFinderSummary(){
  const selected=Object.keys(filters).filter(key=>filters[key]);
  const summary=selected.map(key=>conditionText(filters,key)).join(' / ');
  const panels={vehicle:['maker','car'],brand:['brand','series'],color:['color','colorName'],other:['category','review']};
  for(const [panel,keys]of Object.entries(panels)){
    const chosen=keys.filter(key=>filters[key]);
    $(`tab-${panel}`).classList.toggle('has-selection',!!chosen.length);
  }
  $('resultsSummary').textContent=summary||'すべての装着写真';
  $('inlineCount').textContent=filtered.length?`${number(filtered.length)}件の装着写真が見つかりました`:'条件に合う写真がありません';
  $('showPhotos').textContent=filtered.length?`${number(filtered.length)}件の写真を見る ↓`:'条件を見直す ↑';
}
function renderRecovery(){
  $('filterFeedback').hidden=!!filtered.length;
  const options=filtered.length?[]:recoveryOptions(cases,filters);
  for(const id of ['recoveryOptions','emptyRecoveryOptions']){
    $(id).replaceChildren(...options.map(option=>{
      const b=el('button','',`${option.label} → ${number(option.count)}件`);b.type='button';
      b.addEventListener('click',()=>{commit(option.next);if(id==='emptyRecoveryOptions')showPhotos();});return b;
    }));
    if(!filtered.length&&!options.length)$(id).append(el('span','recovery-hint','複数の条件が重なっています。選択中の条件を減らすか、すべて解除してください。'));
  }
}
function focusSelection(){($('filterOverview').hidden?$('filterWorkbench'):$('filterOverview')).focus({preventScroll:true});}
function editFilters(){setPanel(activePanel,{focus:true,scroll:true});}
function showPhotos(){
  const target=filtered.length?$('photoResults'):$('filterOverview');
  target.scrollIntoView({block:'start',behavior:'instant'});target.focus({preventScroll:true});scheduleFinderAction();
}
function openVehicleGallery(next, url){
  $('carSearch').value='';
  commit(next,false);
  setPanel('vehicle');
  $('keywordSearch').hidden=true;$('keywordToggle').setAttribute('aria-expanded','false');
  $('exactColorDetails').open=false;
  if(url!==location.pathname+location.search+location.hash)window.history.pushState(null,'',url);
  showPhotos();
}
function scheduleFinderAction(){
  if(dockFrame)return;
  dockFrame=requestAnimationFrame(()=>{
    dockFrame=0;
    const workbench=$('filterWorkbench').getBoundingClientRect();
    const slot=$('finderSubmit').getBoundingClientRect();
    const floating=workbench.top<$('storeHeader').getBoundingClientRect().bottom+20&&slot.top>innerHeight-88;
    $('finderAction').classList.toggle('is-floating',floating);
  });
}
function renderColors(){
  const focus=document.activeElement?.dataset.color;
  const context={...filters,color:'',colorName:''};
  const counts=new Map(facet(cases,context,'color'));
  const scope=filterCases(cases,context);const known=scope.filter(c=>c.colorName).length;
  const all=el('button','color-swatch color-swatch-all');all.type='button';all.dataset.color='';
  all.setAttribute('aria-label','すべての色');all.setAttribute('aria-pressed',String(!filters.color&&!filters.colorName));
  all.append(el('span','swatch-disc'),el('span','color-label','すべて'),el('small','',number(scope.length)+'件'));
  all.addEventListener('click',()=>commit({...filters,color:'',colorName:''}));
  const buttons=colorOptions.map(([key,label,hex])=>{
    const b=el('button','color-swatch');b.type='button';b.dataset.color=key;
    const n=counts.get(key)||0;b.disabled=!n&&filters.color!==key;
    b.setAttribute('aria-label',`${label}系で探す ${number(n)}件`);b.setAttribute('aria-pressed',String(filters.color===key));
    const swatch=el('span','swatch-disc');swatch.style.setProperty('--swatch',hex);
    b.append(swatch,el('span','color-label',label),el('small','',number(n)+'件'));
    b.addEventListener('click',()=>commit({...filters,color:filters.color===key?'':key,colorName:''}));return b;
  });
  $('colorOptions').replaceChildren(all,...buttons);
  if(focus!==undefined)[...$('colorOptions').children].find(b=>b.dataset.color===focus)?.focus({preventScroll:true});
  $('colorStatus').textContent=known?`色名のある事例 ${number(known)}件`:'この条件の事例には色名の記載がありません';
  $('colorName').disabled=!known&&!filters.colorName;
}
function renderSeries(){
  $('seriesPicker').hidden=!filters.brand;
  if(!filters.brand){$('seriesGrid').replaceChildren();$('seriesOther').replaceChildren();return;}
  const focused=document.activeElement?.dataset.seriesId;
  const context={...filters,series:'',colorName:''};
  const scope=filterCases(cases,context);
  const counts=new Map();const totals=new Map();
  for(const item of cases){const s=findSeries(item.brand,item.series);if(s)totals.set(s.id,(totals.get(s.id)||0)+1);}
  for(const item of scope){const s=findSeries(item.brand,item.series);if(s)counts.set(s.id,(counts.get(s.id)||0)+1);}
  const choices=seriesCatalog.filter(s=>s.brand===filters.brand);
  $('seriesTitle').textContent=`${filters.brand}の全${choices.length}シリーズ`;
  // Stable ranking keeps cards in place while filters change.
  choices.sort((a,b)=>(totals.get(b.id)||0)-(totals.get(a.id)||0));
  const selected=findSeries(filters.brand,filters.series);
  $('seriesGrid').replaceChildren(...choices.map(s=>{
    const b=el('button','series-card');b.type='button';b.dataset.seriesId=s.id;
    const n=counts.get(s.id)||0;const active=selected?.id===s.id;
    b.disabled=!n&&!active;b.setAttribute('aria-pressed',String(active));
    b.setAttribute('aria-label',`${s.brand} ${s.label}で探す ${number(n)}件`);
    const visual=el('span','series-visual');const img=image(s.image,`${s.brand} ${s.label}の代表イメージ`);img.width=s.width;img.height=s.height;visual.append(img,el('span','series-check',active?'✓':''));
    const body=el('span','series-card-body');body.append(el('strong','series-card-name',s.label),el('span','series-card-count',n?`${number(n)}件の装着写真`:totals.get(s.id)?'この条件の写真はありません':'装着写真は準備中'));
    b.append(visual,body);b.addEventListener('click',()=>commit({...filters,brand:s.brand,series:active?'':s.values[0],colorName:''}));return b;
  }));
  if(focused!==undefined)[...$('seriesGrid').children].find(b=>b.dataset.seriesId===focused)?.focus({preventScroll:true});
  const legacy=new Map(facet(scope,emptyFilters(),'series').filter(([s])=>!findSeries(filters.brand,s)));
  $('seriesOther').replaceChildren(...[...legacy].map(([value,n])=>{
    const b=el('button','series-legacy',`${value} · ${number(n)}件`);b.type='button';b.setAttribute('aria-pressed',String(filters.series===value));b.addEventListener('click',()=>commit({...filters,series:filters.series===value?'':value}));return b;
  }));
  $('seriesOtherWrap').hidden=!legacy.size;
}
function updateResults() {
  filtered=filterCases(cases,filters);shown=0;$('photoGrid').replaceChildren();
  $('resultCount').textContent=number(filtered.length);$('emptyState').hidden=!!filtered.length;
  renderFilters();appendPage();
}
function appendPage() {
  const next=filtered.slice(shown,shown+pageSize);const fragment=document.createDocumentFragment();
  for(const item of next)fragment.append(card(item));$('photoGrid').append(fragment);shown+=next.length;
  $('shownCount').textContent=`${number(filtered.length)}件中 ${number(shown)}件を表示`;
  $('loadMoreWrap').hidden=!filtered.length;$('loadMore').hidden=shown>=filtered.length;
}
function commit(next,history=true) {
  if(next.maker!==filters.maker){makerRegion=makerCatalog.find(m=>m.name===next.maker)?.region||'domestic';$('carSearch').value='';$('carOptions').scrollTop=0;}
  filters=next;updateResults();
  if(history){const p=filtersToParams(filters).toString();const url=location.pathname+(p?'?'+p:'')+location.hash;if(url!==location.pathname+location.search+location.hash)window.history.pushState(null,'',url);}
}
function reset() {$('carSearch').value='';commit(emptyFilters());}
function mountControls(){
  mountLifestyle((next,url)=>openVehicleGallery({...emptyFilters(),...next},url),()=>{
    $('carSearch').value='';commit(emptyFilters());setPanel('vehicle',{focus:true,scroll:true});
  });
  $('filterForm').addEventListener('submit',e=>e.preventDefault());
  $('filterForm').addEventListener('change',e=>{const k=e.target.name;if(!k)return;const f={...filters,[k]:k==='review'?e.target.checked:e.target.value};if(k==='maker')f.car='';commit(f);});
  document.querySelectorAll('[data-maker-region]').forEach(b=>b.addEventListener('click',()=>{makerRegion=b.dataset.makerRegion;renderMakers();}));
  $('carSearch').addEventListener('input',()=>{$('carOptions').scrollTop=0;renderCars();});
  $('colorName').addEventListener('change',e=>commit({...filters,colorName:e.target.value}));
  $('searchForm').addEventListener('submit',e=>{e.preventDefault();commit({...filters,q:$('keyword').value.trim()});showPhotos();});
  $('keyword').addEventListener('search',()=>{if(!$('keyword').value)commit({...filters,q:''});});
  $('resetAll').addEventListener('click',()=>{reset();focusSelection();});
  $('resetEmpty').addEventListener('click',()=>{reset();showPhotos();});
  document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>setPanel(b.dataset.panel)));
  document.querySelectorAll('[data-edit-filters]').forEach(b=>b.addEventListener('click',editFilters));
  $('showPhotos').addEventListener('click',showPhotos);
  $('keywordSearch').hidden=!filters.q;$('keywordToggle').setAttribute('aria-expanded',String(!!filters.q));
  $('exactColorDetails').open=!!filters.colorName;
  $('keywordToggle').addEventListener('click',()=>{const open=$('keywordSearch').hidden;$('keywordSearch').hidden=!open;$('keywordToggle').setAttribute('aria-expanded',String(open));if(open)$('keyword').focus();});
  document.querySelector('.finder-tabs').addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    const tabs=[...document.querySelectorAll('[data-panel]')];const current=tabs.indexOf(e.target);if(current<0)return;e.preventDefault();
    const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(current+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    setPanel(tabs[next].dataset.panel,{focus:true});
  });
  window.addEventListener('scroll',scheduleFinderAction,{passive:true});window.addEventListener('resize',scheduleFinderAction);
  new ResizeObserver(scheduleFinderAction).observe($('filterWorkbench'));
  setPanel(activePanel);
  $('loadMore').addEventListener('click',()=>{const previous=shown;appendPage();$('photoGrid').children[previous]?.focus({preventScroll:true});});
  window.addEventListener('popstate',()=>commit(readFilters(new URLSearchParams(location.search)),false));
  $('closePhoto').addEventListener('click',()=>$('photoDialog').close());
  $('photoDialog').addEventListener('close',()=>{detailAbort?.abort();activeDetail=null;});
  $('photoDialog').addEventListener('click',e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.currentTarget.close();}});
  $('photoDialog').addEventListener('keydown',e=>{if(!activeDetail||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setPhoto(photoIndex+(e.key==='ArrowRight'?1:-1));}});
}
async function openDetail(item){
  detailAbort?.abort();const abort=new AbortController();detailAbort=abort;activeDetail=null;
  const wait=el('div','error-state');wait.append(el('h2','',item.car),el('p','','写真を読み込んでいます…'));wait.firstChild.id='detailCar';$('detailContent').replaceChildren(wait);
  if(!$('photoDialog').open)$('photoDialog').showModal();$('photoDialog').scrollTop=0;
  try{
    let detail=detailCache.get(item.id);
    if(!detail){const response=await fetch(`/data/details/${item.id}.json`,{signal:abort.signal});if(!response.ok)throw new Error('detail');detail=await response.json();if(!Array.isArray(detail.images)||!detail.images.length)throw new Error('images');detailCache.set(item.id,detail);}
    if(abort.signal.aborted)return;activeDetail={item,...detail};renderDetail();
  }catch(error){if(error.name==='AbortError')return;const state=el('div','error-state');const title=el('h2','',item.car);title.id='detailCar';state.append(title,el('p','','詳細を読み込めませんでした。'));const retry=el('button','secondary','もう一度読み込む');retry.addEventListener('click',()=>openDetail(item));state.append(retry);const fallback=productLink(item);if(fallback)state.append(link(fallback.label,fallback.url,'text-button'));$('detailContent').replaceChildren(state);}
}
function renderDetail(){
  const {item,images,review,productUrl,photoInfo}=activeDetail;
  const layout=el('div','detail-layout');const visual=el('div','detail-visual');const stage=el('div','detail-stage');stage.id='detailStage';
  const counter=el('p','detail-photo-count');counter.id='detailPhotoCount';counter.setAttribute('aria-live','polite');
  const thumbs=el('div','detail-thumbs');thumbs.id='detailThumbs';thumbs.setAttribute('aria-label','写真を選ぶ');
  for(const [index,url]of images.entries()){const b=el('button');b.type='button';b.setAttribute('aria-label',`写真${index+1}を表示`);b.append(image(url,`${item.car}の装着写真 ${index+1}`));b.addEventListener('click',()=>setPhoto(index));thumbs.append(b);}
  visual.append(stage,counter,thumbs);
  const meta=el('div','detail-meta');const title=el('h2','',item.car);title.id='detailCar';
  meta.append(el('p','detail-brand',item.brand),title,el('p','detail-series',item.series));
  const info=el('dl','detail-info');
  for(const [k,v]of [['メーカー',item.maker],['カテゴリ',item.category==='panel'?'インテリアパネル':'シートカバー']])info.append(el('dt','',k),el('dd','',v));
  if(item.colorName)info.append(el('dt','','掲載色名'),el('dd','',item.colorName));
  if(activeDetail.carNote)info.append(el('dt','','車種情報'),el('dd','',activeDetail.carNote));
  // Only source-provided fitment values. Never derive year/grade/colour from photos.
  if(Array.isArray(photoInfo))for(const key of ['型式','品番']){const values=[...new Set(photoInfo.map(row=>row?.[key]).filter(Boolean))];if(values.length===1)info.append(el('dt','',`掲載${key}`),el('dd','',String(values[0])));}
  meta.append(info);
  if(review)meta.append(el('h3','detail-review-title','掲載コメント'),el('p','detail-review',review));
  const destination=productLink(item,productUrl);const links=el('div','detail-links');
  if(destination){links.append(link(destination.label,destination.url,'primary'));meta.append(links);}
  meta.append(el('p','detail-fit-note','同じ車種でも年式・型式・グレードによって適合が異なります。購入前に必ず適合を確認してください。'));
  if(item.category==='seatcover')meta.append(link('車種・年式から適合を確認 ↗','https://seatcover.jp/f/match_renewal','text-button'));
  layout.append(visual,meta);$('detailContent').replaceChildren(layout);setPhoto(0);
}
function setPhoto(index){
  if(!activeDetail)return;const {images,item}=activeDetail;photoIndex=(index+images.length)%images.length;
  const img=image(images[photoIndex],`${item.car} ${item.brand} ${item.series}の装着写真 ${photoIndex+1}`,true);
  $('detailStage').replaceChildren(img);
  if(images.length>1)for(const [cls,label,delta,text]of [['photo-prev','前の写真',-1,'‹'],['photo-next','次の写真',1,'›']]){const b=el('button',`icon-button ${cls}`,text);b.type='button';b.setAttribute('aria-label',label);b.addEventListener('click',()=>{setPhoto(photoIndex+delta);$('detailStage').querySelector('.'+cls)?.focus({preventScroll:true});});$('detailStage').append(b);}
  $('detailPhotoCount').textContent=`${photoIndex+1} / ${images.length}`;
  [...$('detailThumbs').children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===photoIndex)));
}
async function start(){
  try{
    const response=await fetch('/data/catalog.json');if(!response.ok)throw new Error('catalog');const data=await response.json();cases=data.cases;vehicleProductUrls=data.vehicleProductUrls||{};vehicleProductLinks=data.vehicleProductLinks||{};
    if(!Array.isArray(cases)||!cases.length)throw new Error('empty');
    mountControls();mountPhotoStory(cases,data.featuredIds,openVehicleGallery);$('loading').hidden=true;
    $('totalCases').textContent=number(cases.length);$('totalCars').textContent=number(new Set(cases.filter(c=>c.carKnown!==false).map(c=>c.maker+'|'+c.car)).size);
    $('aboutCaseCount').textContent=number(cases.length)+'件の';
    $('sourceNote').textContent=`制作プレビュー｜${data.sourceDate}の保存資料${data.additionalSource?'と提供された旧ギャラリー':''}から${number(cases.length)}件を再構成。色名は保存資料の写真説明に基づきます。公開サイトの最新データとの照合は未実施です。`;
    updateResults();
    if(location.hash==='#photoResults')requestAnimationFrame(showPhotos);
  }catch(error){$('loading').textContent='装着事例を読み込めませんでした。接続を確認して、再読み込みしてください。';const b=el('button','secondary','再読み込み');b.addEventListener('click',()=>location.reload());$('loading').append(b);}
}
start();
