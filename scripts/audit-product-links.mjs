// Reconcile archived links with public shop evidence and, when available,
// a private read-only export of the shop's product-page management UI.
// This script makes no requests and publishes neither admin URLs nor prices.
import {readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {findSeries} from '../public/series-data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async file => JSON.parse(await readFile(file, 'utf8'));
const catalog = await read(path.join(root, 'public/data/catalog.json'));
const ledgerPath = path.join(root, 'audit/direct-product-links-2026-09-25.json');
const previousLedger = new Map((await read(ledgerPath).catch(() => ({entries: []}))).entries.map(row => [row.caseId, row]));
const http = new Map((await read(path.join(root, '.source/link-audit-2026-09-25/http-results.json'))).map(row => [row.url, row]));
const internal = await read(path.join(root, '.source/internal-product-pages-2026-09-25.json')).catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
const cacheDir = process.argv[2] || path.resolve(root, '../prototype/.preview/my-car-cache');
const vehicleCatalogs = new Map();
for (const filename of await readdir(cacheDir)) {
  if (!filename.endsWith('.json') || filename.includes('fitsearch')) continue;
  const source = await read(path.join(cacheDir, filename));
  if (!Array.isArray(source.products) || !source.categoryUrl) continue;
  vehicleCatalogs.set(source.categoryUrl, source);
}

// NFKC and spacing only. Synonym guesses can collapse distinct vehicles or
// series, so a title mismatch stays unresolved for manual review.
const normalized = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s・._-]/g, '');
const galleryCarForAdmin = {
  'ハイエース バン': 'ハイエース', 'ムーヴ キャンバス': 'ムーヴキャンバス',
  'デリカ D：５': 'デリカD:5', 'ジムニー シエラ': 'ジムニーシエラ',
  'N-BOX': 'N-BOX・N-BOXカスタム', 'N-BOX カスタム': 'N-BOX・N-BOXカスタム',
  'ヤリス クロス': 'ヤリスクロス', 'カングー': 'ルノー カングー',
  'ヴェゼル ハイブリッド': 'ヴェゼルハイブリッド',
};
const galleryMakerForAdmin = {'ニッサン': '日産', 'ミツビシ': '三菱'};
const adminByCode = new Map();
for (const scan of internal?.scans || []) {
  if (scan.rows.length !== Number(scan.count)) throw new Error(`Incomplete product-manager result: ${scan.carLabel}`);
  for (const row of scan.rows) {
    if (!row.code || !row.url?.startsWith('https://seatcover.jp/c/')) continue;
    if (!adminByCode.has(row.code)) adminByCode.set(row.code, []);
    adminByCode.get(row.code).push({
      ...row, maker: galleryMakerForAdmin[scan.makerLabel] || scan.makerLabel,
      car: galleryCarForAdmin[scan.carLabel] || scan.carLabel,
    });
  }
}
function shopListingFor(item, url) {
  const code = url.split('/').filter(Boolean).at(-1);
  const rows = (adminByCode.get(code) || []).filter(row =>
    row.maker === item.maker && row.car === item.car &&
    normalized(row.design).includes(normalized(item.brand)) &&
    normalized(row.design).includes(normalized(item.series)));
  if (rows.length !== 1) return null;
  return {status: rows[0].status, url: rows[0].url, checkedAt: internal.checkedAt};
}
const reading = {Refinad: 'レフィナード', Sandii: 'サンディ', Dotty: 'ダティ', IXUS: 'イクサス'};
const ambiguous = [
  ['ジムニー', 'ジムニーノマド'], ['ジムニー', 'ジムニーシエラ'],
  ['N-BOX', 'N-BOXカスタム'], ['デイズ', 'デイズルークス'],
  ['ハイラックス', 'ハイラックスサーフ'],
  ['ハイエース', 'ハイエースワゴン'],
  ['カローラクロス', 'カローラクロスハイブリッド'],
  ['ヴェゼル', 'ヴェゼルハイブリッド'],
  ['エブリィ', 'エブリィワゴン'],
  ['アトレー', 'アトレーワゴン'],
  ['MINI', 'MINI CROSSOVER'],
];
function carInTitle(car, title) {
  const c = normalized(car), t = normalized(title);
  if (!c || !t.includes(c)) return false;
  return !ambiguous.some(([base, other]) => normalized(car) === normalized(base) && t.includes(normalized(other)));
}
function matchPhotoCode(caseDetail, source, product) {
  const codes = new Set((caseDetail.photoInfo || []).map(row => row?.['品番']).filter(Boolean));
  if (!codes.size) return false;
  return source.records.some(record => product.recordIds.includes(record.id) && codes.has(record.code));
}

