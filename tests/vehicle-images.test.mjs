import test from 'node:test';
import assert from 'node:assert/strict';
import {vehicleImageCandidates} from '../public/vehicle-images.js';
import {vehicleArchiveUrls} from '../public/vehicle-archive-urls.js';
const archived=file=>vehicleArchiveUrls[`https://m-connect.co.jp/images/carlist/${file}.jpg`];

test('vehicle image candidates reuse the current vehicle-search artwork before gallery photos',()=>{
  const gallery='https://seatcover.jp/gallerys/gallery/toyota_corollacross.html';
  const items=[{galleryUrl:`${gallery}#card-0`}];
  const urls=vehicleImageCandidates(items,{[gallery]:'https://seatcover.jp/c/toyota/corollacross'});
  assert.equal(urls[0],archived('corollacross'));
  assert.ok(urls[0].startsWith('/assets/'));
  assert.equal(new Set(urls).size,urls.length);
});

test('vehicle image candidates strip gallery series suffixes and preserve a useful fallback candidate',()=>{
  const urls=vehicleImageCandidates([{galleryUrl:'https://seatcover.jp/gallerys/gallery/audi_q3-dep-v.html#card-1'}]);
  assert.equal(urls[0],archived('q3'));
  assert.ok(urls.every(url=>url.startsWith('/assets/')));
});

test('eK Cross uses the official ekx artwork instead of a missing ekcross file',()=>{
 const gallery='https://seatcover.jp/gallerys/gallery/mitsubishi_ekcross.html';
 assert.equal(vehicleImageCandidates([{galleryUrl:gallery+'#card-0'}],{[gallery]:'https://seatcover.jp/c/mitsubishi/ekcross'})[0],archived('ekx'));
 assert.equal(vehicleImageCandidates([{galleryUrl:'https://seatcover.jp/gallerys/gallery/mitsubishi_ekxev.html'}])[0],archived('ekxev'));
});

test('new cases select official vehicle artwork by maker and car even without an old gallery URL',()=>{
 const examples=[
  ['トヨタ','プログレ','progres'],
  ['ダイハツ','タントファンクロス','tantofuncross'],
  ['スズキ','エブリィ','everyvan'],
  ['スズキ','スーパーキャリィ','supercarry'],
  ['三菱','ekクロス','ekx']
 ];
 for(const [maker,car,file]of examples){
  assert.equal(vehicleImageCandidates([{maker,car,galleryUrl:'/'}])[0],archived(file),car);
 }
 assert.equal(vehicleImageCandidates([{maker:'スズキ',car:'エブリィワゴン',galleryUrl:'/'}])[0],archived('everywagon'));
});

test('Copen GR Sport uses GR vehicle artwork and remains distinct from the base car',()=>{
 const gr=vehicleImageCandidates([{maker:'ダイハツ',car:'コペンGRスポーツ',galleryUrl:'/'}])[0];
 assert.ok(gr.startsWith('/assets/'));
 for(const car of ['コペンGRスポーツ','コペンＧＲスポーツ']){
  assert.equal(vehicleImageCandidates([{maker:'ダイハツ',car,galleryUrl:'/'}])[0],gr);
 }
 assert.equal(vehicleImageCandidates([{maker:'ダイハツ',car:'コペン',galleryUrl:'/'}])[0],archived('copen'));
 assert.notEqual(gr,archived('copen'));
 assert.deepEqual(vehicleImageCandidates([{maker:'ダイハツ',car:'未確認の車種',galleryUrl:'/'}]),[]);
});
