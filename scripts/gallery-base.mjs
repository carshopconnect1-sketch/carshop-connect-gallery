import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
export async function loadGalleryBase(directory){
  const catalog=JSON.parse(await readFile(path.join(directory,'data/catalog.json'),'utf8'));
  const fitment=JSON.parse(await readFile(path.join(directory,'data/fitment.json'),'utf8'));
  const details=Object.fromEntries(await Promise.all(catalog.cases.map(async item=>[item.id,JSON.parse(await readFile(path.join(directory,`data/details/${item.id}.json`),'utf8'))])));
  const assets={};
  async function walk(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory()){if(entry.name!=='data'&&entry.name!=='assets')await walk(file);}else if(/\.(html|css|js)$/.test(file)){assets['/'+path.relative(directory,file).replaceAll(path.sep,'/')]=await readFile(file,'utf8');}}}
  await walk(directory);return {catalog,fitment,details,assets};
}
