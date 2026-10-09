import {seriesCatalog,findSeries} from '../series-data.js';
import {colorOptions,normalize} from '../filter.js';
const $=id=>document.getElementById(id);
const editor=$('editor');let user,cases=[],catalog=[],active=null,photos=[],dirty=false,busy=false;
const labels={draft:'下書き',review:'確認待ち',published:'公開済み'};
function el(tag,text='',className=''){const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e;}
async function api(path,options={}){
  const response=await fetch('/api/gallery-admin/'+path,{...options,headers:{...(options.body instanceof Uint8Array?{}:{'content-type':'application/json'}),...options.headers},cache:'no-store'});
  const result=await response.json();if(!response.ok){const error=new Error(result.error||'処理に失敗しました。');error.status=response.status;throw error;}return result;
}
const payload=value=>JSON.stringify(value);
function message(text,error=false){$('notice').textContent=text;$('notice').className='notice'+(error?' error':'');$('notice').hidden=!text;}
function feedback(text,error=false){$('saveFeedback').textContent=text;$('saveFeedback').className='save-feedback'+(error?' error':'');}
function setBusy(value){busy=value;for(const button of document.querySelectorAll('#workspace button'))button.disabled=value;$('photoInput').disabled=value;if(!value&&active)renderPhotos();}
async function run(work){if(busy)return;setBusy(true);try{await work();}catch(error){message(error.message,true);feedback(error.message,true);}finally{setBusy(false);}}
function leave(){return !dirty || window.confirm('保存していない変更があります。変更を破棄して移動しますか？');}
function setTab(tab){for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===tab);$('caseWorkspace').hidden=tab!=='cases';$('existingPanel').hidden=tab!=='existing';$('staffPanel').hidden=tab!=='staff';}
function readDraft(){
  const data=new FormData(editor);const d={};
  for(const key of ['maker','car','brand','category','series','colorName','code','model','vehicleInfo','productUrl','review','internalNote'])d[key]=String(data.get(key)||'').trim();
  for(const key of ['photosConfirmed','colorConfirmed','consentConfirmed'])d[key]=data.get(key)==='on';
  d.colors=[...document.querySelectorAll('#colorFamilies input:checked')].map(e=>e.value);d.photos=photos.map(p=>({...p}));return d;
}
function renderPreview(){
  const d=readDraft(),box=el('div','','preview-card');if(photos[0]){const img=el('img');img.src=photos[0].url;img.alt=photos[0].alt;box.append(img);}
  box.append(el('p',d.brand),el('h4',d.car||'車種未入力'),el('p',findSeries(d.brand,d.series)?.label||d.series||'シリーズ未入力'),el('p',d.colorName||'色名未入力'),el('p',`${photos.length}枚の装着写真`));
  if(d.review)box.append(el('p',d.review));box.append(el('p','スタッフ用メモは表示されません。商品リンクは公開時の照合後に反映します。','private-warning'));$('cardPreview').replaceChildren(box);
}
function options(id,values){$(id).replaceChildren(...[...new Set(values)].filter(Boolean).sort((a,b)=>a.localeCompare(b,'ja')).map(value=>{const o=el('option');o.value=value;return o;}));}
function updateChoices(){
  options('carOptions',catalog.filter(v=>v.maker===editor.elements.maker.value && v.carKnown!==false).map(v=>v.car));
  const brand=editor.elements.brand.value;
  $('seriesOptions').replaceChildren(...seriesCatalog.filter(v=>v.brand===brand).map(v=>{const o=el('option',v.label);o.value=v.values[0];return o;}));
}
function renderPhotos(){
  $('photoCount').textContent=`${photos.length} / 30枚`;
  $('photos').replaceChildren(...photos.map((p,index)=>{
    const card=el('div','','photo'),img=el('img');img.src=p.url;img.alt=p.alt;img.loading='lazy';
    const buttons=el('div','','photo-actions');
    for(const [label,action,disabled] of [['←',()=>swap(index,index-1),index===0],['→',()=>swap(index,index+1),index===photos.length-1],['外す',()=>{photos.splice(index,1);dirty=true;resetChecks();renderPhotos();},false]]){
      const b=el('button',label);b.type='button';b.disabled=disabled;b.setAttribute('aria-label',label==='外す'?`${index+1}枚目の写真を外す`:`${index+1}枚目の写真を${label==='←'?'前':'後'}へ移動`);b.onclick=action;buttons.append(b);
    }
    const alt=el('input');alt.type='text';alt.value=p.alt;alt.maxLength=200;alt.placeholder='写真の説明';alt.setAttribute('aria-label',`${index+1}枚目の写真の説明`);alt.oninput=()=>{p.alt=alt.value;dirty=true;renderPreview();};
    card.append(img,el('p',index===0?'表紙の写真':`${index+1}枚目`,'photo-label'),buttons,alt);return card;
  }));renderPreview();
}
function swap(a,b){if(b<0||b>=photos.length)return;[photos[a],photos[b]]=[photos[b],photos[a]];dirty=true;renderPhotos();}
function resetChecks(){editor.elements.photosConfirmed.checked=false;editor.elements.colorConfirmed.checked=false;}
function renderList(){
  const query=normalize($('caseQuery').value),status=$('statusFilter').value;
  const subset=cases.filter(v=>(!status||v.status===status)&&normalize([v.draft.car,v.draft.brand,v.draft.series].join(' ')).includes(query));
  $('caseList').replaceChildren(...(subset.length?subset.map(v=>{const b=el('button','','case-entry'+(v.id===active?.id?' active':''));b.type='button';b.append(el('span',labels[v.status],'badge '+v.status),el('strong',v.draft.car||'新しい事例'),el('small',[v.draft.brand,findSeries(v.draft.brand,v.draft.series)?.label||v.draft.series].filter(Boolean).join(' / ')));b.onclick=()=>run(async()=>{if(leave())openEditor(await api('cases/'+v.id));});return b;}):[el('p',query||status?'該当する事例がありません。':'まだ登録した事例はありません。','muted')]));
  $('summary').replaceChildren(...['draft','review','published'].map(status=>{const box=el('div');box.append(el('strong',String(cases.filter(v=>v.status===status).length)),el('span',labels[status]));return box;}));
}
async function refresh(){cases=(await api('cases')).cases;renderList();}
function acceptRecord(value){active=value;const index=cases.findIndex(v=>v.id===value.id);if(index<0)cases.unshift(value);else cases[index]=value;dirty=false;renderList();}
function openEditor(value){
  acceptRecord(value);photos=value.draft.photos.map(p=>({...p}));
  for(const key of ['maker','car','brand','category','series','colorName','code','model','vehicleInfo','productUrl','review','internalNote'])editor.elements[key].value=value.draft[key]||'';
  for(const key of ['photosConfirmed','colorConfirmed','consentConfirmed'])editor.elements[key].checked=!!value.draft[key];
  for(const input of document.querySelectorAll('#colorFamilies input'))input.checked=value.draft.colors?.includes(input.value);
  $('caseStatus').textContent=labels[value.status];$('caseStatus').className='badge '+value.status;
  $('editorTitle').textContent=value.draft.car||'新しい装着事例';$('lastSaved').textContent=`最終保存：${new Date(value.updatedAt).toLocaleString('ja-JP')} / ${value.updatedBy}`;
  $('publish').hidden=!user.canPublish;$('unpublish').hidden=!user.canPublish||!value.hasPublished;
  $('empty').hidden=true;editor.hidden=false;$('caseWorkspace').classList.add('editing');setTab('cases');updateChoices();renderPhotos();feedback('');message('');
  api(`cases/${value.id}/history`).then(result=>$('history').replaceChildren(...result.history.map(v=>el('p',`${new Date(v.created_at).toLocaleString('ja-JP')}　${{save:'保存',review:'確認依頼',publish:'公開',unpublish:'公開取り下げ'}[v.action]||v.action} / ${v.actor}`)))).catch(()=>{$('history').textContent='履歴を読み込めませんでした。';});
}
async function createCase(){if(!leave())return;openEditor(await api('cases',{method:'POST',body:'{}'}));editor.elements.maker.focus();}
async function submit(action=''){
  if(!active)return;
  if(action==='publish' && !window.confirm('この内容を、公開ギャラリーに反映しますか？'))return;
  if(action==='unpublish' && !window.confirm('この事例を公開ギャラリーから取り下げますか？'))return;
  const d=readDraft();if(action==='review'||action==='publish'){if(!editor.reportValidity())return;}
  const value=await api(`cases/${active.id}${action?'/'+action:''}`,{method:action?'POST':'PUT',body:payload({revision:active.revision,draft:d})});
  openEditor(value);feedback(action==='publish'?'公開しました。ギャラリーに反映されています。':action==='review'?'確認を依頼しました。公開担当が内容を確認します。':action==='unpublish'?'公開を取り下げました。下書きは残っています。':'下書きを保存しました。ほかのPCからも編集できます。');
}
async function optimizedPhoto(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPEG・PNG・WebPの写真を選んでください。');
  if(file.size>15*1024*1024)throw new Error('1枚15MB以下の写真を選んでください。');
  const bitmap=await createImageBitmap(file);const scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));if(!blob)throw new Error('写真を読み込めませんでした。');return new Uint8Array(await blob.arrayBuffer());
}
async function upload(){
  const files=[...$('photoInput').files];$('photoInput').value='';
  if(photos.length+files.length>30)throw new Error('写真は1事例30枚までです。');
  for(let i=0;i<files.length;i++){
    feedback(`写真を保存しています（${i+1} / ${files.length}）…`);
    const bytes=await optimizedPhoto(files[i]);const photo=await api(`cases/${active.id}/photos`,{method:'POST',body:bytes,headers:{'content-type':'image/jpeg'}});photos.push({...photo,alt:`${editor.elements.car.value||'車内'}の装着写真`});dirty=true;resetChecks();renderPhotos();
  }
  feedback('写真を追加しました。車種・色を確認して、下書きを保存してください。');
}
function existingSearch(){
  const terms=$('existingQuery').value.trim().split(/\s+/).map(normalize).filter(Boolean);
  const found=terms.length?catalog.filter(v=>terms.every(q=>normalize([v.car,v.brand,v.series,findSeries(v.brand,v.series)?.label,v.colorName].join(' ')).includes(q))).slice(0,16):[];
  $('existingResults').replaceChildren(...(found.length?found.map(item=>{const card=el('article','','existing-card'),img=el('img');img.src=item.image;img.alt=item.car;img.loading='lazy';const body=el('div');body.append(el('strong',item.car),el('p',[item.brand,findSeries(item.brand,item.series)?.label||item.series,item.colorName].filter(Boolean).join(' / ')));const button=el('button','編集する','secondary');button.onclick=()=>run(async()=>{if(leave())openEditor(await api('cases',{method:'POST',body:payload({baseId:item.id})}));});body.append(button);card.append(img,body);return card;}):[el('p',terms.length?'該当する事例がありません。別のキーワードで検索してください。':'車種やシリーズ名を入力してください。','muted')]));
}
async function renderStaff(){
  const result=await api('staff');$('staffList').replaceChildren(...result.staff.map(member=>{const row=el('div','','staff-row');row.append(el('span',member.email),el('span',member.role==='publisher'?'公開担当':'登録担当'));const b=el('button','利用権限を外す','text-button danger');b.onclick=()=>run(async()=>{if(window.confirm(`${member.email} の利用権限を外しますか？`)){await api('staff',{method:'DELETE',body:payload({email:member.email})});await renderStaff();}});row.append(b);return row;}));
}
for(const [value,label,color] of colorOptions){const choice=el('label'),input=el('input');input.type='checkbox';input.value=value;const swatch=el('span','','swatch');swatch.style.background=color;choice.append(input,swatch,document.createTextNode(label));$('colorFamilies').append(choice);}
editor.addEventListener('input',event=>{dirty=true;if(['maker','car','brand','series','category','colorName'].includes(event.target.name))resetChecks();if(event.target.closest('#colorFamilies'))editor.elements.colorConfirmed.checked=false;renderPreview();});
editor.addEventListener('change',event=>{if(['maker','brand'].includes(event.target.name))updateChoices();});
editor.onsubmit=event=>{event.preventDefault();run(()=>submit());};
$('requestReview').onclick=()=>run(()=>submit('review'));$('publish').onclick=()=>run(()=>submit('publish'));$('unpublish').onclick=()=>run(()=>submit('unpublish'));
$('photoInput').onchange=()=>run(upload);$('newCase').onclick=()=>run(createCase);$('emptyNew').onclick=()=>run(createCase);
$('closeEditor').onclick=()=>{if(leave()){dirty=false;active=null;editor.hidden=true;$('empty').hidden=false;$('caseWorkspace').classList.remove('editing');renderList();}};
$('refresh').onclick=()=>run(refresh);$('caseQuery').oninput=renderList;$('statusFilter').onchange=renderList;$('existingQuery').oninput=existingSearch;
for(const button of document.querySelectorAll('[data-tab]'))button.onclick=()=>run(async()=>{if(!leave())return;if(dirty&&active)openEditor(active);dirty=false;setTab(button.dataset.tab);if(button.dataset.tab==='staff')await renderStaff();});
$('staffForm').onsubmit=event=>{event.preventDefault();run(async()=>{const data=new FormData(event.target);await api('staff',{method:'POST',body:payload({email:data.get('email'),role:data.get('role')})});event.target.reset();await renderStaff();message('スタッフの利用権限を保存しました。');});};
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
try {
  user=(await api('session')).user;$('login').hidden=true;$('workspace').hidden=false;$('account').hidden=false;$('accountName').textContent=user.localPreview?'ローカル確認用（共有サイトへの保存なし）':user.email+`（${{owner:'管理者',publisher:'公開担当',editor:'登録担当'}[user.role]}）`;$('staffTab').hidden=user.role!=='owner';
  await refresh();const response=await fetch('/api/gallery/catalog');if(!response.ok)throw new Error('公開データを読み込めませんでした。');catalog=(await response.json()).cases;options('makerOptions',catalog.map(v=>v.maker));options('brandOptions',[...catalog.map(v=>v.brand),'Refinad','Sandii','IXUS','Dotty']);existingSearch();
}catch(error){if(!user){$('loginMessage').textContent=error.message;$('signIn').hidden=error.status!==401;}else message(error.message,true);}
