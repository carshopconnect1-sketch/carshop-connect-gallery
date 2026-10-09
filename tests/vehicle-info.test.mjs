import test from 'node:test';
import assert from 'node:assert/strict';
import {postedVehicleInfo} from '../public/vehicle-info.js';
test('only explicitly submitted model tokens are extracted and product codes are removed',()=>{
  const a=postedVehicleInfo({'品番':'J0601-01','型式':'品 番 J0601-01 車 種 ジープラングラー 年 式 H24(2012)/11 定 員 5人 型 式 アンリミテッド ABA- JK36LR'},[{model:'ABA-JK36LR'}]);
  assert.equal(a['型式'],'ABA-JK36LR');assert.equal(a['車両情報'],'アンリミテッド ABA- JK36LR');
  const b=postedVehicleInfo({'品番':'D0126-15','型式':'タント ファンクロス D0126-15'},[{model:'LA650S / LA660S'}]);
  assert.equal(b['型式'],undefined);assert.equal(b['車両情報'],'タント ファンクロス');
  assert.equal(postedVehicleInfo({'品番':'TT3-135-05','型式':'ハイエースワゴンGL'},[{model:'TRH214 / TRH219'}])['型式'],undefined);
  assert.equal(postedVehicleInfo({'品番':'S0646-01','型式':''},[{model:'JC74W'}])['型式'],undefined);
  assert.equal(postedVehicleInfo({'型式':'ジムニー JB64'},[{model:'JB64W'}])['型式'],undefined);
  assert.equal(postedVehicleInfo({'型式':'プログレ NC300'},[{model:'JCG10 / JCG11'}])['型式'],undefined);
});
test('literal prefixes, model suffixes, and separately submitted vehicle information are preserved',()=>{
  assert.equal(postedVehicleInfo({'型式':'ルノー カングー 3DA-KFKK9K'},[{model:'7DA-KFKK9K'}])['型式'],'3DA-KFKK9K');
  assert.equal(postedVehicleInfo({'型式':'MXPL10G-MWXUB'},[{model:'MXPL10G'}])['型式'],'MXPL10G-MWXUB');
  const value=postedVehicleInfo({'型式':'jf5','車両情報':'ファッションスタイル'},[{model:'JF5 / JF6'}]);
  assert.equal(value['型式'],'JF5');assert.equal(value['車両情報'],'ファッションスタイル');
});
