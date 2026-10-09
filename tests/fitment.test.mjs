import test from 'node:test';
import assert from 'node:assert/strict';
import {createFitmentResolver} from '../public/fitment.js';
import * as fitmentFormatting from '../public/fitment.js';

const resolve=createFitmentResolver({records:[
  {group:'Refinad/Sandii',car:'カングー',code:'R0416-08',model:'3BA-KFKH5H / 7DA-KFKK9K'},
  {group:'Refinad/Sandii',car:'ハイエース バン',code:'T0026-09',model:'GDH201 / GDH206'},
  {group:'IXUS',car:'ハイエース ワゴン 4列',code:'TT3-135-05',model:'TRH214 / TRH219'},
  {group:'Refinad/Sandii',car:'MINI 3ドア',code:'BM0205-02',model:'SR16'},
  {group:'Refinad/Sandii',car:'MINI クラブマン',code:'BM0205-02',model:'SR16'},
  {group:'Refinad/Sandii',car:'N-BOX',code:'H0056-14',model:'JF5 / JF6'},
  {group:'Refinad/Sandii',car:'N-BOX カスタム',code:'H0056-14',model:'JF5 / JF6'},
]});
const match=(car,code,brand='Sandii')=>resolve({car,brand,category:'seatcover'},{photoInfo:[{'品番':code}]});
test('only explicit aliases with the same brand group and full code expose candidate vehicle names',()=>{
  assert.equal(match('ルノー カングー','R0416-08').rows[0].car,'カングー');
  assert.equal(match('ハイエース','T0026-09').rows[0].car,'ハイエース バン');
  assert.equal(match('ハイエース','TT3-135-05','IXUS').rows[0].car,'ハイエース ワゴン 4列');
  assert.equal(match('MINI','BM0205-02').rows.length,2);
  assert.equal(match('N-BOX・N-BOXカスタム','H0056-14').rows.length,2);
  assert.equal(match('ハイエース バン','TT3-135-05','IXUS'),null);
  assert.equal(match('ジムニー','R0416-08'),null);
  assert.equal(match('カングー','R0416-081'),null);
  assert.equal(match('カングー','R0416-08','IXUS'),null);
  assert.equal(resolve({car:'カングー',brand:'Sandii',category:'seatcover'},{photoInfo:[{'品番':'R0416-08'},{'品番':'OTHER'}]}),null);
});

test('open-ended year ranges distinguish a start month from an end month',()=>{
  assert.equal(fitmentFormatting.formatFitmentPeriod?.({yearStart:'2025-11-01',yearEnd:''}),'2025/11 ～');
  assert.equal(fitmentFormatting.formatFitmentPeriod?.({yearStart:'',yearEnd:'2025-10-01'}),'～ 2025/10');
  assert.equal(fitmentFormatting.formatFitmentPeriod?.({yearStart:'2018-07-01',yearEnd:'2025-10-01'}),'2018/07 ～ 2025/10');
  assert.equal(fitmentFormatting.formatFitmentPeriod?.({}), '');
});

test('Delica D:5 labels match the same master vehicle and never Delica D:2',()=>{
 const resolveDelica=createFitmentResolver({records:[{group:'Refinad/Sandii',car:'デリカ D5',code:'MI0164-02',model:'CV1W'}]});
 for(const car of ['デリカD:5','デリカ:D5','デリカⅮ：5'])assert.equal(resolveDelica({car,brand:'Refinad',category:'seatcover'},{photoInfo:[{'品番':'MI0164-02'}]})?.rows[0].model,'CV1W');
 assert.equal(resolveDelica({car:'デリカD:2',brand:'Refinad',category:'seatcover'},{photoInfo:[{'品番':'MI0164-02'}]}),null);
});
