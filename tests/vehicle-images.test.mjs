import test from 'node:test';
import assert from 'node:assert/strict';
import {vehicleImageCandidates} from '../public/vehicle-images.js';

test('vehicle image candidates reuse the current vehicle-search artwork before gallery photos',()=>{
  const gallery='https://seatcover.jp/gallerys/gallery/toyota_corollacross.html';
  const items=[{galleryUrl:`${gallery}#card-0`}];
  const urls=vehicleImageCandidates(items,{[gallery]:'https://seatcover.jp/c/toyota/corollacross'});
  assert.equal(urls[0],'https://m-connect.co.jp/images/carlist/corollacross.jpg');
  assert.equal(new Set(urls).size,urls.length);
});

test('vehicle image candidates strip gallery series suffixes and preserve a useful fallback candidate',()=>{
  const urls=vehicleImageCandidates([{galleryUrl:'https://seatcover.jp/gallerys/gallery/audi_q3-dep-v.html#card-1'}]);
  assert.equal(urls[0],'https://m-connect.co.jp/images/carlist/q3.jpg');
  assert.ok(urls.includes('https://m-connect.co.jp/images/carlist/q3depv.jpg'));
});

test('eK Cross uses the official ekx artwork instead of a missing ekcross file',()=>{
 const gallery='https://seatcover.jp/gallerys/gallery/mitsubishi_ekcross.html';
 assert.equal(vehicleImageCandidates([{galleryUrl:gallery+'#card-0'}],{[gallery]:'https://seatcover.jp/c/mitsubishi/ekcross'})[0],'https://m-connect.co.jp/images/carlist/ekx.jpg');
 assert.equal(vehicleImageCandidates([{galleryUrl:'https://seatcover.jp/gallerys/gallery/mitsubishi_ekxev.html'}])[0],'https://m-connect.co.jp/images/carlist/ekxev.jpg');
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
  assert.equal(vehicleImageCandidates([{maker,car,galleryUrl:'/'}])[0],`https://m-connect.co.jp/images/carlist/${file}.jpg`,car);
 }
 assert.equal(vehicleImageCandidates([{maker:'スズキ',car:'エブリィワゴン',galleryUrl:'/'}])[0],'https://m-connect.co.jp/images/carlist/everywagon.jpg');
});

test('Copen GR Sport uses GR vehicle artwork and remains distinct from the base car',()=>{
 const gr='https://toyota.jp/pages/contents/carlineup/archive/copen/images/copen-2019.jpg';
 for(const car of ['コペンGRスポーツ','コペンＧＲスポーツ']){
  assert.equal(vehicleImageCandidates([{maker:'ダイハツ',car,galleryUrl:'/'}])[0],gr);
 }
 assert.equal(vehicleImageCandidates([{maker:'ダイハツ',car:'コペン',galleryUrl:'/'}])[0],'https://m-connect.co.jp/images/carlist/copen.jpg');
 assert.deepEqual(vehicleImageCandidates([{maker:'ダイハツ',car:'未確認の車種',galleryUrl:'/'}]),[]);
});
