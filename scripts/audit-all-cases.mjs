// Audit every published gallery record against its detail, approved product
// link ledger, and a freshly exported (read-only) fitment master CSV.
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeFitmentSnapshot, readCsv} from './fitment-sync-core.mjs';
import {productLink} from '../public/product-link.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = process.argv[2];
if (!csvPath) throw new Error('Usage: node scripts/audit-all-cases.mjs <full-fitment-export.csv>');
const auditDate = new Date().toISOString().slice(0, 10);
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const catalog = await readJson('public/data/catalog.json');
const publishedFitment = await readJson('public/data/fitment.json');
const ledger = await readJson('audit/direct-product-links-2026-09-25.json');
const csvBytes = await readFile(csvPath);
const csvHash = createHash('sha256').update(csvBytes).digest('hex');
const csvRows = await readCsv(csvPath);
if (csvRows.length < 8001) throw new Error(`Expected a full fitment export; got ${csvRows.length - 1} rows`);

const details = {};
const unreadableDetails = [];
await Promise.all(catalog.cases.map(async item => {
  try { details[item.id] = await readJson(`public/data/details/${item.id}.json`); }
  catch (error) { unreadableDetails.push({id: item.id, error: error.message}); }
}));
if (unreadableDetails.length) throw new Error(`Missing or invalid details: ${JSON.stringify(unreadableDetails.slice(0, 10))}`);

const {snapshot: freshFitment, audit: fitmentAudit} = makeFitmentSnapshot(csvRows, catalog, details, auditDate);
const unresolvedFitment = new Map(fitmentAudit.unresolved.map(row => [row.caseId, row.reason]));
const linkLedger = new Map(ledger.entries.map(row => [row.caseId, row]));
const duplicateIds = new Set();
const seenIds = new Set();
for (const item of catalog.cases) {
  if (seenIds.has(item.id)) duplicateIds.add(item.id);
  seenIds.add(item.id);
}
const orphanLinkRows = ledger.entries.filter(row => !seenIds.has(row.caseId)).map(row => row.caseId);
const orphanFitmentRows = Object.keys(publishedFitment.cases).filter(id => !seenIds.has(id));
const allowedFitmentFields = new Set(['brand', 'car', 'code', 'rows']);
const allowedFitmentRowFields = new Set(['year', 'yearStart', 'yearEnd', 'model', 'grade', 'seats']);
const forbiddenFitmentFields = [];
for (const [id, record] of Object.entries(publishedFitment.cases)) {
  for (const key of Object.keys(record)) if (!allowedFitmentFields.has(key)) forbiddenFitmentFields.push(`${id}.${key}`);
  for (const row of record.rows || []) {
    for (const key of Object.keys(row)) if (!allowedFitmentRowFields.has(key)) forbiddenFitmentFields.push(`${id}.rows.${key}`);
  }
}

