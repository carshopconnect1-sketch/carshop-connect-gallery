// Editorial ideas, not inferred owner attributes. Source audit: lifestyle-assets.json.
export const lifestyleThemes = [
  {
    id:'city',label:'街乗りを、軽やかに。',english:'MY EVERYDAY',
    cover:'/assets/lifestyle/city-scene.webp',coverAlt:'街並みに映えるムーヴキャンバス',
    heading:'いつもの道も、お気に入りの時間に。',
    description:'お買い物も、近所へのドライブも。明るい色とやさしい風合いで、毎日乗りたくなる車内へ。',
    scene:'/assets/lifestyle/canvas-drive.webp',sceneAlt:'Sandii ビスキュイを装着したムーヴキャンバスで過ごすひととき',caption:'ムーヴキャンバス × Sandii ビスキュイ',
    picks:[
      {car:'ムーヴキャンバス',brand:'Sandii',series:'ビスキュイ',image:'/assets/lifestyle/canvas-biscuit.webp',video:'city',seconds:22,filters:{maker:'ダイハツ',car:'ムーヴキャンバス',brand:'Sandii',series:'ビスキュイ'},label:'この組み合わせの装着写真'},
      {car:'ラパン',brand:'Sandii',series:'ビスキュイ',image:'/assets/lifestyle/lapin-biscuit.webp',video:'lapin',seconds:17,filters:{maker:'スズキ',car:'ラパン'},label:'ラパンの装着写真',scope:'vehicle'}
    ]
  },
  {
    id:'cute',label:'「かわいい」を、相棒に。',english:'PLAY WITH COLOR',
    cover:'/assets/lifestyle/hustler-glace.webp',coverAlt:'ハスラーの白とブラウンのツートーンの車内',
    heading:'ドアを開けるたび、好きな色。',description:'ころんとした愛車に、遊び心をひとさじ。ツートーンや淡いカラーで、自分らしい「かわいい」を。',
    scene:'/assets/lifestyle/cute-scene.webp',sceneAlt:'Sandii ビスキュイを装着したラパンで過ごすドライブのひととき',caption:'ラパン × Sandii ビスキュイ',
    picks:[
      {car:'ハスラー',brand:'Sandii',series:'カヌレグラッセ',image:'/assets/lifestyle/hustler-glace.webp',video:'cute',seconds:18,filters:{maker:'スズキ',car:'ハスラー',brand:'Sandii',series:'カヌレグラッセ'},label:'この組み合わせの装着写真'},
      {car:'ムーヴキャンバス',brand:'Sandii',series:'マカロン',image:'/assets/lifestyle/canvas-macaron.webp',filters:{maker:'ダイハツ',car:'ムーヴキャンバス',brand:'Sandii',series:'マカロン'},label:'この組み合わせの装着写真'}
    ]
  },
  {
    id:'outdoor',label:'休日は、外へ。',english:'WEEKEND OUTDOORS',
    cover:'/assets/owners/yohei-camp.jpg',coverAlt:'ラングラーとテント、自然の中で過ごす休日',
    heading:'お気に入りの道具と、もう少し遠くへ。',description:'キャンプに、気ままな遠出に。柄や深みのある色を取り入れて、出かける気分が高まる車内へ。',
    scene:'/assets/owners/yohei-camp.jpg',sceneAlt:'Yoheiさんのラングラーとキャンプの道具',caption:'Yoheiさんのラングラーとの休日',
    article:{label:'実際のオーナーの休日をC/LOGで読む',url:'https://seatcover.jp/clog/articles/interview-jeep-yohhei.html'},
    picks:[
      {car:'ジムニー',brand:'Sandii',series:'カチナ',image:'/assets/owners/yayoi-interior.jpg',filters:{maker:'スズキ',car:'ジムニー',brand:'Sandii',series:'カチナ'},label:'この組み合わせの装着写真'},
      {car:'デリカD:5',brand:'Refinad',series:'ヘリテージフィールド',image:'/assets/owners/michan-interior.jpg',filters:{maker:'三菱',q:'デリカD5'},label:'デリカD:5の装着写真',scope:'vehicle'}
    ]
  },
  {
    id:'quality',label:'くつろぎを、上質に。',english:'A QUIET MOMENT',
    cover:'/assets/lifestyle/quality-scene.webp',coverAlt:'アルファードの後席でゆったり過ごすひととき',
    heading:'大切な人を、心地よく迎える。',description:'落ち着いた色と、端正なステッチ。ドライブの時間まで楽しめる、くつろぎの空間を。',
    scene:'/assets/lifestyle/quality-scene.webp',sceneAlt:'Refinad アストレアを装着したアルファードの後席でくつろぐ場面',caption:'アルファード × Refinad アストレア',
    picks:[
      {car:'アルファード',brand:'Refinad',series:'アストレア',image:'/assets/lifestyle/alphard-astraea.webp',video:'quality',seconds:20,filters:{maker:'トヨタ',car:'アルファード'},label:'アルファードの装着写真',scope:'vehicle'},
      {car:'ハリアー',brand:'Refinad',series:'レザーデラックス',image:'https://refinad.com/wp-content/uploads/2025/06/IMG_1992.jpeg.webp',sourceCaseId:'e96cbf8bdac1',filters:{maker:'トヨタ',car:'ハリアー',brand:'Refinad',series:'Leather Deluxe Series'},label:'この組み合わせの装着写真'}
    ]
  }
];
export function lifestyleGalleryUrl(pick){return '/?'+new URLSearchParams(pick.filters).toString()+'#photoResults';}
