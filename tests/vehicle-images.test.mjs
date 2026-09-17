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
