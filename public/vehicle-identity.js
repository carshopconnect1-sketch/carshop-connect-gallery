const key = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s・･:：.．/／‐‑–—−-]/g, '');

// Explicitly reviewed names only. Never strip body, generation or capacity
// labels: a van, wagon, hybrid or F60 selection must retain its own cases.
const names = [
  {makers:['ルノー'],car:'ルノー カングー',aliases:['カングー']},
  {makers:['三菱','ミツビシ'],car:'デリカD:5',aliases:['デリカ:D5','デリカⅮ：5']},
  {makers:['ダイハツ','トヨタ'],car:'コペンGRスポーツ',aliases:[]},
  {makers:['トヨタ'],car:'プログレ',aliases:['プログレス']},
  {makers:['ホンダ'],car:'N-ONE',aliases:['NｰONE']},
  {makers:['ジープ'],car:'ジープラングラー',aliases:['Jeepラングラー','JEEPラングラー']},
  {makers:['アウディ'],car:'アウディ Q3',aliases:['AUDI Q3','Q3']},
  {makers:['アウディ'],car:'アウディ A1',aliases:['AUDI A1','A1']},
  {makers:['BMW'],car:'BMW 3シリーズ',aliases:['BMW3シリーズ','BMW3Series']},
  {makers:['BMW'],car:'BMW 2シリーズ',aliases:['BMW2シリーズ','BMW2Series']},
  {makers:['スズキ'],car:'ソリオバンディット',aliases:['ソリオ バンディット','ソリオバンデット','ソリオバンディッド']},
  {makers:['トヨタ'],car:'ランドクルーザープラド',aliases:['ランクル プラド','プラド']},
  {makers:['MINI'],car:'MINI クロスオーバー',aliases:['MINI CROSSOVER','MINICROSSOVER']},
  {makers:['MINI'],car:'MINI クーパーS',aliases:['MINIクーパーS']},
  {makers:['MINI'],car:'MINI',aliases:['ミニ']},
  {makers:['トヨタ'],car:'カローラルミオン',aliases:['ルミオン']},
  {makers:['フォルクスワーゲン'],car:'ポロ',aliases:['VWポロ','フォルクスワーゲンポロ']},
  {makers:['フォルクスワーゲン'],car:'ゴルフ5',aliases:['VWゴルフ5']},
  {makers:['トヨタ'],car:'スペイド',aliases:['スペイドDBA-NSP141']},
  {makers:['トヨタ'],car:'タウンエースバン',aliases:['タウンエース','タウンエース バン']},
  {makers:['スズキ'],car:'エブリィ',aliases:['エブリイ','エブリィ(バン)','エブリイ(バン)']},
].map(row=>({...row,keys:new Set([row.car,...row.aliases].map(key))}));

const byMaker=new Map(),withoutMaker=new Map();
for(const row of names)for(const alias of row.keys){
  withoutMaker.set(alias,row);
  for(const maker of row.makers)byMaker.set(`${maker}|${alias}`,row);
}
const matchingName=(maker,car)=>maker?byMaker.get(`${maker}|${key(car)}`):withoutMaker.get(key(car));
export function canonicalVehicle(maker, car) {
  return matchingName(maker,car)?.car || car;
}

export function vehicleSearchNames(maker,car) {
  const row=matchingName(maker,car);
  return row?[row.car,...row.aliases]:[car];
}

const fitmentAliases = {
  'ルノーカングー': ['カングー'],
  'カングー': ['ルノーカングー'],
  'nboxnboxカスタム': ['nbox','nboxカスタム'],
  'ハイエース': ['ハイエースバン','ハイエースワゴン4列','ハイエースワゴン'],
  'mini': ['mini3ドア','mini5ドア','miniクラブマン'],
  'mazda3': ['mazda3ファストバック','mazda3セダン'],
  'fiatフィアット500500cチンクエチェント': ['fiat500500c'],
};

export function fitmentVehicleMatches(galleryCar, masterCar) {
  const gallery = key(canonicalVehicle('',galleryCar)), master = key(canonicalVehicle('',masterCar));
  return gallery === master || (fitmentAliases[gallery] || []).includes(master);
}
