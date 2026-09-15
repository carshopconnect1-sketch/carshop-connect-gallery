import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyFilters,filterCases} from '../public/filter.js';
import {removeCondition,recoveryOptions,carChoices} from '../public/finder-state.js';
const cases=[
 {maker:'トヨタ',car:'ハイエース',brand:'Sandii',series:'マカロン',category:'seatcover',colors:['beige'],colorName:'ベージュ'},
 {maker:'トヨタ',car:'ハイエース',brand:'Refinad',series:'Leather Series',category:'seatcover',colors:['black'],colorName:'ブラック'},
 {maker:'トヨタ',car:'アルファード',brand:'Refinad',series:'Leather Series',category:'seatcover',colors:['black'],colorName:'ブラック'},
 {maker:'ホンダ',car:'N-BOX',brand:'Sandii',series:'マカロン',category:'seatcover',colors:['beige'],colorName:'ベージュ'},
 {maker:'トヨタ',car:'車種名未掲載',carKnown:false,brand:'IXUS',series:'デニム',colors:[]}
];
test('removing a parent clears its dependents and preserves unrelated choices without mutation',()=>{
 const original={...emptyFilters(),maker:'トヨタ',car:'ハイエース',brand:'Sandii',series:'マカロン',color:'beige',colorName:'ベージュ'};
 const byMaker=removeCondition(original,'maker');assert.equal(byMaker.maker,'');assert.equal(byMaker.car,'');assert.equal(byMaker.series,'マカロン');assert.equal(byMaker.colorName,'ベージュ');
 const byBrand=removeCondition(original,'brand');assert.equal(byBrand.brand,'');assert.equal(byBrand.series,'');assert.equal(byBrand.colorName,'');assert.equal(byBrand.car,'ハイエース');assert.equal(byBrand.color,'beige');
 const byColor=removeCondition(original,'color');assert.equal(byColor.colorName,'');assert.equal(byColor.series,'マカロン');assert.equal(original.maker,'トヨタ');
});
test('car candidate search normalizes text, keeps alternatives to the current car, and excludes unnamed cars',()=>{
 const state={...emptyFilters(),maker:'トヨタ',car:'アルファード',brand:'Sandii'};
 assert.deepEqual(carChoices(cases,state,'はい えーす'),[{name:'ハイエース',count:1}]);
 assert.equal(carChoices(cases,state).some(x=>x.name==='車種名未掲載'),false);
 assert.equal(carChoices(cases,{...emptyFilters(),maker:'ホンダ'},'ｎ ｂｏｘ')[0].name,'N-BOX');
 assert.deepEqual(carChoices(cases,state,'不存在'),[]);
});
test('zero-result recovery offers actual positive counts and never silently changes filters',()=>{
 const state={...emptyFilters(),maker:'トヨタ',car:'ハイエース',brand:'Sandii',color:'black'};
 assert.equal(filterCases(cases,state).length,0);
 const options=recoveryOptions(cases,state);
 assert.ok(options.some(o=>o.key==='color'&&o.count===1));
 for(const option of options){assert.ok(option.count>0);assert.equal(option.count,filterCases(cases,option.next).length);}
 assert.equal(state.color,'black');assert.equal(state.brand,'Sandii');
});
test('recovery does not invent alternatives when no one-condition removal can produce a result',()=>{
 assert.deepEqual(recoveryOptions(cases,{...emptyFilters(),q:'存在しないキーワード',maker:'未収録メーカー'}),[]);
});
