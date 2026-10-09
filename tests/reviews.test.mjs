import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewExcerpt,createDetailLoader,publishedReviewText} from '../public/reviews.js';

test('review excerpts retain the original difficulty and do not rewrite the customer voice',()=>{
  assert.deepEqual(reviewExcerpt('  取付けは大変。でも気に入っています。  ',8),{text:'取付けは大変。で…',truncated:true});
  assert.deepEqual(reviewExcerpt('取付けは大変。'),{text:'取付けは大変。',truncated:false});
  assert.deepEqual(reviewExcerpt('  \n  '),{text:'',truncated:false});
  assert.deepEqual(reviewExcerpt('嬉しい🚗です',4),{text:'嬉しい🚗…',truncated:true});
});

test('legacy purchase-link labels do not become customer quotes; staff-entered wording is preserved',()=>{
  assert.equal(publishedReviewText({sourceFile:'toyota_alphard.html',review:'装着は大変でした。       ご購入はこちら'}),'装着は大変でした。');
  assert.equal(publishedReviewText({review:'参考になったら、ご購入はこちら'}),'参考になったら、ご購入はこちら');
});

test('review cards and the photo dialog share a pending detail request',async()=>{
  let resolveDetail,requests=0;
  const load=createDetailLoader(()=>{requests++;return new Promise(resolve=>{resolveDetail=resolve;});});
  const card=load('case1'),dialog=load('case1');
  await Promise.resolve();
  resolveDetail({images:['/photo1.jpg'],review:'装着は大変でした。'});
  assert.deepEqual(await card,{images:['/photo1.jpg'],review:'装着は大変でした。'});
  assert.deepEqual(await dialog,await card);
  assert.deepEqual(await load('case1'),await card);
  assert.equal(requests,1);
});

test('unavailable details can be retried without keeping an empty or failed review',async()=>{
  let requests=0;
  const load=createDetailLoader(async()=>++requests===1?{images:[]}:{images:['/photo2.jpg'],review:'色に満足。'});
  await assert.rejects(load('case2'));
  assert.deepEqual(await load('case2'),{images:['/photo2.jpg'],review:'色に満足。'});
});
