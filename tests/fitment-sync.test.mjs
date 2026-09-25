import test from 'node:test';
import assert from 'node:assert/strict';
import {makeFitmentSnapshot, parseCsv} from '../scripts/fitment-sync-core.mjs';

test('only a visible, exact brand/code/car match becomes public fitment', () => {
  const csv = parseCsv([
    'ブランド,車種,品番,表示,年式（表示用テキスト）,年式 開始,年式 終了,型式,グレード,定員,特記事項,history',
    'Refinad/Sandii,ジムニー,S0113-02,表示,H30/07～,2018-07-01,2025-10-01,JB64W,"XC<br />XL",4,PRIVATE_NOTE,PRIVATE_HISTORY',
    'Refinad/Sandii,ジムニー,S0113-02,非表示,H26/08～,2014-08-01,2018-06-01,JB64W,HIDDEN,4,SECRET,SECRET',
    'Refinad/Sandii,別の車,S0113-02,表示,,,,,WRONG_CAR,4,SECRET,SECRET',
    'Dotty,ジムニー,S0113-02,表示,,,,,WRONG_BRAND,4,SECRET,SECRET',
    'Refinad/Sandii,ジムニー,S0113-03,表示,,,,,WRONG_CODE,4,SECRET,SECRET',
  ].join('\n'));
  const catalog={cases:[
    {id:'a',category:'seatcover',brand:'Refinad',car:'ジムニー'},
    {id:'b',category:'seatcover',brand:'Sandii',car:'別の車'},
    {id:'c',category:'seatcover',brand:'Refinad',car:'N-BOX'},
    {id:'p',category:'panel',brand:'Refinad',car:'ジムニー'},
  ]};
  const details={
    a:{photoInfo:[{'品番':'S0113-02'}]},
    b:{photoInfo:[{'品番':'S0113-04'}]},
    c:{photoInfo:[{'品番':'S0113-02'}]},
  };
  const {snapshot,audit}=makeFitmentSnapshot(csv,catalog,details,'2026-09-25T00:00:00Z');
  assert.deepEqual(Object.keys(snapshot.cases),['a']);
  assert.equal(audit.linkedCases,1);
  assert.equal(audit.carMismatch,1);
  assert.equal(snapshot.cases.a.rows[0].grade,'XC\nXL');
  assert.equal(snapshot.cases.a.rows[0].seats,'4');
  assert.doesNotMatch(JSON.stringify(snapshot),/PRIVATE|SECRET|HIDDEN|WRONG_/);
});

test('quoted commas and line breaks stay within their source cells', () => {
  const rows=parseCsv('車種,グレード\r\nジムニー,"XC, XL\n特別仕様"\r\n');
  assert.deepEqual(rows,[['車種','グレード'],['ジムニー','XC, XL\n特別仕様']]);
});
