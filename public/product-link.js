import {findSeries} from './series-data.js';

export function productLink(item, directUrl = '', vehicleProductLinks = {}) {
  if (directUrl) return {url: directUrl, label: 'この商品を見る ↗'};
  const vehicleUrl = vehicleProductLinks[`${item.maker}|${item.car}`];
  if (vehicleUrl) return {url: vehicleUrl, label: `${item.car}の商品を探す ↗`};
  const matched = findSeries(item.brand, item.series);
  if (matched?.productUrl) return {url: matched.productUrl, label: `${matched.label}の商品を見る ↗`};
  return {url: 'https://seatcover.jp/f/carlist_renewal.html', label: '車種から商品を探す ↗'};
}
