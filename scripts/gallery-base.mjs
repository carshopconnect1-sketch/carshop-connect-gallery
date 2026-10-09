import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
export async function loadGalleryBase(directory){
  const catalog=JSON.parse(await readFile(path.join(directory,'data/catalog.json'),'utf8'));
  const fitment=JSON.parse(await readFile(path.join(directory,'data/fitment.json'),'utf8'));
  const details=Object.fromEntries(await Promise.all(catalog.cases.map(async item=>[item.id,JSON.parse(await readFile(path.join(directory,`data/details/${item.id}.json`),'utf8'))])));
  const assets={};
  async function walk(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory()){if(entry.name!=='data'&&entry.name!=='assets')await walk(file);}else if(/\.(html|css|js)$/.test(file)){assets['/'+path.relative(directory,file).replaceAll(path.sep,'/')]=await readFile(file,'utf8');}}}
  const readOptional=async name=>{try{return JSON.parse(await readFile(path.join(directory,'data',name),'utf8'));}catch(error){if(error.code==='ENOENT')return {};throw error;}};
  const publications=await readOptional('mail-publications.json');
  const replacements=await readOptional('photo-replacements.json');
  const existing=new Set(catalog.cases.map(item=>item.id));
  catalog.cases=[...(publications.cases||[]).filter(item=>!existing.has(item.id)),...catalog.cases];
  Object.assign(details,publications.details||{});
  await walk(directory);return {catalog,fitment,details,assets,replacements};
}
