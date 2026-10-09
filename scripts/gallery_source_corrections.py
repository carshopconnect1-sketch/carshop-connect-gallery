"""Apply explicit, image-matched official metadata corrections after extraction."""
from copy import deepcopy
import json
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
REVIEW_PATH = ROOT / 'audit/yellow-color-review-2026-10-01.json'
COLOR_REVIEW_PATH = ROOT / 'audit/all-color-review-2026-10-02.json'
RECOVERY_PATH = ROOT / 'audit/source-recoveries-2026-10-05.json'
VEHICLE_REVIEW_PATH = ROOT / 'audit/vehicle-identity-2026-10-06.json'


def apply_vehicle_metadata_corrections(cases, require_all=True):
    """Replace copied chassis/SKU fields only for reviewed, identical photo sets."""
    review = json.loads(VEHICLE_REVIEW_PATH.read_text(encoding='utf-8'))
    corrections = {row['caseId']: row for row in review['metadataCorrections']}
    seen = set()
    for case in cases:
        entry = corrections.get(case['id'])
        if not entry:
            continue
        detail = case['detail']
        if case['brand'] != entry['brand'] or detail['images'] != entry['verifiedImages']:
            raise ValueError(f'Vehicle metadata correction no longer matches photos: {case["id"]}')
        if detail['photoInfo'] not in (entry['originalPhotoInfo'], entry['photoInfo']):
            raise ValueError(f'Vehicle metadata changed; review before replacing: {case["id"]}')
        detail.setdefault('originalPhotoInfo', deepcopy(entry['originalPhotoInfo']))
        detail['photoInfo'] = deepcopy(entry['photoInfo'])
        detail['vehicleMetadataSource'] = {
            'url': entry['sourceUrl'], 'checkedAt': review['checkedAt'],
            'reason': entry['reason'], 'verifiedImages': entry['verifiedImages'],
        }
        seen.add(case['id'])
    if require_all and seen != set(corrections):
        raise ValueError(f'Missing reviewed vehicle cases: {sorted(set(corrections) - seen)}')
    return seen


def apply_source_recoveries(cases):
    """Restore audited exclusions only when the original photographs are available."""
    if not RECOVERY_PATH.is_file():
        return 0
    recovery = json.loads(RECOVERY_PATH.read_text(encoding='utf-8'))
    added = 0
    for entry in recovery['entries']:
        if entry['status'] != 'ready':
            continue
        case = deepcopy(entry['case'])
        images = case['detail']['images']
        if not images or case['photoCount'] != len(images) or entry['imageStatus'] != [200] * len(images):
            raise ValueError(f'Recovery photographs have not been verified: {case["id"]}')
        if any(urlsplit(image).scheme != 'https' or urlsplit(image).hostname != 'refinad.com' for image in images):
            raise ValueError(f'Untrusted recovery image: {case["id"]}')
        existing = next((item for item in cases if item['id'] == case['id']), None)
        if existing:
            if existing != case:
                raise ValueError(f'Recovery conflicts with an existing case: {case["id"]}')
            continue
        if any(case['image'] in item['detail']['images'] for item in cases):
            raise ValueError(f'Recovery duplicates an existing photograph: {case["id"]}')
        # These were already on the old shop; migration must not mark them NEW.
        if case.get('firstPublishedAt'):
            raise ValueError(f'Legacy recovery cannot reset the NEW date: {case["id"]}')
        cases.append(case)
        added += 1
    return added


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


def apply_color_corrections(cases, require_all=True):
    """Only override reviewed body colors; source SKU/series may contain errors."""
    review = json.loads(COLOR_REVIEW_PATH.read_text(encoding='utf-8'))
    corrections = {row['caseId']: row for row in review['entries'] if row.get('correction')}
    seen = set()
    for case in cases:
        entry = corrections.get(case['id'])
        if not entry:
            continue
        detail = case['detail']
        if detail['images'] != entry['verifiedImages'] or case['brand'] != entry['brand']:
            raise ValueError(f'Color source correction no longer matches photos: {case["id"]}')
        change = entry['correction']
        detail.setdefault('originalAlt', detail['alt'])
        for key in ('car', 'colorName', 'colors'):
            if key in change:
                case[key] = deepcopy(change[key])
        # Vehicle/code/link overrides are permitted only for the separately
        # verified product, never copied from an inconsistent official field.
        if any(key in change for key in ('car', 'photoInfo', 'productUrl')):
            check = entry['productCheck']
            if any(info['品番'] not in check['selectableCodes'] for info in change['photoInfo']):
                raise ValueError(f'Photo code absent from verified product: {case["id"]}')
            for key in ('photoInfo', 'productUrl'):
                detail[key] = deepcopy(change[key])
        detail['alt'] = f'{case["car"]} {case["brand"]} {case["series"]} {case["colorName"]} シートカバー装着写真'
        confirmation = entry.get('userConfirmation')
        detail['colorSource'] = ('ユーザー確認（同一写真を提示して色名を確認）' if confirmation
            else f'{case["brand"]}公式装着ページのカラー欄（同一写真URLを照合）')
        detail['colorReview'] = {
            'url':entry['sourceUrl'], 'checkedAt':review['checkedAt'],
            'colorFields':entry['colorFields'], 'verifiedImages':entry['verifiedImages'],
            'scope':entry.get('scopeNote', '同一写真の本体色のみ確認。縁取り・ステッチの色を除外。'),
        }
        if confirmation:
            detail['colorReview']['userConfirmation'] = deepcopy(confirmation)
        seen.add(case['id'])
    if require_all and seen != set(corrections):
        raise ValueError(f'Missing reviewed color cases: {sorted(set(corrections) - seen)}')
    return seen
