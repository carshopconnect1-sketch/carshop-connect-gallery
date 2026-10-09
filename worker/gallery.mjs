import {canonicalSeries,findSeries,seriesCatalog} from '../public/series-data.js';
import {normalize} from '../public/filter.js';
import {canonicalVehicle} from '../public/vehicle-identity.js';
import {createFitmentResolver} from '../public/fitment.js';
import {postedVehicleInfo} from '../public/vehicle-info.js';
import {photoReplacement,detailReplacement} from '../public/photo-replacements.js';
const JSON_HEADERS = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const families = new Set(['black','brown','beige','white','gray','red','blue','green','yellow','orange','pink','purple','other']);
const roles = new Set(['editor','publisher']);
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const json = (value, status=200) => new Response(JSON.stringify(value), {status, headers:JSON_HEADERS});
class Fault extends Error {constructor(status,message){super(message);this.status=status;}}
const reject = (status,message) => {throw new Fault(status,message);};
const clean = (value,max=160) => typeof value==='string' ? value.normalize('NFKC').trim().slice(0,max) : '';
const email = value => clean(value,254).toLowerCase();
const photoPath = id => `/media/gallery/${id}`;
const publicFields = ['maker','car','brand','category','series','colorName','colors'];

async function boundedBody(request, limit) {
  if(Number(request.headers.get('content-length'))>limit)reject(413,'ファイルまたは入力内容が大きすぎます。');
  const reader=request.body?.getReader();if(!reader)return new Uint8Array();
  const chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();reject(413,'ファイルまたは入力内容が大きすぎます。');}chunks.push(value);}
  const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}
