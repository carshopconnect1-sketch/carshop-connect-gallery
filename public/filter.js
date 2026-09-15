import {canonicalSeries} from './series-data.js';
export const emptyFilters = () => ({ q: '', maker: '', car: '', brand: '', category: '', series: '', color: '', colorName: '', review: false });
export const colorOptions = [
  ['black','ブラック','#252424','黒'],['brown','ブラウン','#825739','茶 キャメル'],
  ['beige','ベージュ','#d6c5aa','アイボリー'],['white','ホワイト','#faf8f1','白'],
  ['gray','グレー','#999995','灰 シルバー'],['red','レッド','#8e3540','赤 ワイン'],
  ['blue','ブルー','#486b88','青 ネイビー'],['green','グリーン','#667963','緑'],
  ['yellow','イエロー','#d4b15a','黄'],['orange','オレンジ','#bd7c49','橙'],
  ['pink','ピンク','#d49b9f','桃'],['purple','パープル','#977296','紫'],
  ['other','その他','#b4a28d','ビンテージ']
];

export function normalize(text = '') {
  return text.normalize('NFKC').toLowerCase()
    .replace(/[\u3041-\u3096]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/ヴ/g, 'ブ')
    .replace(/[\s\-‐‑–—−・･:：/／()（）]/g, '');
}

export function matches(item, filters, ignore = '') {
  for (const key of ['maker', 'car', 'brand', 'category', 'series', 'colorName']) {
    if (key !== ignore && filters[key]) {
      if(key === 'series') {if(canonicalSeries(item.brand,item.series) !== canonicalSeries(item.brand,filters.series))return false;}
      else if(item[key] !== filters[key]) return false;
    }
  }
  if (ignore !== 'color' && filters.color && !item.colors?.includes(filters.color)) return false;
  if (ignore !== 'review' && filters.review && !item.hasReview) return false;
  if (ignore !== 'q' && filters.q) {
    const aliases = { Refinad: 'レフィナード', Sandii: 'サンディ サンディー', Dotty: 'ダティ ダティー', IXUS: 'イクサス' };
    const colorWords=colorOptions.filter(([key])=>item.colors?.includes(key)).map(([,label,,alias])=>label+' '+alias).join(' ');
    const haystack = normalize([item.maker, item.car, item.brand, aliases[item.brand] || '', item.series, item.colorName || '', colorWords,
      item.category === 'panel' ? 'インテリアパネル' : 'シートカバー'].join(' '));
    const tokens = filters.q.trim().split(/\s+/).map(normalize).filter(Boolean);
    if (!tokens.every(token => haystack.includes(token))) return false;
  }
  return true;
}

export function filterCases(cases, filters) { return cases.filter(item => matches(item, filters)); }
export function facet(cases, filters, key) {
  const counts = new Map();
  for (const item of cases) if (matches(item, filters, key)) {
    if(key==='car' && item.carKnown===false) continue;
    const values=key==='color' ? [...new Set(item.colors || [])] : [key==='series'?canonicalSeries(item.brand,item.series):item[key]];
    for(const value of values) if(value) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
}
export function readFilters(params) {
  const f = emptyFilters();
  for (const k of ['q','maker','car','brand','category','series','color','colorName']) f[k] = params.get(k) || '';
  f.review = params.get('review') === '1';
  return f;
}
export function filtersToParams(f) {
  const p = new URLSearchParams();
  for (const k of ['q','maker','car','brand','category','series','color','colorName']) if (f[k]) p.set(k, f[k]);
  if (f.review) p.set('review', '1');
  return p;
}
