import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {lifestyleThemes,lifestyleGalleryUrl} from '../public/lifestyle-data.js';
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
  for(const path of assets)if(path.startsWith('/'))await access(new URL('../public'+path,import.meta.url));
});
