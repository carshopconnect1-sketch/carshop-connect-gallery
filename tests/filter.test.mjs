import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyFilters,filterCases,facet,readFilters,filtersToParams} from '../public/filter.js';
const records=[
 {id:'a',maker:'ホンダ',car:'N-BOX',brand:'Sandii',series:'マカロン',category:'seatcover',hasReview:true,colorName:'シルキーベージュ',colors:['beige']},
 {id:'b',maker:'ホンダ',car:'N-BOX',brand:'Refinad',series:'Leather Series',category:'seatcover',hasReview:false,colorName:'ブラック',colors:['black']},
 {id:'c',maker:'ダイハツ',car:'ムーヴキャンバス',brand:'Sandii',series:'マカロン',category:'seatcover',hasReview:true,colorName:'グレージュ',colors:['gray','beige']},
 {id:'d',maker:'トヨタ',car:'ハイエース',brand:'Refinad',series:'Heritage Interior Panel',category:'panel',hasReview:false}
];
const ids=f=>filterCases(records,{...emptyFilters(),...f}).map(x=>x.id);
test('vehicle keyword accepts full width, case, spaces, Japanese aliases and voiced spelling',()=>{
 assert.deepEqual(ids({q:'Ｎ　ＢＯＸ'}),['a','b']);assert.deepEqual(ids({q:'n-box サンディ'}),['a']);
 assert.deepEqual(ids({q:'むーぶきゃんばす'}),['c']);assert.deepEqual(ids({q:'レフィナード パネル'}),['d']);
});
test('multiple filters are AND, including zero matches and review-only',()=>{
 assert.deepEqual(ids({maker:'ホンダ',brand:'Sandii',series:'マカロン',review:true}),['a']);
 assert.deepEqual(ids({maker:'ホンダ',category:'panel'}),[]);assert.deepEqual(ids({brand:'Refinad',review:true}),[]);
});
test('facet count ignores its own selection and honours the rest',()=>{
 assert.deepEqual(new Map(facet(records,{...emptyFilters(),car:'N-BOX',brand:'Sandii'},'brand')),new Map([['Sandii',1],['Refinad',1]]));
});
test('URL round trip preserves Japanese and review toggle without arbitrary keys',()=>{
 const state={...emptyFilters(),q:'N-BOX サンディ',maker:'ホンダ',color:'beige',colorName:'シルキーベージュ',review:true};assert.deepEqual(readFilters(filtersToParams(state)),state);
 assert.equal(filtersToParams(emptyFilters()).toString(),'');assert.equal(readFilters(new URLSearchParams('review=0')).review,false);
});

test('color family, exact label, brand and series combine without guessing unlabelled photos',()=>{
 assert.deepEqual(ids({brand:'Sandii',series:'マカロン',color:'beige'}),['a','c']);
 assert.deepEqual(ids({color:'beige',colorName:'グレージュ'}),['c']);
 assert.deepEqual(ids({color:'black',brand:'Sandii'}),[]);
 assert.deepEqual(ids({q:'黒'}),['b']);assert.deepEqual(ids({q:'シルキーベージュ'}),['a']);
 assert.deepEqual(new Map(facet(records,{...emptyFilters(),brand:'Sandii',color:'gray'},'color')),new Map([['beige',2],['gray',1]]));
});

test('maker-only records remain visible by brand and never become a car option',()=>{
 const unknown={id:'x',brand:'IXUS',maker:'トヨタ',car:'車種名未掲載',carKnown:false,colors:[]};
 assert.equal(filterCases([unknown],{...emptyFilters(),brand:'IXUS'}).length,1);
 assert.equal(filterCases([unknown],{...emptyFilters(),color:'black'}).length,0);
 assert.deepEqual(facet([unknown],emptyFilters(),'car'),[]);
});

test('Kangoo aliases share one facet and both existing search URLs find all cases',()=>{
 const cars=[{id:'a',maker:'ルノー',car:'カングー',colors:[]},{id:'b',maker:'ルノー',car:'ルノー カングー',colors:[]}];
 assert.deepEqual(filterCases(cars,{...emptyFilters(),car:'カングー'}).map(v=>v.id),['a','b']);
 assert.deepEqual(filterCases(cars,{...emptyFilters(),car:'ルノー カングー'}).map(v=>v.id),['a','b']);
 assert.deepEqual(facet(cars,emptyFilters(),'car'),[['ルノー カングー',2]]);
});

test('Delica D:5 spelling variants share one selection without merging D:2 or Delica Mini',()=>{
 const cars=['デリカD:5','デリカ:D5','デリカⅮ：5','デリカ D．5','デリカD:2','デリカミニ'].map((car,index)=>({id:String(index),maker:'三菱',car,colors:[]}));
 for(const car of ['デリカD:5','デリカ:D5','デリカＤ：５','デリカ D.5']){
  assert.deepEqual(filterCases(cars,{...emptyFilters(),maker:'三菱',car}).map(v=>v.id),['0','1','2','3']);
  assert.equal(readFilters(new URLSearchParams({maker:'三菱',car})).car,'デリカD:5');
 }
 assert.equal(new Map(facet(cars,emptyFilters(),'car')).get('デリカD:5'),4);
 assert.equal(facet(cars,emptyFilters(),'car').length,3);
});

test('Copen GR width variants and the old Progres typo retain all cases under one car choice',()=>{
 const cars=[
  {maker:'ダイハツ',car:'コペンGRスポーツ'},{maker:'ダイハツ',car:'コペンＧＲスポーツ'},
  {maker:'ダイハツ',car:'コペン'},{maker:'ダイハツ',car:'コペンセロ'},
  {maker:'トヨタ',car:'プログレ'},{maker:'トヨタ',car:'プログレス'}
 ].map((v,index)=>({...v,id:String(index),colors:[]}));
 assert.deepEqual(filterCases(cars,{...emptyFilters(),maker:'ダイハツ',car:'コペンＧＲスポーツ'}).map(v=>v.id),['0','1']);
 assert.deepEqual(filterCases(cars,{...emptyFilters(),maker:'トヨタ',car:'プログレ'}).map(v=>v.id),['4','5']);
 assert.equal(new Map(facet(cars,emptyFilters(),'car')).get('コペンGRスポーツ'),2);
 assert.equal(facet(cars,emptyFilters(),'car').length,4);
});
