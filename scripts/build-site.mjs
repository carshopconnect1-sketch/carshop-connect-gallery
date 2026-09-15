import {cp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const output = path.join(dist, 'public');
const localOnly = new Set(['compare.html', 'compare.css', 'compare.js']);
const topUrl = 'https://carshop-connect-internal-preview.connect369.chatgpt.site/';
const hosting = JSON.parse(await readFile(path.join(root, '.openai/hosting.json'), 'utf8'));
if (!hosting.project_id || hosting.static?.directory !== 'public') {
  throw new Error('Expected a Sites project with static.directory = public');
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
if (!html.includes('http://127.0.0.1:4173/') || !html.includes('/compare.html')) {
  throw new Error('Local preview links changed; review the hosted link mapping');
}
html = html.replace('http://127.0.0.1:4173/', topUrl)
  .replace('<a href="/compare.html">制作プレビュー・旧版との比較</a>', '<a href="/preview.html">SP・PCの表示を比較</a>');
await writeFile(indexPath, html);
await writeFile(path.join(dist, '.openai/hosting.json'), JSON.stringify(hosting, null, 2) + '\n');

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
if (!Array.isArray(cases) || cases.length !== 2897) throw new Error('Expected 2,897 published cases');
await Promise.all(cases.map(item => readFile(path.join(output, `data/details/${item.id}.json`))));
console.log(`Sites static build ready: ${published.length} files, ${cases.length} complete cases.`);
