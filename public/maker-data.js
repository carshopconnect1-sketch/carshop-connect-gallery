const domestic = [
  ['トヨタ','toyota'],['日産','nissan'],['ホンダ','honda'],['マツダ','mazda'],
  ['三菱','mitsubishi'],['ダイハツ','daihatsu'],['スズキ','suzuki'],['スバル','subaru'],
  ['レクサス','lexus'],['いすゞ','isuzu']
];
const imported = [
  ['ジープ','jeep'],['アウディ','audi'],['BMW','bmw'],['メルセデス・ベンツ','mercedes-benz'],
  ['ボルボ','volvo'],['クライスラー','chrysler'],['フォード','ford'],['MINI','mini'],
  ['プジョー','peugeot'],['フォルクスワーゲン','volkswagen'],['フィアット','fiat'],
  ['ルノー','renault'],['シトロエン','citroen'],['ポルシェ','porsche']
];
export const makerCatalog = [
  ...domestic.map(([name,slug])=>({name,slug,region:'domestic'})),
  ...imported.map(([name,slug])=>({name,slug,region:'imported'}))
];
