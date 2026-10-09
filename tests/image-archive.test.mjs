import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {loadGalleryBase} from '../scripts/gallery-base.mjs';
import {photoReplacement,detailReplacement} from '../public/photo-replacements.js';
const pub=path.resolve('public');
test('the complete gallery resolves to repository images with unchanged counts, dates, and privacy corrections',async()=>{
 const base=await loadGalleryBase(pub),archive=JSON.parse(await readFile('audit/image-archive-2026-10-09.json','utf8'));
 assert.equal(base.catalog.cases.length,2960);
 const paths=new Set();let photos=0,missing=0;
 for(const item of base.catalog.cases){
  const output=photoReplacement(item,base.replacements);
  assert.equal(output.firstPublishedAt,item.firstPublishedAt);
  assert.equal(output.photoCount,item.photoCount);
  for(const key of ['image','thumbnail','previewImage'])if(output[key]){assert.ok(output[key].startsWith('/assets/'),`${item.id}:${key}`);paths.add(output[key]);}
  const before=base.details[item.id],after=detailReplacement(item.id,before,base.replacements);
  assert.equal(after.images.length,before.images.length);assert.equal(after.review,before.review);
  for(const url of after.images){assert.ok(url.startsWith('/assets/'),item.id);paths.add(url);photos++;if(url.endsWith('/image-unavailable.svg'))missing++;}
  for(const correction of base.replacements.cases?.[item.id]||[]){if(before.images.includes(correction.source))assert.ok(after.images.includes(correction.url));if(correction.privacy)assert.equal(output.galleryUrl,'');}
 }
 assert.equal(photos,10354);assert.equal(missing,3);assert.equal(archive.summary.savedDetailReferences,10351);
 for(const url of paths)assert.ok((await stat(path.join(pub,url.slice(1)))).size>0,url);
});
