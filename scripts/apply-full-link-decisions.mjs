// Apply the read-only, per-case audit only after every candidate product page
// has been inspected. The browser captures and source CSV stay in .source/.
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async name => JSON.parse(await readFile(path.join(root, name), 'utf8'));
const save = async (name, value, trailingNewline = true) =>
  writeFile(path.join(root, name), JSON.stringify(value) + (trailingNewline ? '\n' : ''));
const catalog = await read('public/data/catalog.json');
const ledger = await read('audit/direct-product-links-2026-09-25.json');
const audit = await read('.source/full-link-decisions-2026-10-01.json');
const pageAudit = await read('.source/product-page-options-2026-10-01.json');
const items = new Map(catalog.cases.map(item => [item.id, item]));
const decisions = new Map(audit.decisions.map(row => [row.id, row]));
const pages = new Map(pageAudit.pages.map(row => [row.url, row]));
if (items.size !== 2895 || ledger.entries.length !== 2632 || decisions.size !== ledger.entries.length) {
  throw new Error('Catalog, link ledger, or decision count changed; refusing to apply stale evidence.');
}

const changedDetails = new Map();
const actionCounts = {kept: 0, removed: 0, added: 0};
for (const row of ledger.entries) {
  const item = items.get(row.caseId);
  const decision = decisions.get(row.caseId);
  if (!item || !decision || [row.maker, row.car, row.brand, row.series].some((value, index) =>
      value !== [item.maker, item.car, item.brand, item.series][index] ||
      value !== [decision.maker, decision.car, decision.brand, decision.series][index])) {
    throw new Error(`Catalog/decision identity changed: ${row.caseId}`);
  }
  if (row.status !== decision.prior) throw new Error(`Prior link state changed: ${row.caseId}`);
  const filename = `public/data/details/${row.caseId}.json`;
  const detail = await read(filename);
  const photoCodes = [...new Set((detail.photoInfo || []).map(info =>
    String(info?.['品番'] || '').normalize('NFKC').trim().toUpperCase()).filter(Boolean))];
  if (JSON.stringify(photoCodes) !== JSON.stringify(decision.photoCodes)) {
    throw new Error(`Photo codes changed after verification: ${row.caseId}`);
  }
  const approved = decision.status === 'photo_code_selectable' && decision.carKnown;
  if (approved) {
    const page = pages.get(decision.url);
    const sku = decision.url?.split('/').filter(Boolean).at(-1);
    const options = new Set((page?.options || []).map(value =>
      String(value).normalize('NFKC').trim().toUpperCase()));
    if (!page?.cart || page.productCode !== sku || !photoCodes.length ||
        !photoCodes.every(code => options.has(code))) {
      throw new Error(`Product page evidence does not support the photo code: ${row.caseId}`);
    }
    detail.productUrl = decision.url;
    detail.productLinkStatus = 'verified_product_page';
    delete detail.productLinkReason;
    row.status = 'verified_product_page';
    row.approvedUrl = decision.url;
    row.evidence = [...new Set([...(row.evidence || []),
      'live_product_page_photo_code_selectable_2026-10-01', decision.verification])];
    row.salesState = '公開商品ページの品番選択肢を確認（2026-10-01）';
    if (decision.prior === 'verified_product_page') actionCounts.kept++;
    else actionCounts.added++;
  } else {
    detail.productUrl = '';
    detail.productLinkStatus = 'unverified';
    if (['photo_code_not_selectable', 'photo_code_absent', 'identity_unresolved'].includes(decision.status)) {
      detail.productLinkReason = decision.status;
    } else delete detail.productLinkReason;
    row.status = 'unverified';
    row.approvedUrl = null;
    row.evidence = [...new Set([...(row.evidence || []), `${decision.status}_2026-10-01`])];
    row.salesState = '写真品番と商品ページの対応は未確認';
    if (decision.prior === 'verified_product_page') actionCounts.removed++;
  }
  changedDetails.set(filename, detail);
}
if (JSON.stringify(actionCounts) !== JSON.stringify({kept: 1469, removed: 235, added: 611})) {
  throw new Error(`Unexpected remediation counts: ${JSON.stringify(actionCounts)}`);
}

// The archived Move gallery contains one Move Canvas installation. Its source
// model, D0488-01 fitment row, and live selectable product code all agree.
const moveId = '8be9c8b0594c';
const move = items.get(moveId);
const moveDetailName = `public/data/details/${moveId}.json`;
const moveDetail = changedDetails.get(moveDetailName);
const moveLedger = ledger.entries.find(row => row.caseId === moveId);
if (move?.car !== 'ムーヴ' || moveDetail?.photoInfo?.[0]?.['品番'] !== 'D0488-01' ||
    moveLedger?.approvedUrl !== 'https://seatcover.jp/c/seatcovermaker/sandii/sandii-waffle/sandii-wf00488') {
  throw new Error('Move Canvas correction no longer matches its source evidence.');
}
move.car = 'ムーヴキャンバス';
moveLedger.car = 'ムーヴキャンバス';
moveDetail.alt = moveDetail.alt.replace(/^ムーヴ /, 'ムーヴキャンバス ');

ledger.checkedAt = '2026-10-01';
ledger.method = 'All 2,632 archived product candidates reconciled with current product-manager listings and 994 live product-page URLs; direct CTA requires the photo code in that page’s selectable product options.';
ledger.caveat = '写真品番を注文画面で選べることを確認した。年式・型式・グレード別の個別適合、選択色の在庫、注文の成立は保証しない。';
ledger.counts = {verified_product_page: actionCounts.kept + actionCounts.added,
  unverified: ledger.entries.length - actionCounts.kept - actionCounts.added};
delete ledger.photoCodeMatches;
ledger.livePhotoCodeMatches = ledger.counts.verified_product_page;

await save('public/data/catalog.json', catalog);
for (const [filename, detail] of changedDetails) await save(filename, detail, false);
await writeFile(path.join(root, 'audit/direct-product-links-2026-09-25.json'),
  JSON.stringify(ledger, null, 2) + '\n');
console.log(JSON.stringify({...actionCounts, counts: ledger.counts, correctedVehicleCase: moveId}));
