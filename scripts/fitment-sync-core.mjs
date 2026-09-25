import {readFile} from 'node:fs/promises';

const columnAliases = {
  brand: ['maker_id', 'seatmaker', 'brand', 'maker', 'ブランド', 'シートカバーメーカー'],
  car: ['car', 'car_name', 'carlist', '車種', '車名'],
  code: ['code', 'product_code', '品番'],
  display: ['display', 'is_display', 'visible', '表示', '公開'],
  year: ['year', 'modelyear', '年式', '年式（表示用テキスト）'],
  yearStart: ['modelyear1', 'year_start', 'from_date', '年式開始', '年式 開始'],
  yearEnd: ['modelyear2', 'year_end', 'to_date', '年式終了', '年式 終了'],
  model: ['type', 'model', 'model_type', '型式'],
  grade: ['grade', 'グレード'],
  seats: ['people', 'seats', 'capacity', '定員', '乗車定員'],
  updatedAt: ['updated_at', 'update_date', '更新日', '最終更新日'],
};

const headerKey = value => String(value).normalize('NFKC').toLowerCase().replace(/[\s_\-／/（）().:：]/g, '');
const codeKey = value => String(value || '').normalize('NFKC').trim().toUpperCase();
const carKey = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s　]/g, '');
const text = (value, limit = 1500) => String(value ?? '').trim().slice(0, limit);
const publicText = value => text(value).replace(/<br\s*\/?\s*>/gi, '\n')
  .replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n')
  .replace(/\n{3,}/g, '\n\n').trim();

export function parseCsv(input) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const source = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error('CSVの引用符が閉じられていません。');
  row.push(field);
  if (row.some(value => value !== '')) rows.push(row);
  return rows;
}

export async function readCsv(path) {
  const bytes = await readFile(path);
  let decoded;
  try { decoded = new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
  catch { decoded = new TextDecoder('shift_jis', {fatal: true}).decode(bytes); }
  return parseCsv(decoded);
}

function columns(header) {
  const keys = header.map(headerKey);
  const indices = {};
  for (const [name, aliases] of Object.entries(columnAliases)) {
    indices[name] = keys.findIndex(key => aliases.some(alias => headerKey(alias) === key));
  }
  for (const name of ['brand', 'car', 'code', 'display']) {
    if (indices[name] < 0) throw new Error(`適合CSVに必要な列「${name}」がありません。列名: ${header.join(', ')}`);
  }
  return indices;
}

function brandGroup(value) {
  const key = headerKey(value);
  if (['1', 'refinadsandii', 'refinad', 'sandii'].includes(key)) return 'Refinad/Sandii';
  if (['3', 'dotty'].includes(key)) return 'Dotty';
  if (['4', 'ixus'].includes(key)) return 'IXUS';
  return '';
}

function shown(value) {
  return ['1', 'on', 'yes', 'true', '○', '◯', '公開', '表示', '表示on'].includes(headerKey(value));
}

function yearValue(value) {
  const v = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
}

function publicRow(row, index) {
  const get = name => index[name] < 0 ? '' : row[index[name]];
  return {
    group: brandGroup(get('brand')),
    car: text(get('car'), 150),
    code: codeKey(get('code')),
    shown: shown(get('display')),
    year: text(get('year'), 150),
    yearStart: yearValue(get('yearStart')),
    yearEnd: yearValue(get('yearEnd')),
    model: publicText(get('model')),
    grade: publicText(get('grade')),
    seats: /^\d{1,2}$/.test(text(get('seats'))) ? text(get('seats')) : '',
  };
}

function caseGroup(brand) {
  return ['Refinad', 'Sandii'].includes(brand) ? 'Refinad/Sandii' : brand;
}

export function makeFitmentSnapshot(csvRows, catalog, details, syncedAt = new Date().toISOString()) {
  if (!csvRows.length) throw new Error('適合CSVが空です。');
  const width=csvRows[0].length;
  if(csvRows.some(row=>row.length!==width))throw new Error('適合CSVに列数が異なる行があります。更新を中止しました。');
  const index = columns(csvRows[0]);
  const byCode = new Map();
  let publishedRows = 0;
  for (const values of csvRows.slice(1)) {
    const row = publicRow(values, index);
    if (!row.shown || !row.group || !row.car || !row.code) continue;
    publishedRows++;
    const key = `${row.group}|${row.code}`;
    if (!byCode.has(key)) byCode.set(key, []);
    byCode.get(key).push(row);
  }
  if (!publishedRows) throw new Error('公開中の適合レコードを読み取れませんでした。表示列の値を確認してください。');
  const cases = {};
  const audit = {sourceRows: csvRows.length - 1, publishedRows, photoCases: 0, linkedCases: 0,
    noCode: 0, noCodeMatch: 0, carMismatch: 0, conflictingCodes: 0, unresolved: []};
  for (const item of catalog.cases) {
    if (item.category !== 'seatcover') continue;
    const detail = details[item.id];
    if (!detail) throw new Error(`装着事例の詳細がありません: ${item.id}`);
    const codes = [...new Set((detail.photoInfo || []).map(info => codeKey(info?.['品番'])).filter(Boolean))];
    if (!codes.length) { audit.noCode++; continue; }
    audit.photoCases++;
    if (codes.length !== 1) { audit.conflictingCodes++; audit.unresolved.push({caseId: item.id, reason: 'conflicting_codes'}); continue; }
    const code = codes[0];
    const candidates = byCode.get(`${caseGroup(item.brand)}|${code}`) || [];
    if (!candidates.length) { audit.noCodeMatch++; audit.unresolved.push({caseId: item.id, reason: 'no_code_match'}); continue; }
    const matched = candidates.filter(row => carKey(row.car) === carKey(item.car));
    if (!matched.length) { audit.carMismatch++; audit.unresolved.push({caseId: item.id, reason: 'car_mismatch'}); continue; }
    const unique = new Map();
    for (const {group, car, code: ignoredCode, shown: visible, ...publicFields} of matched) {
      const key = JSON.stringify(publicFields);
      unique.set(key, publicFields);
    }
    cases[item.id] = {brand: item.brand, car: item.car, code, rows: [...unique.values()]};
    audit.linkedCases++;
  }
  const snapshot = {version: 1, source: 'cc_match', syncedAt, cases};
  return {snapshot, audit};
}
