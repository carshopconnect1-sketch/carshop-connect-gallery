import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createGallery} from '../worker/gallery.mjs';
import {loadGalleryBase} from './gallery-base.mjs';
import {localStore} from './local-gallery-store.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publicRoot=path.join(root,'public');
const sourceRoot=path.join(root,'.source/archive/ビュー/_gallery_handoff_view');
const port=4180, host='127.0.0.1', project='connect-installation-gallery';
const metadata={project,root,pid:process.pid,startedAt:new Date().toISOString(),url:`http://${host}:${port}/`,command:[process.execPath,...process.argv.slice(1)],logs:path.join(root,'.preview'),features:['gallery-admin-v1']};
const local=await localStore(path.join(root,'.preview/gallery-data'),path.join(root,'drizzle'));
const gallery=createGallery(await loadGalleryBase(publicRoot));
const localSessions=new Map();
const localEnv={...local,GALLERY_OWNER_EMAIL:'owner@local.invalid',LOCAL_PREVIEW:true};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon'};
async function route(url){
  let pathname;try{pathname=decodeURIComponent(new URL(url,metadata.url).pathname);}catch{return null;}
  if(pathname.includes('\\')||pathname.split('/').some(x=>x==='..'||x.startsWith('.')))return null;
  if(pathname==='/reference/old/gallery-top.html')return {file:path.resolve(root,'../audit/gallery-2026-09-14/sources/gallery-top-before-wizard-766bfaf.html'),reference:true};
  if(pathname==='/reference/current/gallery-top.html')return {file:path.join(sourceRoot,'gallery-top.html'),reference:true};
  const ref=pathname.match(/^\/reference\/(old|current)\/(gallery\/[\w-]+\.html)$/);
  if(ref)return {file:path.join(sourceRoot,ref[2]),reference:true};
  const file=path.resolve(publicRoot,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(publicRoot+path.sep))return null;
  return {file};
}
const server=http.createServer(async(req,res)=>{
  try{
    const requestPath=new URL(req.url,metadata.url).pathname;
    if(requestPath==='/signin-with-chatgpt'){
      const token=crypto.randomUUID();localSessions.set(token,true);
      res.writeHead(303,{'Location':'/admin/','Set-Cookie':`gallery_local_session=${token}; HttpOnly; SameSite=Strict; Path=/`,'Cache-Control':'no-store'});return res.end();
    }
    if(requestPath==='/signout-with-chatgpt'){
      const token=req.headers.cookie?.match(/gallery_local_session=([^;]+)/)?.[1];localSessions.delete(token);
      res.writeHead(303,{'Location':'/admin/','Set-Cookie':'gallery_local_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});return res.end();
    }
    if(requestPath.startsWith('/api/gallery') || requestPath.startsWith('/media/gallery/') || /^\/admin(?:\/|$)/.test(requestPath)){
      const headers=new Headers(req.headers);
      // Never trust client-supplied platform identity headers in the local preview.
      for(const key of [...headers.keys()])if(key.startsWith('oai-authenticated-'))headers.delete(key);
      const token=req.headers.cookie?.match(/gallery_local_session=([^;]+)/)?.[1];
      if(localSessions.has(token)){headers.set('oai-authenticated-user-id','local-preview-owner');headers.set('oai-authenticated-user-email','owner@local.invalid');}
      const request=new Request(new URL(req.url,metadata.url),{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});
      const response=await gallery.fetch(request,localEnv,{});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});return res.end();}
    if(req.url==='/__preview'){res.writeHead(200,{'Content-Type':mime['.json'],'Cache-Control':'no-store'});return res.end(req.method==='HEAD'?undefined:JSON.stringify(metadata));}
    const target=await route(req.url);if(!target)throw Object.assign(new Error('not found'),{code:'ENOENT'});
    const fileStat=await stat(target.file);if(!fileStat.isFile())throw Object.assign(new Error('not found'),{code:'ENOENT'});
    let body=await readFile(target.file);const ext=path.extname(target.file);
    if(target.reference&&ext==='.html'){
      let html=body.toString('utf8');
      // Snapshot-only: keep original layout, but make the old root-relative assets resolvable.
      html=html.replace('<head>','<head><meta name="robots" content="noindex,nofollow">');
      html=html.replace(/(src|srcset)="\/gallerys\//g,'$1="https://seatcover.jp/gallerys/');
      body=Buffer.from(html);
    }
    const headers={'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Vary':'Accept-Encoding'};
    if(body.length>1024&&/\.(html|js|css|json|svg)$/.test(target.file)&&req.headers['accept-encoding']?.includes('gzip')){body=gzipSync(body);headers['Content-Encoding']='gzip';}
    headers['Content-Length']=body.length;res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:body);
  }catch(error){const code=['ENOENT','ENOTDIR'].includes(error.code)?404:500;res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8'});res.end(code===404?'ページが見つかりません。':'読み込みに失敗しました。');if(code===500)console.error(new Date().toISOString(),error.message);}
});
server.on('error',error=>{console.error(new Date().toISOString(),error.message);process.exitCode=1;});
server.listen(port,host,async()=>{await mkdir(path.join(root,'.preview'),{recursive:true});await writeFile(path.join(root,'.preview/server.json'),JSON.stringify(metadata,null,2));console.log(JSON.stringify(metadata));});
