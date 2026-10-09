import {cp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {loadGalleryBase} from './gallery-base.mjs';
import {photoReplacement,detailReplacement} from '../public/photo-replacements.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const output = path.join(dist, 'client');
const localOnly = new Set(['compare.html', 'compare.css', 'compare.js', '_audit-contact-sheet.html']);
const hosting = JSON.parse(await readFile(path.join(root, '.openai/hosting.json'), 'utf8'));
if (!hosting.project_id || hosting.static || hosting.d1 !== 'DB' || hosting.r2 !== 'BUCKET') {
  throw new Error('Expected Sites Worker hosting with D1 DB and R2 BUCKET');
}
// The only removable output is this project's fixed dist directory.
if (path.dirname(dist) !== root || path.basename(dist) !== 'dist') throw new Error('Invalid build output');
await rm(dist, {recursive: true, force: true});
await mkdir(path.join(dist, '.openai'), {recursive: true});
await cp(path.join(root, 'public'), output, {
  recursive: true,
  filter: source => !localOnly.has(path.relative(path.join(root, 'public'), source)),
});
const indexPath = path.join(output, 'index.html');
let html = await readFile(indexPath, 'utf8');
if (!html.includes('class="store-home" href="https://seatcover.jp/"') || !html.includes('/compare.html')) {
  throw new Error('Local preview links changed; review the hosted link mapping');
}
html = html.replace('<a href="/compare.html">制作プレビュー・旧版との比較</a>', '<a href="/preview.html">SP・PCの表示を比較</a>');
await writeFile(indexPath, html);
await writeFile(path.join(dist, '.openai/hosting.json'), JSON.stringify(hosting, null, 2) + '\n');
await cp(path.join(root,'drizzle'),path.join(dist,'drizzle'),{recursive:true});
const base=await loadGalleryBase(output);
await mkdir(path.join(root,'.preview'),{recursive:true});
await writeFile(path.join(root,'.preview/worker-base.json'),JSON.stringify(base));
await build({stdin:{contents:"import {createGallery} from './worker/gallery.mjs'; import base from './.preview/worker-base.json'; export default createGallery(base);",resolveDir:root,sourcefile:'gallery-worker.mjs'},bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:path.join(dist,'server/index.js'),minify:true});

async function files(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat();
}
const published = await files(output);
for (const file of published.filter(file => /\.(?:html|js|css)$/.test(file))) {
  const text = await readFile(file, 'utf8');
  if (/https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/)/.test(text) || text.includes('/reference/')) {
    throw new Error(`Local-only reference in ${path.relative(output, file)}`);
  }
}
const catalog = JSON.parse(await readFile(path.join(output, 'data/catalog.json'), 'utf8'));
const cases = catalog.items ?? catalog.cases ?? catalog;
const audit = JSON.parse(await readFile(path.join(root, 'audit/data-extraction.json'), 'utf8'));
const excluded = audit.excluded.reduce((total, item) => total + item.count, 0);
const accounted = cases.length + audit.deduplicated + audit.curatedMergedRecords + excluded;
const recoveries=JSON.parse(await readFile(path.join(root,'audit/source-recoveries-2026-10-05.json'),'utf8'));
const readyRecoveries=recoveries.entries.filter(entry=>entry.status==='ready');
if (readyRecoveries.length !== (audit.sourceRecoveredRecords || 0) || readyRecoveries.some(entry=>!cases.some(item=>item.id===entry.case.id))) throw new Error('Recovered cases do not match their source audit');
if (!Array.isArray(cases) || cases.length !== audit.caseCount || accounted !== audit.rawRecords + audit.importedRecords + (audit.sourceRecoveredRecords || 0)) {
  throw new Error('Published cases do not match the extraction audit');
}
await Promise.all(cases.map(item => readFile(path.join(output, `data/details/${item.id}.json`))));
const fitment = JSON.parse(await readFile(path.join(output, 'data/fitment.json'), 'utf8'));
const safeCaseFields = new Set(['brand', 'car', 'code', 'rows']);
const safeRowFields = new Set(['car', 'year', 'yearStart', 'yearEnd', 'model', 'grade', 'seats']);
const safeMasterFields = new Set([...safeRowFields,'group','code']);
if (!Array.isArray(fitment.records) || fitment.records.length < 100) throw new Error('Full public fitment master is missing');
for (const row of fitment.records) {
  if (Object.keys(row).some(key => !safeMasterFields.has(key)) || !row.group || !row.car || !row.code) throw new Error('Unsafe public master record');
}
const caseIds = new Set(cases.map(item => item.id));
if (fitment.version !== 1 || Object.keys(fitment.cases || {}).length < 100) throw new Error('Fitment snapshot is missing or incomplete');
for (const [id, match] of Object.entries(fitment.cases)) {
  if (!caseIds.has(id) || Object.keys(match).some(key => !safeCaseFields.has(key)) || !Array.isArray(match.rows) || !match.rows.length) throw new Error(`Unsafe fitment case: ${id}`);
  for (const row of match.rows) if (Object.keys(row).some(key => !safeRowFields.has(key))) throw new Error(`Unsafe fitment field: ${id}`);
}
// Direct JSON downloads must use the same corrected photos as the dynamic API.
const deliveredCatalog={...base.catalog,cases:base.catalog.cases.map(item=>photoReplacement(item,base.replacements))};
await writeFile(path.join(output,'data/catalog.json'),JSON.stringify(deliveredCatalog)+'\n');
await Promise.all(base.catalog.cases.map(item=>writeFile(path.join(output,`data/details/${item.id}.json`),JSON.stringify(detailReplacement(item.id,base.details[item.id],base.replacements))+'\n')));
// These source-only lookup tables contain the pre-replacement references.
await rm(path.join(output,'data/photo-replacements.json'),{force:true});
await rm(path.join(output,'data/mail-publications.json'),{force:true});
console.log(`Sites Worker build ready: ${published.length} client files, ${deliveredCatalog.cases.length} complete cases; D1 + R2.`);
