import test from 'node:test';
import assert from 'node:assert/strict';
import {isNewCase} from '../public/new-cases.js';

test('NEW expires after first publication and never labels undated or future cases',()=>{
  const now=Date.parse('2026-10-05T00:00:00Z');
  for(const [firstPublishedAt,expected] of [
    ['2026-10-05T00:00:00Z',true],
    ['2026-09-05T00:00:01Z',true],
    ['2026-09-05T00:00:00Z',false],
    ['2026-09-04T00:00:00Z',false],
    ['2026-10-06T00:00:00Z',false],
    ['not-a-date',false],['',false],[undefined,false],
  ])assert.equal(isNewCase({firstPublishedAt},now),expected,`publication ${firstPublishedAt}`);
});