const entries = [];
for (const item of catalog.cases) {
  const detail = await read(path.join(root, 'public/data/details', `${item.id}.json`));
  const prior = previousLedger.get(item.id);
  const url = prior?.originalUrl || detail.productUrl;
  if (!url) continue;
  const response = http.get(url) || null;
  const vehicleUrl = catalog.vehicleProductLinks[`${item.maker}|${item.car}`];
  const source = vehicleCatalogs.get(vehicleUrl);
  const product = source?.products.find(row => row.href === url && row.brand === item.brand && row.recordIds?.length);
  const series = findSeries(item.brand, item.series);
  const seriesMatches = !!series?.productUrl && url.startsWith(`${series.productUrl}/`) && url !== `${series.productUrl}/`;
  const title = response?.title || '';
  const pageMatches = response?.status === 200 && response.final_url === url && carInTitle(item.car, title) &&
    (normalized(title).includes(normalized(item.brand)) || normalized(title).includes(normalized(reading[item.brand])));
  const catalogMatches = !!product && !!source;
  const publicVerified = item.carKnown !== false && seriesMatches && (catalogMatches || pageMatches);
  const shopListing = shopListingFor(item, url) ||
    (prior?.originalUrl === url && prior?.maker === item.maker && prior?.car === item.car &&
      prior?.brand === item.brand && prior?.series === item.series ? prior.shopListing : null);
  const adminPublished = shopListing?.status === '公開中';
  const adminUnlisted = shopListing?.status === '未掲載' || shopListing?.status === '非公開';
  const verified = item.carKnown !== false && (adminPublished || (!adminUnlisted && publicVerified));
  const approvedUrl = verified ? (adminPublished ? shopListing.url : url) : null;
  if (approvedUrl && (!approvedUrl.startsWith('https://seatcover.jp/c/') ||
      approvedUrl.split('/').filter(Boolean).at(-1) !== url.split('/').filter(Boolean).at(-1))) {
    throw new Error(`Product code changed in approved URL: ${item.id}`);
  }
  const reasons = [];
  if (adminPublished) reasons.push('shop_product_manager_published');
  if (adminUnlisted) reasons.push('shop_product_manager_unlisted');
  if (catalogMatches) reasons.push('official_vehicle_product_catalog');
  if (pageMatches) reasons.push('http_200_car_brand_title');
  if (seriesMatches) reasons.push('official_series_category');
  if (!verified) reasons.push(response?.status === 429 ? 'http_429_unresolved' : 'identity_unresolved');
  const entry = {
    caseId: item.id, originalUrl: url, status: verified ? 'verified_product_page' : 'unverified',
    approvedUrl,
    maker: item.maker, car: item.car, brand: item.brand, series: item.series,
    evidence: reasons, httpStatus: response?.status || null,
    productTitle: title || null,
    catalogFetchedAt: catalogMatches ? source.fetchedAt : null,
    photoCodeInProductFitTable: catalogMatches ? matchPhotoCode(detail, source, product) : false,
    shopListing,
    salesState: adminPublished ? '本店公開中（確認日時点）' : adminUnlisted ? '本店未掲載（確認日時点）' : '未確認',
    fitmentScope: '年式・型式・グレード未確認',
  };
  entries.push(entry);
}
entries.sort((a, b) => a.caseId.localeCompare(b.caseId));
const summary = Object.groupBy(entries, row => row.status);
const output = {
  checkedAt: '2026-09-25',
  method: 'Official shop HTTP result/title, official series category, public product/fit-table catalog, and read-only product-manager listing where available. No requests during reconciliation.',
  caveat: '商品ページの存在と車種・ブランド・シリーズの対応を確認する。販売状態・在庫・注文仕様・個々の車両の適合は保証しない。HTTP 429 はリンク切れを意味しない。',
  counts: Object.fromEntries(Object.entries(summary).map(([key, rows]) => [key, rows.length])),
  photoCodeMatches: entries.filter(row => row.photoCodeInProductFitTable).length,
  entries,
};
await writeFile(ledgerPath, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({counts: output.counts, photoCodeMatches: output.photoCodeMatches, cachedVehicles: vehicleCatalogs.size}));
