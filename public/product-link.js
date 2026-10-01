import {findSeries} from './series-data.js';

export function productLink(item, directUrl = '', vehicleProductLinks = {}, linkReason = '') {
  if (directUrl) return {url: directUrl, label: 'この商品を見る ↗'};
  if (['photo_code_not_selectable', 'photo_code_absent', 'identity_unresolved'].includes(linkReason)) {
    return {url: 'https://seatcover.jp/f/match_renewal', label: '適合を確認して商品を探す ↗'};
  }
  const vehicleUrl = vehicleProductLinks[`${item.maker}|${item.car}`];
  if (vehicleUrl) return {url: vehicleUrl, label: `${item.car}の商品を探す ↗`};
  const matched = findSeries(item.brand, item.series);
  if (matched?.productUrl) return {url: matched.productUrl, label: `${matched.label}の商品を見る ↗`};
  return {url: 'https://seatcover.jp/f/carlist_renewal.html', label: '車種から商品を探す ↗'};
}
