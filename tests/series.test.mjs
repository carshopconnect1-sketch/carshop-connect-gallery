import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {seriesCatalog,findSeries} from '../public/series-data.js';
import {emptyFilters,filterCases,facet} from '../public/filter.js';

test('all 51 official portrait assets retain their source bytes and correct brand destinations',()=>{
 const audit=JSON.parse(readFileSync(new URL('../audit/series-assets.json',import.meta.url)));
 assert.equal(seriesCatalog.length,51);assert.equal(new Set(seriesCatalog.map(s=>s.id)).size,51);
 for(const s of seriesCatalog){
  const source=audit.find(a=>a.local===s.image);assert.ok(source);
  assert.ok(source.height>source.width);assert.equal(s.productUrl,source.page);
  assert.ok(s.productUrl.includes(`/seatcovermaker/${s.brand.toLowerCase()}/`));
  const bytes=readFileSync(new URL('../public'+s.image,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);
 }
});

test('series aliases select the same photographs without including panels or another series',()=>{
 const cases=[
  {id:'a',brand:'Sandii',series:'マカロン',colors:['beige']},
  {id:'b',brand:'Sandii',series:'macaron マカロンシリーズ',colors:['beige']},
  {id:'c',brand:'Sandii',series:'カヌレ',colors:['beige']},
  {id:'d',brand:'Refinad',series:'Heritage'},
  {id:'e',brand:'Refinad',series:'Heritage Mesh'},
  {id:'f',brand:'Refinad',series:'Heritage Interior Panel'},
  {id:'g',brand:'Refinad',series:'Heritage Kachina'},
 ];
 for(const series of ['マカロン','macaron マカロンシリーズ']){
  assert.deepEqual(filterCases(cases,{...emptyFilters(),brand:'Sandii',series,color:'beige'}).map(c=>c.id),['a','b']);
 }
 assert.equal(new Map(facet(cases,{...emptyFilters(),brand:'Sandii'},'series')).get('マカロン'),2);
 assert.deepEqual(filterCases(cases,{...emptyFilters(),series:'Heritage Series'}).map(c=>c.id),['d']);
 assert.equal(findSeries('Refinad','Heritage Interior Panel'),undefined);
 assert.equal(findSeries('Refinad','Heritage Kachina'),undefined);
 assert.equal(findSeries('Dotty','LUXUR-BS'),undefined);
 assert.equal(findSeries('IXUS','ファブリック'),undefined);
 assert.equal(findSeries('IXUS','レザリーデニム').id,'ixus-ly');
});
