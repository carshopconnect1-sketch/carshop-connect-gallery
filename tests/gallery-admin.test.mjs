import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {localStore} from '../scripts/local-gallery-store.mjs';
import {createGallery} from '../worker/gallery.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const original={id:'abcdef123456',maker:'スズキ',car:'ジムニー',brand:'Refinad',category:'seatcover',series:'Heritage Mesh Series',colorName:'ブラウン',colors:['brown'],image:'https://seatcover.jp/example.jpg'};
const base={catalog:{cases:[original]},details:{[original.id]:{images:[original.image],photoInfo:[{'品番':'S0113-02'}]}},fitment:{version:1,cases:{[original.id]:{brand:'Refinad',car:'ジムニー',code:'S0113-02',rows:[{model:'JB64W',seats:4}]}}},assets:{'/admin/index.html':'管理画面'}};
const png=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6WQAAAABJRU5ErkJggg==','base64'));
async function setup(t){
  const directory=await mkdtemp(path.join(root,'.preview/admin-test-'));const store=await localStore(directory,path.join(root,'drizzle'));
  const env={...store,GALLERY_OWNER_EMAIL:'owner@example.test'};const app=createGallery(base);
  t.after(async()=>{store.close();await rm(directory,{recursive:true,force:true});});
  async function request(route,{who='owner@example.test',method='GET',data,body,origin='https://example.test',headers={}}={}){
    const h={...headers};if(who){h['oai-authenticated-user-id']='user-'+who;h['oai-authenticated-user-email']=who;}if(method!=='GET'){h.origin=origin;if(data!==undefined){h['content-type']='application/json';body=JSON.stringify(data);}}
    return app.fetch(new Request('https://example.test'+route,{method,headers:h,body}),env,{});
  }
  const api=async(p,o={})=>{const res=await request('/api/gallery-admin/'+p,o);return {status:res.status,body:await res.json()};};
  return {env,app,api,request,directory};
}
async function newCase(api){const result=await api('cases',{method:'POST',data:{}});assert.equal(result.status,201);return result.body;}
async function populated(api){const value=await newCase(api);const photo=await api(`cases/${value.id}/photos`,{method:'POST',body:png,headers:{'content-type':'image/png'}});assert.equal(photo.status,201);
  return {...value,draft:{...value.draft,maker:'スズキ',car:'ジムニー',brand:'Refinad',series:'Heritage Mesh Series',colorName:'キャメル',colors:['brown'],code:'S0113-02',photos:[photo.body],photosConfirmed:true,colorConfirmed:true,consentConfirmed:true,internalNote:'private staff note'}};
}
test('staff authentication, role authorization and same-origin writes are enforced on the server',async t=>{
  const {api}=await setup(t);assert.equal((await api('cases',{who:null})).status,401);assert.equal((await api('cases',{who:'stranger@example.test'})).status,403);
  assert.equal((await api('cases',{method:'POST',origin:'https://evil.test',data:{}})).status,403);
  assert.equal((await api('staff',{method:'POST',data:{email:'editor@example.test',role:'editor'}})).status,200);
  const value=await populated(api);
  assert.equal((await api(`cases/${value.id}/publish`,{method:'POST',who:'editor@example.test',data:value})).status,403);
  assert.equal((await api('staff',{who:'editor@example.test'})).status,403);
  assert.equal((await api(`cases/${value.id}`,{who:'editor@example.test',method:'PUT',data:value})).status,200);
});
test('drafts and photos remain private; publication exposes a snapshot without internal notes',async t=>{
  const {api,request}=await setup(t);let value=await populated(api);const photo=value.draft.photos[0].url;
  assert.equal((await request(photo,{who:null})).status,401);
  assert.equal((await request(`/api/gallery/details/${value.id}`,{who:null})).status,404);
  value=(await api(`cases/${value.id}/publish`,{method:'POST',data:value})).body;
  assert.equal(value.status,'published');assert.equal((await request(photo,{who:null})).status,200);
  const catalog=await (await request('/api/gallery/catalog',{who:null})).json();assert.equal(catalog.cases.length,2);assert.equal(JSON.stringify(catalog).includes('private staff note'),false);
  const detail=await (await request(`/api/gallery/details/${value.id}`,{who:null})).json();assert.equal(detail.internalNote,undefined);assert.equal(detail.productUrl,'');
  const fitment=await (await request('/api/gallery/fitment',{who:null})).json();assert.equal(fitment.cases[value.id].rows[0].model,'JB64W');
  value.draft.colorName='変更中の色';value=(await api(`cases/${value.id}`,{method:'PUT',data:value})).body;
  const unchanged=await (await request('/api/gallery/catalog',{who:null})).json();assert.equal(unchanged.cases.find(v=>v.id===value.id).colorName,'キャメル');
  value=(await api(`cases/${value.id}/unpublish`,{method:'POST',data:value})).body;assert.equal(value.hasPublished,false);
  assert.equal((await request(photo,{who:null})).status,401);assert.equal((await request(`/api/gallery/details/${value.id}`,{who:null})).status,404);
});
test('two PCs cannot overwrite an intervening save; committed content survives closing and reopening storage',async t=>{
  const {api,directory,env,request}=await setup(t);const value=await populated(api);
  const save=await api(`cases/${value.id}`,{method:'PUT',data:value});assert.equal(save.status,200);
  assert.equal((await api(`cases/${value.id}`,{method:'PUT',data:{...value,draft:{...value.draft,car:'別の車種'}}})).status,409);
  const second=await localStore(directory,path.join(root,'drizzle'));try{const app=createGallery(base);const response=await app.fetch(new Request(`https://example.test/api/gallery-admin/cases/${value.id}`,{headers:{'oai-authenticated-user-id':'another-pc','oai-authenticated-user-email':'owner@example.test'}}),{...second,GALLERY_OWNER_EMAIL:env.GALLERY_OWNER_EMAIL},{});assert.equal((await response.json()).draft.car,'ジムニー');}finally{second.close();}
  assert.equal((await request(value.draft.photos[0].url)).status,200);
});
test('photos cannot be borrowed from another case and publication requires explicit checks and color families',async t=>{
  const {api}=await setup(t);const a=await populated(api),b=await newCase(api);
  assert.equal((await api(`cases/${b.id}`,{method:'PUT',data:{...b,draft:a.draft}})).status,422);
  assert.equal((await api(`cases/${a.id}/publish`,{method:'POST',data:{...a,draft:{...a.draft,photosConfirmed:false}}})).status,422);
  assert.equal((await api(`cases/${a.id}/review`,{method:'POST',data:{...a,draft:{...a.draft,colors:[]}}})).status,422);
  assert.equal((await api(`cases/${a.id}/photos`,{method:'POST',body:new Uint8Array([1,2,3]),headers:{'content-type':'image/jpeg'}})).status,415);
});
test('existing cases are imported without changing public content until approval; withdrawal also hides originals',async t=>{
  const {api,request}=await setup(t);let value=(await api('cases',{method:'POST',data:{baseId:original.id}})).body;
  value.draft.colorName='別の色';assert.equal((await api(`cases/${value.id}`,{method:'PUT',data:value})).status,200);
  assert.equal((await (await request('/api/gallery/catalog',{who:null})).json()).cases[0].colorName,'ブラウン');
  value=(await api(`cases/${value.id}`)).body;
  assert.equal((await api(`cases/${value.id}/unpublish`,{method:'POST',data:value})).status,200);
  assert.equal((await (await request('/api/gallery/catalog',{who:null})).json()).cases.length,0);
  assert.equal((await request(`/api/gallery/details/${original.id}`,{who:null})).status,404);
});
test('unconfirmed product URLs never become public direct links',async t=>{
  const {api}=await setup(t);const value=await populated(api);value.draft.productUrl='https://evil.test/c/product';assert.equal((await api(`cases/${value.id}`,{method:'PUT',data:value})).status,422);
  value.draft.productUrl='https://seatcover.jp/c/suzuki/jimny/product';
  const originalFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=originalFetch;});
  globalThis.fetch=async()=>new Response('<select><option>S9999-00</option></select>',{headers:{'content-type':'text/html'}});
  assert.equal((await api(`cases/${value.id}/publish`,{method:'POST',data:value})).status,422);
  globalThis.fetch=async()=>new Response('<title>ジムニー Refinad Heritage Mesh Series</title><select><option>S0113-02 JB64W</option></select>',{headers:{'content-type':'text/html'}});
  assert.equal((await api(`cases/${value.id}/publish`,{method:'POST',data:value})).status,200);
});
test('product pages for another series, disabled choices or code prefixes cannot be approved',async t=>{
  const {api}=await setup(t);const value=await populated(api);value.draft.productUrl='https://seatcover.jp/c/suzuki/jimny/product';
  const originalFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=originalFetch;});
  for(const html of [
    '<title>ジムニー Sandii カチナ</title><option>S0113-02</option>',
    '<title>ジムニー Refinad Heritage Mesh Series</title><option disabled>S0113-02</option>',
    '<title>ジムニー Refinad Heritage Mesh Series</title><option>S0113-021</option>',
  ]){globalThis.fetch=async()=>new Response(html,{headers:{'content-type':'text/html'}});assert.equal((await api(`cases/${value.id}/publish`,{method:'POST',data:value})).status,422);}
});