async function bodyJSON(request) {
  if(!request.headers.get('content-type')?.startsWith('application/json'))reject(415,'JSON形式で送信してください。');
  try{return JSON.parse(new TextDecoder().decode(await boundedBody(request,100000)));}catch(error){if(error instanceof Fault)throw error;reject(400,'入力内容を読み取れませんでした。');}
}
function secureWrite(request) {
  const origin=request.headers.get('origin');
  if(origin!==new URL(request.url).origin || request.headers.get('sec-fetch-site')==='cross-site')reject(403,'同じ登録画面から操作してください。');
}
export function imageType(bytes) {
  if(bytes.length<12)return '';
  if(bytes[0]===255 && bytes[1]===216 && bytes[2]===255)return 'image/jpeg';
  if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
  if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF' && new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'image/webp';
  return '';
}
function draftFromBase(item, detail={}) {
  const info=detail.photoInfo?.[0]||{};
  return {...Object.fromEntries(publicFields.map(key=>[key,item[key]??(key==='colors'?[]:'')])),
    code:info['品番']||'',model:info['型式']||'',vehicleInfo:info['車両情報']||'',review:detail.review||'',productUrl:detail.productUrl||'',
    photos:(detail.images||[item.image]).map(url=>({url,alt:detail.alt||`${item.car}の装着写真`})),
    photosConfirmed:false,colorConfirmed:false,consentConfirmed:false,internalNote:''};
}
export function createGallery(base) {
  const originals = new Map(base.catalog.cases.map(item=>[item.id,item]));
  const resolveFitment = createFitmentResolver(base.fitment);
  const publicItem = item => photoReplacement({...item,car:canonicalVehicle(item.maker,item.car)},base.replacements);
  const publicDetail = (detail,item) => ({...detailReplacement(item?.id,detail,base.replacements),productLinkReason:detail.productLinkReason||detail.productLinkStatus||'',
    ...(item?{photoInfo:(detail.photoInfo||[]).map(info=>postedVehicleInfo(info,resolveFitment(item,detail)?.rows||[]))}:{})});
  async function actor(request,env) {
    const id=request.headers.get('oai-authenticated-user-id');const address=email(request.headers.get('oai-authenticated-user-email'));
    if(!id || !address)reject(401,'ChatGPTでログインしてください。');
    if(!env.DB || !env.BUCKET || !env.GALLERY_OWNER_EMAIL)reject(503,'共有保存先を準備中です。');
    if(address===email(env.GALLERY_OWNER_EMAIL))return {id,email:address,role:'owner',canPublish:true,...(env.LOCAL_PREVIEW===true?{localPreview:true}:{})};
    const member=await env.DB.prepare('SELECT role FROM gallery_staff WHERE email = ?').bind(address).first();
    if(!member)reject(403,'スタッフ登録されていません。管理者にログイン時のメールアドレスを伝えてください。');
    return {id,email:address,role:member.role,canPublish:member.role==='publisher'};
  }
  async function row(env,id){const found=await env.DB.prepare('SELECT * FROM gallery_cases WHERE id = ?').bind(id).first();if(!found)reject(404,'事例が見つかりません。');return found;}
  function describe(value){
    const draft=JSON.parse(value.draft);
    const detail={photoInfo:[{'品番':draft.code,'型式':draft.model,'車両情報':draft.vehicleInfo}]};
    const info=postedVehicleInfo(detail.photoInfo[0],resolveFitment(draft,detail)?.rows||[]);
    return {id:value.id,draft:{...draft,car:canonicalVehicle(draft.maker,draft.car),model:info['型式']||'',vehicleInfo:info['車両情報']||''},status:value.status,revision:value.revision,hasPublished:value.published?!JSON.parse(value.published).hidden:originals.has(value.id),updatedAt:value.updated_at,updatedBy:value.updated_by};
  }
  function revision(value, input){if(!Number.isInteger(input.revision) || value.revision!==input.revision)reject(409,'他のスタッフが更新しました。入力内容を控えて、最新版を開き直してください。');}
  async function validateDraft(env,id,input) {
    const result={};for(const key of ['maker','car','brand','category','series','colorName','code','model','vehicleInfo','productUrl'])result[key]=clean(input[key],key==='productUrl'?1500:160);
    result.review=clean(input.review,6000);result.internalNote=clean(input.internalNote,4000);
    result.colors=Array.isArray(input.colors)?[...new Set(input.colors)].filter(v=>families.has(v)):[];
    result.photosConfirmed=input.photosConfirmed===true;result.colorConfirmed=input.colorConfirmed===true;result.consentConfirmed=input.consentConfirmed===true;
    if(result.productUrl){let u;try{u=new URL(result.productUrl);}catch{reject(422,'商品URLの形式を確認してください。');}if(u.protocol!=='https:' || u.hostname!=='seatcover.jp' || u.username || u.password || !u.pathname.startsWith('/c/'))reject(422,'商品URLはseatcover.jpの /c/ から始まるURLを指定してください。');}
    if(!Array.isArray(input.photos) || input.photos.length>30)reject(422,'写真は30枚まで登録できます。');
    const permitted=new Set(base.details[id]?.images||[]);
    const owned=await env.DB.prepare('SELECT id FROM gallery_photos WHERE case_id = ?').bind(id).all();
    for(const p of owned.results)permitted.add(photoPath(p.id));
    result.photos=input.photos.map(p=>{const url=clean(p.url,1500);if(!permitted.has(url))reject(422,'別の事例の写真は使用できません。写真をこの事例にアップロードしてください。');return {url,alt:clean(p.alt,200)||`${result.car||'車内'}の装着写真`};});
    if(new Set(result.photos.map(p=>p.url)).size!==result.photos.length)reject(422,'同じ写真が重複しています。');
    return result;
  }
  function publishValidation(draft) {
    for(const key of ['maker','car','brand','category','series'])if(!draft[key])reject(422,'メーカー・車種・ブランド・カテゴリ・シリーズを入力してください。');
    if(!['seatcover','panel'].includes(draft.category))reject(422,'カテゴリを確認してください。');
    if(!draft.photos.length)reject(422,'公開する写真を追加してください。');
    if(!draft.photosConfirmed || !draft.colorConfirmed || !draft.consentConfirmed)reject(422,'写真の対応・色の分類・掲載許諾を確認してチェックしてください。');
    if(draft.colorName && !draft.colors.length)reject(422,'掲載色名に対応する色の系統を選んでください。');
  }
  async function verifiedProduct(draft) {
    if(!draft.productUrl)return {url:'',status:'identity_unresolved'};
    if(!draft.code)reject(422,'商品リンクを公開するには掲載品番を入力してください。');
    let url=new URL(draft.productUrl),response;
    for(let step=0;step<4;step++){
      try{response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(10000)});}catch{reject(422,'商品ページを確認できませんでした。時間をおいて再度お試しください。');}
      if(response.status>=300&&response.status<400){const next=new URL(response.headers.get('location')||'',url);if(next.hostname!=='seatcover.jp'||next.protocol!=='https:')reject(422,'商品リンクの転送先を確認してください。');url=next;continue;}break;
    }
    if(!response?.ok || !response.headers.get('content-type')?.includes('text/html'))reject(422,'商品ページが見つかりません。リンクを確認してください。');
    const html=await response.text();const code=draft.code.replace(/[‐‑–—−]/g,'-').toUpperCase();
    const linked=base.catalog.cases.filter(item=>base.details[item.id]?.productUrl===url.href);
    if(linked.length){
      if(!linked.some(item=>item.maker===draft.maker && canonicalVehicle(item.maker,item.car)===canonicalVehicle(draft.maker,draft.car) && item.brand===draft.brand && canonicalSeries(item.brand,item.series)===canonicalSeries(draft.brand,draft.series)))reject(422,'商品URLの車種・ブランド・シリーズが登録内容と一致しません。');
    }else{
      const title=normalize([...html.matchAll(/<(?:title|h1)\b[^>]*>([\s\S]*?)<\/(?:title|h1)>/gi)].map(m=>m[1].replace(/<[^>]*>/g,' ')).join(' '));
      const brandAliases={Refinad:['Refinad','レフィナード'],Sandii:['Sandii','サンディ'],IXUS:['IXUS','イクサス'],Dotty:['Dotty','ダティ']};
      const series=findSeries(draft.brand,draft.series);
      if(!title.includes(normalize(draft.car)) || !(brandAliases[draft.brand]||[draft.brand]).some(v=>title.includes(normalize(v))) || ![draft.series,series?.label,...(series?.values||[])].filter(Boolean).some(v=>title.includes(normalize(v))))reject(422,'商品ページの見出しで車種・ブランド・シリーズを確認できませんでした。URLを見直すか、空欄で公開してください。');
      const identified=seriesCatalog.filter(v=>v.brand===draft.brand).flatMap(v=>[v.label,...v.values].map(alias=>({series:v,alias:normalize(alias)}))).filter(v=>title.includes(v.alias)).sort((a,b)=>b.alias.length-a.alias.length)[0];
      if(series && identified && series.id!==identified.series.id)reject(422,'商品ページのシリーズが登録したシリーズと異なります。');
    }
    // A text mention alone does not establish selectable fitment. Only option/radio values count.
    const choices=[...html.matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>|<input\b[^>]*\btype=["'](?:radio|checkbox)["'][^>]*>/gi)].map(m=>m[0]).filter(v=>!/^<[^>]*\bdisabled\b/i.test(v));
    const escaped=code.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const token=new RegExp(`(^|[^A-Z0-9-])${escaped}($|[^A-Z0-9-])`);
    const selectable=choices.some(v=>token.test(v.normalize('NFKC').toUpperCase()));
    if(!selectable)reject(422,'商品ページで掲載品番の選択肢を確認できませんでした。URLを修正するか、空欄にして公式適合表への案内で公開してください。');
    return {url:url.href,status:'verified_product_page'};
  }
  function snapshot(id,draft,product) {
    const item={id,...Object.fromEntries(publicFields.map(key=>[key,draft[key]])),carKnown:true,image:draft.photos[0].url,photoCount:draft.photos.length,hasReview:!!draft.review,galleryUrl:'/'};
    const detail={images:draft.photos.map(p=>p.url),alt:draft.photos[0].alt,review:draft.review,productUrl:product.url,productLinkStatus:product.status,productLinkReason:product.status,
      photoInfo:[{...(draft.code?{'品番':draft.code}:{}),...(draft.model?{'型式':draft.model}:{}),...(draft.vehicleInfo?{'車両情報':draft.vehicleInfo}:{})}]};
    const fit=resolveFitment(item,detail);
    return {item:publicItem(item),detail:publicDetail(detail,item),...(fit?{fitment:fit}:{})};
  }
  async function update(env,previous,draft,status,user,published=undefined,action='save') {
    const stamp=now();
    const sql=published===undefined?'UPDATE gallery_cases SET draft = ?, status = ?, revision = revision + 1, updated_by = ?, updated_at = ? WHERE id = ? AND revision = ? RETURNING *':'UPDATE gallery_cases SET draft = ?, status = ?, revision = revision + 1, updated_by = ?, updated_at = ?, published = ? WHERE id = ? AND revision = ? RETURNING *';
    const args=[JSON.stringify(draft),status,user.email,stamp,...(published===undefined?[]:[published===null?null:JSON.stringify(published)]),previous.id,previous.revision];
    const results=await env.DB.batch([
      env.DB.prepare(sql).bind(...args),
      env.DB.prepare('INSERT INTO gallery_history (id, case_id, revision, action, actor, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE changes() = 1').bind(uuid(),previous.id,previous.revision+1,action,user.email,stamp),
    ]);
    if(!results[0].results.length)reject(409,'他のスタッフが更新しました。最新版を開き直してください。');
    return describe(results[0].results[0]);
  }
  async function publicCases(env){
    if(!env.DB)return [];
    const rows=(await env.DB.prepare(`SELECT c.id, c.published, h.first_published_at
      FROM gallery_cases c LEFT JOIN (
        SELECT case_id, MIN(created_at) AS first_published_at FROM gallery_history
        WHERE action = 'publish' GROUP BY case_id
      ) h ON h.case_id = c.id WHERE c.published IS NOT NULL`).all()).results;
    return rows.map(r=>{
      const value={id:r.id,...JSON.parse(r.published)};
      // Publishing edits to archived cases must not turn them into new cases.
      if(!value.hidden&&originals.get(r.id)?.firstPublishedAt)
        value.item={...value.item,firstPublishedAt:originals.get(r.id).firstPublishedAt};
      else if(!value.hidden&&!originals.has(r.id)&&r.first_published_at)
        value.item={...value.item,firstPublishedAt:r.first_published_at};
      if(!value.hidden){value.item=publicItem(value.item);value.detail=publicDetail(value.detail,value.item);}
      return value;
    });
  }
  async function publicData(path,env){
    if(path==='/api/gallery/catalog'){
      const saved=await publicCases(env);const overridden=new Set(saved.map(v=>v.id));
      return {...base.catalog,cases:[...saved.filter(v=>!v.hidden).map(v=>v.item),...base.catalog.cases.filter(v=>!overridden.has(v.id)).map(publicItem)]};
    }
    if(path==='/api/gallery/fitment'){
      const saved=await publicCases(env);const overridden=new Set(saved.map(v=>v.id));
      const {records: ignoredRecords,cases: ignoredCases,...metadata}=base.fitment;
      const result={...metadata,cases:{}};
      for(const item of base.catalog.cases.filter(v=>!overridden.has(v.id))){const fit=resolveFitment(item,base.details[item.id]);if(fit)result.cases[item.id]=fit;}
      for(const v of saved.filter(v=>!v.hidden)){const fit=resolveFitment(v.item,v.detail);if(fit)result.cases[v.id]=fit;}
      return result;
    }
    const id=path.match(/^\/api\/gallery\/details\/([a-f0-9]{12})$/)?.[1];
    if(id){const found=env.DB?await env.DB.prepare('SELECT published FROM gallery_cases WHERE id = ?').bind(id).first():null;
      if(found?.published){const v=JSON.parse(found.published);if(v.hidden)reject(404,'公開されていない事例です。');return publicDetail(v.detail,v.item);}
      if(base.details[id])return publicDetail(base.details[id],originals.get(id));reject(404,'公開されていない事例です。');}
    reject(404,'見つかりません。');
  }
  return {async fetch(request,env,ctx){
    try {
      const url=new URL(request.url),path=url.pathname;
      if(path.startsWith('/api/gallery/')&&['GET','HEAD'].includes(request.method)){
        const response=json(await publicData(path,env));if(request.headers.get('origin')==='https://seatcover.jp')response.headers.set('access-control-allow-origin','https://seatcover.jp');return response;
      }
      if(path.startsWith('/media/gallery/')){
        if(!['GET','HEAD'].includes(request.method))reject(405,'対応していない操作です。');
        const id=path.match(/^\/media\/gallery\/([a-f0-9-]{36})$/)?.[1];if(!id)reject(404,'写真が見つかりません。');
        const photo=await env.DB.prepare('SELECT * FROM gallery_photos WHERE id = ?').bind(id).first();if(!photo)reject(404,'写真が見つかりません。');
        const source=await env.DB.prepare('SELECT published FROM gallery_cases WHERE id = ?').bind(photo.case_id).first();
        const published=source?.published?JSON.parse(source.published):null;
        const isPublic=!published?.hidden && published?.detail?.images.includes(path);
        if(!isPublic)await actor(request,env);
        const replacement=base.replacements?.cases?.[photo.case_id]?.find(entry=>entry.source===path);
        if(replacement)return new Response(null,{status:307,headers:{location:replacement.url,'cache-control':'no-store'}});
        const blob=await env.BUCKET.get(photo.storage_key);if(!blob)reject(404,'写真が見つかりません。');
        return new Response(request.method==='HEAD'?null:blob.body,{headers:{'content-type':photo.mime,'cache-control':'no-store','x-content-type-options':'nosniff'}});
      }
      if(path.startsWith('/api/gallery-admin/')) {
        const user=await actor(request,env);if(!['GET','HEAD'].includes(request.method))secureWrite(request);
        const part=path.slice('/api/gallery-admin/'.length);
        if(part==='session'&&request.method==='GET')return json({user});
        if(part==='cases'&&request.method==='GET')return json({cases:(await env.DB.prepare('SELECT * FROM gallery_cases ORDER BY updated_at DESC').all()).results.map(describe)});
        if(part==='cases'&&request.method==='POST') {
          const input=await bodyJSON(request);let id,draft;
          if(input.baseId){const original=originals.get(input.baseId);if(!original)reject(404,'元の事例が見つかりません。');id=original.id;
            const existing=await env.DB.prepare('SELECT * FROM gallery_cases WHERE id = ?').bind(id).first();if(existing)return json(describe(existing));
            draft=draftFromBase(original,base.details[id]);
          }else{id=uuid().replace(/-/g,'').slice(0,12);draft=draftFromBase({category:'seatcover'},{});draft.photos=[];}
          const stamp=now();const result=await env.DB.prepare('INSERT INTO gallery_cases (id,draft,status,revision,updated_by,updated_at) VALUES (?, ?, ?, 1, ?, ?) RETURNING *').bind(id,JSON.stringify(draft),'draft',user.email,stamp).all();return json(describe(result.results[0]),201);
        }
        if(part==='staff') {
          if(user.role!=='owner')reject(403,'管理者だけがスタッフを変更できます。');
          if(request.method==='GET')return json({staff:(await env.DB.prepare('SELECT email, role FROM gallery_staff ORDER BY email').all()).results});
          if(request.method==='POST') {const input=await bodyJSON(request);const address=email(input.email);
            if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address===email(env.GALLERY_OWNER_EMAIL) || !roles.has(input.role))reject(422,'メールアドレスと権限を確認してください。');
            await env.DB.prepare('INSERT INTO gallery_staff (email,role,updated_at) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET role = excluded.role, updated_at = excluded.updated_at').bind(address,input.role,now()).run();return json({ok:true});}
          if(request.method==='DELETE'){const input=await bodyJSON(request);await env.DB.prepare('DELETE FROM gallery_staff WHERE email = ?').bind(email(input.email)).run();return json({ok:true});}
        }
        if(part==='export'&&request.method==='GET') {
          const catalog=await publicData('/api/gallery/catalog',env);const details={...base.details};
          for(const v of await publicCases(env)){if(v.hidden)delete details[v.id];else details[v.id]=v.detail;}
          const absolute=value=>typeof value==='string'&&value.startsWith('/')?new URL(value,request.url).href:value;
          const exportCatalog={...catalog,cases:catalog.cases.map(item=>({...item,image:absolute(item.image),...(item.thumbnail?{thumbnail:absolute(item.thumbnail)}:{}),...(item.previewImage?{previewImage:absolute(item.previewImage)}:{})}))};
          const exportDetails=Object.fromEntries(Object.entries(details).map(([id,detail])=>[id,{...detail,images:detail.images.map(absolute)}]));
          return new Response(JSON.stringify({catalog:exportCatalog,details:exportDetails,fitment:await publicData('/api/gallery/fitment',env)}),{headers:{...JSON_HEADERS,'content-disposition':'attachment; filename="gallery-public-export.json"'}});
        }
        const match=part.match(/^cases\/([a-f0-9]{12})(?:\/(photos|review|publish|unpublish|history))?$/);
        if(match){const [,id,action]=match;const current=await row(env,id);
          if(!action&&request.method==='GET')return json(describe(current));
          if(action==='history'&&request.method==='GET')return json({history:(await env.DB.prepare('SELECT revision,action,actor,created_at FROM gallery_history WHERE case_id = ? ORDER BY created_at DESC LIMIT 50').bind(id).all()).results});
          if(action==='photos'&&request.method==='POST') {
            const bytes=await boundedBody(request,15*1024*1024);const mime=imageType(bytes);if(!mime || request.headers.get('content-type')!==mime)reject(415,'JPEG・PNG・WebPの写真を選んでください。');
            const photoId=uuid(),key=`gallery/${id}/${photoId}`;
            await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
            try{await env.DB.prepare('INSERT INTO gallery_photos (id,case_id,storage_key,mime,size,created_at) VALUES (?,?,?,?,?,?)').bind(photoId,id,key,mime,bytes.length,now()).run();}catch(error){await env.BUCKET.delete(key);throw error;}
            return json({url:photoPath(photoId),alt:''},201);
          }
          if(request.method==='PUT'&&!action || request.method==='POST'&&['review','publish','unpublish'].includes(action)) {
            const input=await bodyJSON(request);revision(current,input);
            if(['publish','unpublish'].includes(action)&&!user.canPublish)reject(403,'公開担当または管理者が確認して公開してください。');
            const draft=await validateDraft(env,id,input.draft??JSON.parse(current.draft));
            if(action==='publish'){publishValidation(draft);const product=await verifiedProduct(draft);return json(await update(env,current,draft,'published',user,snapshot(id,draft,product),'publish'));}
            if(action==='unpublish'){return json(await update(env,current,draft,'draft',user,{hidden:true},'unpublish'));}
            if(action==='review')publishValidation(draft);
            return json(await update(env,current,draft,action==='review'?'review':'draft',user,undefined,action||'save'));
          }
        }
        reject(404,'操作が見つかりません。');
      }
      if(!['GET','HEAD'].includes(request.method))reject(405,'対応していない操作です。');
      if(path==='/admin' || path==='/admin/' || path==='/admin/index.html') {
        // The shell has no private records. API routes independently enforce staff membership.
        return new Response(request.method==='HEAD'?null:base.assets['/admin/index.html'],{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow','x-content-type-options':'nosniff'}});
      }
      const staticPath=path==='/'?'/index.html':path;
      if(env.ASSETS)return env.ASSETS.fetch(request);
      // Sites can serve client assets before the Worker. Text fallback also keeps page/API routing portable.
      if(base.assets[staticPath])return new Response(request.method==='HEAD'?null:base.assets[staticPath],{headers:{'content-type':staticPath.endsWith('.html')?'text/html; charset=utf-8':staticPath.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','x-content-type-options':'nosniff'}});
      reject(404,'ページが見つかりません。');
    } catch(error) {
      if(!(error instanceof Fault))console.error('gallery request failed',error.name);
      return json({error:error instanceof Fault?error.message:'保存先に接続できませんでした。再度お試しください。'},error.status||503);
    }
  }};
}
