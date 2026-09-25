import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeFitmentSnapshot, readCsv} from './fitment-sync-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2];
if (!source) throw new Error('使用方法: npm run sync:fitment -- <適合マスターの全件CSVのパス>');
const rows = await readCsv(source);
// A partial/admin-filtered export must never replace the current complete snapshot.
if (rows.length < 8001) throw new Error(`全件CSVではない可能性があります: ${rows.length - 1}行`);
const publicRoot = path.join(root, 'public');
const catalog = JSON.parse(await readFile(path.join(publicRoot, 'data/catalog.json'), 'utf8'));
const details = {};
await Promise.all(catalog.cases.map(async item => {
  details[item.id] = JSON.parse(await readFile(path.join(publicRoot, `data/details/${item.id}.json`), 'utf8'));
}));
const {snapshot, audit} = makeFitmentSnapshot(rows, catalog, details);
if (audit.linkedCases < 100) throw new Error(`照合件数が少なすぎます: ${audit.linkedCases}件。CSVの列・品番・車種表記を確認してください。`);
await writeFile(path.join(publicRoot, 'data/fitment.json'), JSON.stringify(snapshot));
await mkdir(path.join(root, '.source'), {recursive: true});
await writeFile(path.join(root, '.source/fitment-sync-audit.json'), JSON.stringify({...audit, syncedAt: snapshot.syncedAt}, null, 2));
console.log(JSON.stringify({...audit, unresolved: undefined, syncedAt: snapshot.syncedAt}, null, 2));
