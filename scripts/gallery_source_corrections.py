"""Apply explicit, image-matched official metadata corrections after extraction."""
from copy import deepcopy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVIEW_PATH = ROOT / 'audit/yellow-color-review-2026-10-01.json'


def apply_source_corrections(cases, require_all=True):
    review = json.loads(REVIEW_PATH.read_text(encoding='utf-8'))
    corrections = {row['caseId']: row for row in review['entries'] if row.get('correction')}
    seen = set()
    for case in cases:
        entry = corrections.get(case['id'])
        if not entry:
            continue
        detail = case['detail']
        if detail['images'] != entry['verifiedImages'] or case['brand'] != 'Sandii':
            raise ValueError(f'Official source correction no longer matches photos: {case["id"]}')
        change = entry['correction']
        if 'colorName' in change or 'car' in change:
            detail.setdefault('originalAlt', detail['alt'])
        for key in ('car', 'colorName', 'colors'):
            if key in change:
                case[key] = deepcopy(change[key])
        for key in ('photoInfo', 'productUrl'):
            if key in change:
                detail[key] = deepcopy(change[key])
        if 'colorName' in change or 'car' in change:
            detail['alt'] = f'{case["car"]} {case["brand"]} {case["series"]} {case["colorName"]} シートカバー装着写真'
        if 'colorName' in change:
            detail['colorSource'] = 'Sandii公式装着ページのカラー欄（同一写真URLを照合）'
        detail['sourceMetadata'] = {
            'url': entry['sourceUrl'], 'checkedAt': review['checkedAt'],
            'officialColor': entry['officialColor'], 'officialCode': entry['officialCode'],
            'officialVehicleLabel': entry['officialCar'],
            'verifiedImages': entry['verifiedImages'],
        }
        detail['sourceCorrection'] = '公式の同一装着写真と本文のカラー・品番欄を照合し、保存資料の誤記を訂正。'
        seen.add(case['id'])
    if require_all and seen != set(corrections):
        raise ValueError(f'Missing reviewed source cases: {sorted(set(corrections) - seen)}')
    return seen
