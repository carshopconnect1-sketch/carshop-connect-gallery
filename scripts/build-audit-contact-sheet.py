"""Build a local-only contact sheet for visually reviewing gallery cases."""
from html import escape
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]


def main(case_ids):
    catalog = json.loads((ROOT / 'public/data/catalog.json').read_text(encoding='utf-8'))
    cases = {case['id']: case for case in catalog.get('cases', catalog)}
    requested = case_ids or list(cases)
    missing = [case_id for case_id in requested if case_id not in cases]
    if missing:
        raise SystemExit(f"Unknown case ids: {', '.join(missing)}")

    sections = []
    for case_id in requested:
        case = cases[case_id]
        detail = json.loads((ROOT / f'public/data/details/{case_id}.json').read_text(encoding='utf-8'))
        cards = []
        for index, image in enumerate(detail['images'], 1):
            cards.append(
                '<figure>'
                f'<img src="{escape(image, quote=True)}" alt="">'
                f'<figcaption>{index}/{len(detail["images"])}</figcaption>'
                '</figure>'
            )
        sections.append(
            '<section>'
            f'<h2>{escape(case["maker"])} / {escape(case["car"])} / '
            f'{escape(case["brand"])} {escape(case["series"])} '
            f'<small>{case_id} · {len(detail["images"])} images</small></h2>'
            f'<div class="grid">{"".join(cards)}</div>'
            '</section>'
        )

    document = f'''<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow">
<title>Gallery audit contact sheet</title>
<style>
*{{box-sizing:border-box}}body{{margin:0;background:#191919;color:#fff;font-family:Arial,sans-serif}}
header{{position:sticky;top:0;z-index:2;padding:14px 24px;background:#111;border-bottom:1px solid #555}}
header h1{{margin:0;font-size:20px}}section{{padding:24px;border-bottom:4px solid #000}}
h2{{margin:0 0 18px;font-size:20px}}small{{color:#bbb;font-size:13px;font-weight:400}}
.grid{{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:10px}}
figure{{margin:0;background:#2a2a2a;border:1px solid #555;border-radius:8px;overflow:hidden}}
img{{display:block;width:100%;height:170px;object-fit:contain;background:#ddd}}
figcaption{{padding:7px 10px;color:#ddd;font-size:12px}}
@media(max-width:900px){{.grid{{grid-template-columns:repeat(3,minmax(0,1fr))}}img{{height:220px}}}}
</style></head><body><header><h1>Gallery audit contact sheet · {len(requested)} cases</h1></header>
{''.join(sections)}</body></html>'''
    output = ROOT / 'public/_audit-contact-sheet.html'
    output.write_text(document, encoding='utf-8')
    print(output)


if __name__ == '__main__':
    main(sys.argv[1:])