const rows = [];
const countBy = (field, value) => rows.filter(row => row[field] === value).length;
for (const item of catalog.cases) {
  const detail = details[item.id];
  const ledgerRow = linkLedger.get(item.id);
  const issues = [];
  const images = detail.images;
  if (!Array.isArray(images) || !images.length) issues.push('missing_images');
  if (item.photoCount !== images?.length) issues.push('photo_count_mismatch');
  if (Array.isArray(images) && images.some(url => !/^https:\/\//.test(url))) issues.push('invalid_image_url');
  if (!item.maker || !item.car || !item.brand || !item.series) issues.push('missing_case_identity');
  if (item.carKnown === false || item.car === '車種名未掲載') issues.push('unknown_vehicle');

  const codes = [...new Set((detail.photoInfo || []).map(info => String(info?.['品番'] || '').trim().toUpperCase()).filter(Boolean))];
  if (codes.length > 1) issues.push('multiple_photo_codes');
  const now = freshFitment.cases[item.id];
  const published = publishedFitment.cases[item.id];
  if (published && (!now || JSON.stringify(published) !== JSON.stringify(now))) issues.push('published_fitment_differs_from_latest');
  if (!published && now) issues.push('latest_fitment_not_published');

  if (ledgerRow) {
    if ([item.maker, item.car, item.brand, item.series].some((value, i) => value !==
      [ledgerRow.maker, ledgerRow.car, ledgerRow.brand, ledgerRow.series][i])) issues.push('link_ledger_identity_mismatch');
    if (ledgerRow.status === 'verified_product_page') {
      if (!ledgerRow.approvedUrl?.startsWith('https://seatcover.jp/c/')) issues.push('approved_url_invalid');
      if (detail.productUrl !== ledgerRow.approvedUrl) issues.push('approved_url_not_in_detail');
      if (detail.productLinkStatus !== 'verified_product_page') issues.push('approved_link_status_mismatch');
      if (!ledgerRow.evidence?.some(value=>/^live_product_page_photo_code_selectable_2026-10-0[12]$/.test(value)))
        issues.push('missing_live_photo_code_evidence');
    } else if (detail.productUrl) issues.push('unverified_direct_link_exposed');
  } else if (detail.productUrl) issues.push('direct_link_missing_from_ledger');
  const destination = productLink(item, detail.productUrl, catalog.vehicleProductLinks,
    detail.productLinkReason);
  if (!destination.url?.startsWith('https://seatcover.jp/')) issues.push('invalid_product_destination');
  rows.push({
    id: item.id, maker: item.maker, car: item.car, brand: item.brand, series: item.series,
    category: item.category, photoCount: item.photoCount, photoCodes: codes.join(' / '),
    publishedFitment: published ? 'matched' : 'none',
    latestFitment: now ? 'matched' : item.category !== 'seatcover' ? 'not_applicable' :
      unresolvedFitment.get(item.id) || (!codes.length ? 'no_code' : 'unresolved'),
    productStatus: ledgerRow?.status || 'no_direct_candidate',
    destination: destination.url, issues: issues.join('|'),
  });
}

const fitmentChanges = {
  added: rows.filter(row => row.issues.includes('latest_fitment_not_published')).map(row => row.id),
  removedOrChanged: rows.filter(row => row.issues.includes('published_fitment_differs_from_latest')).map(row => row.id),
};
const fitmentChangeDetails = fitmentChanges.removedOrChanged.map(id => {
  const item = catalog.cases.find(row => row.id === id);
  const before = publishedFitment.cases[id];
  const after = freshFitment.cases[id];
  const fields = ['year', 'yearStart', 'yearEnd', 'model', 'grade', 'seats'];
  return {
    id, maker: item.maker, car: item.car, brand: item.brand, series: item.series,
    code: before.code, oldRowCount: before.rows.length, newRowCount: after?.rows.length || 0,
    changedFields: fields.filter(field => JSON.stringify(before.rows.map(row => row[field])) !==
      JSON.stringify((after?.rows || []).map(row => row[field]))),
  };
});
const issueCounts = {};
for (const row of rows) for (const issue of row.issues.split('|').filter(Boolean)) issueCounts[issue] = (issueCounts[issue] || 0) + 1;
const summary = {
  auditedAt: auditDate, sourceCsvSha256: csvHash, sourceRows: csvRows.length - 1,
  sourceCatalogDate: catalog.sourceDate, catalogCases: catalog.cases.length,
  galleryImages: rows.reduce((sum, row) => sum + row.photoCount, 0),
  verifiedProductPages: countBy('productStatus', 'verified_product_page'),
  unverifiedDirectCandidates: countBy('productStatus', 'unverified'),
  noDirectCandidates: countBy('productStatus', 'no_direct_candidate'),
  publishedFitmentCases: countBy('publishedFitment', 'matched'),
  latestFitmentCases: countBy('latestFitment', 'matched'),
  latestFitmentAudit: {...fitmentAudit, unresolved: undefined},
  fitmentChanges, fitmentChangeDetails, duplicateIds: [...duplicateIds], orphanLinkRows,
  orphanFitmentRows, forbiddenFitmentFields, issueCounts,
};
const outputDir = path.join(root, 'audit');
await mkdir(outputDir, {recursive: true});
const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const columns = Object.keys(rows[0]);
const table = [columns.join(','), ...rows.map(row => columns.map(key => escape(row[key])).join(','))].join('\r\n') + '\r\n';
await writeFile(path.join(outputDir, `full-case-verification-${auditDate}.csv`), '\uFEFF' + table, 'utf8');
await writeFile(path.join(outputDir, `full-case-verification-${auditDate}.json`), JSON.stringify(summary, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(summary, null, 2));
const nonEditorialIssues = Object.keys(issueCounts).filter(issue => issue !== 'unknown_vehicle');
if (nonEditorialIssues.length || duplicateIds.size || orphanLinkRows.length || orphanFitmentRows.length ||
    forbiddenFitmentFields.length) process.exitCode = 1;
