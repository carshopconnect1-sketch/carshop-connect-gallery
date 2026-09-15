"""Read only the uploaded archive's static gallery data. Never execute its scripts."""
from pathlib import Path
import argparse, hashlib, json, re, zipfile

ROOT = Path(__file__).resolve().parents[1]

def read_records(html):
    line = next(line for line in html.splitlines() if line.startswith('const D='))
    literal = line[len('const D='):].rstrip(';')
    # Quote bare object keys, preserving complete quoted strings and JSON primitives.
    token = re.compile(r'"(?:[^"\\]|\\.)*"|\b[A-Za-z_$][\w$]*\b')
    literal = token.sub(lambda m: m[0] if m[0].startswith('"') or m[0] in ('true','false','null') else json.dumps(m[0]), literal)
    records = json.loads(literal)
    if not isinstance(records, list): raise ValueError('Expected a literal data array')
    for row in records:
        if not isinstance(row, dict) or not all(isinstance(row.get(k), str) for k in ('c','b','m','s','u','t')):
            raise ValueError('Invalid gallery row')
        if not isinstance(row.get('imgs'), list) or not all(isinstance(x,str) for x in row['imgs']):
            raise ValueError('Invalid image list')
    return records

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('archive', type=Path); args=parser.parse_args()
    out=ROOT/'.source/old-upload'; out.mkdir(parents=True,exist_ok=True)
    entries=[]
    with zipfile.ZipFile(args.archive) as archive:
        for name in ('old/index.html','old/v2/index.html'):
            raw=archive.read(name)
            records=read_records(raw.decode('utf-8-sig'))
            target=out/name.removeprefix('old/'); target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(raw)
            target.with_suffix('.data.json').write_text(json.dumps(records,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
            entries.append({'entry':name,'sha256':hashlib.sha256(raw).hexdigest(),'records':len(records)})
    report={'source':'old.zip','receivedDate':'2026-09-14','entries':entries,'note':'No dedicated color field or color filter in either supplied gallery.'}
    (ROOT/'audit/old-upload.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))
