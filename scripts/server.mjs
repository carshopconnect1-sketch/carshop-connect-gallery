import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publicRoot=path.join(root,'public');
const sourceRoot=path.join(root,'.source/archive/ビュー/_gallery_handoff_view');
const port=4180, host='127.0.0.1', project='connect-installation-gallery';
const metadata={project,root,pid:process.pid,startedAt:new Date().toISOString(),url:`http://${host}:${port}/`,command:[process.execPath,...process.argv.slice(1)],logs:path.join(root,'.preview')};
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
