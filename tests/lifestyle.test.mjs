import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {lifestyleThemes,lifestyleGalleryUrl} from '../public/lifestyle-data.js';
import {lifestyleAlbums} from '../public/lifestyle-albums.js';
import {createHash} from 'node:crypto';
import {filterCases,emptyFilters,readFilters} from '../public/filter.js';
const {cases}=JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url),'utf8'));

test('editorial gallery links have real results and preserve the promised vehicle/series scope',()=>{
  for(const theme of lifestyleThemes)for(const pick of theme.picks){
    const url=new URL(lifestyleGalleryUrl(pick),'https://example.test');
    const filters=readFilters(url.searchParams),results=filterCases(cases,filters);
    assert.ok(results.length,`${pick.car} ${pick.series}: empty gallery`);
    assert.equal(url.hash,'#photoResults');
    if(pick.scope==='vehicle'){
      assert.equal(filters.brand,'');assert.equal(filters.series,'');
      assert.ok(pick.label.includes(pick.car),'broader galleries must name the vehicle');
    }else{
      assert.ok(results.every(item=>item.car===pick.car&&item.brand===pick.brand),pick.car);
      assert.ok(filters.series,'an exact combination needs its series');
    }
    if(pick.sourceCaseId){const source=cases.find(item=>item.id===pick.sourceCaseId);assert.equal(source.image,pick.image);assert.equal(source.car,pick.car);assert.equal(source.brand,pick.brand);}
    // Old browsing conditions must not leak into a newly selected collection.
    assert.deepEqual({...emptyFilters(),...pick.filters},filters);
  }
});

test('all local collection pictures and requested videos exist',async()=>{
  const assets=new Set();for(const theme of lifestyleThemes){assets.add(theme.cover);assets.add(theme.scene);for(const pick of theme.picks){assets.add(pick.image);if(pick.video)assets.add(`/assets/lifestyle/${pick.video}.mp4`);}}
  for(const album of Object.values(lifestyleAlbums))for(const photo of album.photos){assets.add(photo.src);assets.add(photo.thumbnail);}
  for(const path of assets)if(path.startsWith('/'))await access(new URL('../public'+path,import.meta.url));
});

test('photo albums keep the reviewed car and series together without borrowing other cases',async()=>{
  const {albums:sources}=JSON.parse(await readFile(new URL('../audit/lifestyle-album-sources.json',import.meta.url),'utf8'));
  const {images:audit}=JSON.parse(await readFile(new URL('../audit/lifestyle-album-assets.json',import.meta.url),'utf8'));
  for(const theme of lifestyleThemes)for(const pick of theme.picks){
    const album=lifestyleAlbums[pick.album];assert.ok(album,`${pick.album} missing`);
    assert.equal(album.car,pick.displayCar||pick.car);assert.equal(album.brand,pick.brand);assert.equal(album.series,pick.series);
    assert.equal(album.photos[0].src,pick.image,'cover must belong to its album');
    assert.equal(new Set(album.photos.map(p=>p.src)).size,album.photos.length,'do not repeat photos to inflate the count');
    if(album.sourceCaseId){
      const original=JSON.parse(await readFile(new URL(`../public/data/details/${album.sourceCaseId}.json`,import.meta.url),'utf8'));
      assert.deepEqual(album.photos.map(p=>p.src),original.images);
    }else{
      const source=sources.find(a=>a.id===pick.album);assert.equal(album.photos.length,source.photos.length);
      for(const [index,photo] of album.photos.entries()){
        const record=audit.find(a=>a.output==='public'+photo.src);assert.ok(record);assert.equal(record.source,source.photos[index].source);
        assert.equal(record.car,album.car);assert.equal(record.brand,album.brand);assert.equal(record.series,album.series);
        const bytes=await readFile(new URL('../public'+photo.src,import.meta.url));
        assert.equal(createHash('sha256').update(bytes).digest('hex'),record.outputSha256);
      }
    }
  }
});
