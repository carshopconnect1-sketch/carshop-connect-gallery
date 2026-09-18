import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const sharp=createRequire(new URL('../../prototype/package.json',import.meta.url))('sharp');
const {albums}=JSON.parse(await readFile('audit/lifestyle-album-sources.json','utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const published={},audit=[];
for(const album of albums){
  const directory=`public/assets/lifestyle/albums/${album.id}`;
  await mkdir(directory,{recursive:true});
  const photos=[];
  for(const [index,photo] of album.photos.entries()){
    const source=await readFile(photo.source),name=String(index+1).padStart(2,'0');
    const full=await sharp(source).rotate().resize({width:1400,height:1400,fit:'inside',withoutEnlargement:true}).webp({quality:84}).toBuffer();
    const thumb=await sharp(source).rotate().resize(480,360,{fit:'cover'}).webp({quality:80}).toBuffer();
    await writeFile(`${directory}/${name}.webp`,full);
    await writeFile(`${directory}/${name}-thumb.webp`,thumb);
    const src=`/assets/lifestyle/albums/${album.id}/${name}.webp`,thumbnail=src.replace('.webp','-thumb.webp');
    photos.push({src,thumbnail,caption:photo.caption});
    audit.push({album:album.id,car:album.car,brand:album.brand,series:album.series,source:photo.source,sha256:digest(source),output:'public'+src,outputSha256:digest(full),bytes:full.length,thumbnailBytes:thumb.length});
  }
  published[album.id]={car:album.car,brand:album.brand,series:album.series,...(album.note?{note:album.note}:{}),photos};
  console.log(`${album.id}: ${photos.length} photos`);
}
// Existing installation pictures stay together under their original case ID.
const detail=JSON.parse(await readFile('public/data/details/e96cbf8bdac1.json','utf8'));
published['harrier-leather']={car:'ハリアー',brand:'Refinad',series:'レザーデラックス',sourceCaseId:'e96cbf8bdac1',photos:detail.images.map((src,i)=>({src,thumbnail:src,caption:`ハリアーのレザーデラックス装着写真 ${i+1}`}))};
await writeFile('public/lifestyle-albums.js','// Each album is one visually verified vehicle/series shooting set.\nexport const lifestyleAlbums = '+JSON.stringify(published,null,2)+';\n');
await writeFile('audit/lifestyle-album-assets.json',JSON.stringify({images:audit},null,2)+'\n');
console.log(`${Object.keys(published).length} albums, ${Object.values(published).reduce((n,a)=>n+a.photos.length,0)} photos`);
