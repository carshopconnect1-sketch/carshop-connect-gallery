"""Audit the generated gallery for cross-vehicle and mixed-source anomalies."""
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse, unquote
import json
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]

# These saved cards were individually checked against their page, product
# code/review, and all images. In these cases the photo-info model string is a
# copied or alternate label, while the gallery vehicle assignment is correct.
REVIEWED_PHOTO_INFO_MISMATCHES = {
    'a1c88c3b65a0': 'Exterior badging, source page, product code, and images confirm Cast Sport.',
    'fc9f3f9c0905': 'Image filenames, source page, and vehicle interior confirm Mira Cocoa.',
    '785c0f24f1f2': 'VEZEL is the English spelling of the Japanese Vezel label.',
    '7b291ef045f9': 'VEZEL is the English spelling of the Japanese Vezel label.',
    'a55382cdbaf9': 'VEZEL is the English spelling of the Japanese Vezel label.',
    'ad661901970f': 'VEZEL is the English spelling of the Japanese Vezel label.',
    'c9c7fd7c4238': 'VEZEL is the English spelling of the Japanese Vezel label.',
    'ff06790c42cc': 'VEZEL is the English spelling of the Japanese Vezel label.',
    '343c9f2db2ea': 'Source page, product code, review, and images confirm Crosstrek.',
    '57fc83f4aa5e': 'Source page, product code, and images confirm Crosstrek.',
    '78f32270a357': 'Source page, product code, and seven-seat images confirm Exiga.',
    'e7c169f5bc39': 'Source page and product code confirm Legacy Touring Wagon.',
    'ad79f143bea4': 'Source page and product code confirm Legacy Outback.',
    '05d57ff9725b': 'Source page, product code, exterior shot, and images confirm XV.',
    '1b82cfd5781a': 'Source page, product code, review, and images confirm XV.',
}

REVIEWED_MULTI_VEHICLE_SOURCES = {
    'audi_a3a4.html': 'The saved source intentionally combines A3 and A4; cards are assigned from their model metadata.',
    'mini_mini-bmw.html': 'The saved MINI source intentionally combines several MINI models; explicit models are retained per card.',
    'old.zip/old/v2/index.html': 'The legacy IXUS upload is an aggregate source with manufacturer labels and no verified car names.',
}

# A model can be named in photo metadata even when the gallery has no case
# categorized under that model. Keep known sibling models in the vocabulary so
# a D:2 label on a D:5 gallery case is not silently ignored.
ADDITIONAL_MODEL_LABELS = {'デリカD:2'}


def norm(value):
    return re.sub(r'[^a-z0-9ぁ-んァ-ヶ一-龠]', '', unicodedata.normalize('NFKC', value).lower())


def image_key(value):
    parsed = urlparse(value)
    return (parsed.hostname or '').lower() + unquote(parsed.path).lower()


def main():
    catalog = json.loads((ROOT / 'public/data/catalog.json').read_text(encoding='utf-8'))
    cases = catalog.get('cases', catalog)
    details = {}
    image_uses = defaultdict(list)
    set_uses = defaultdict(list)
    source_cars = defaultdict(set)
    domains = defaultdict(set)
    manual_v2 = []
    high_photo_count = []

    known_cars = sorted(
        {case['car'] for case in cases if case.get('carKnown') is not False and case['car'] != '車種名未掲載'}
        | ADDITIONAL_MODEL_LABELS,
        key=lambda value: len(norm(value)), reverse=True,
    )
    car_norms = [(car, norm(car)) for car in known_cars if len(norm(car)) >= 3]
    photo_info_conflicts = []
    photo_info_conflict_keys = set()
    reviewed_photo_info_mismatches = []

    for case in cases:
        detail = json.loads((ROOT / f"public/data/details/{case['id']}.json").read_text(encoding='utf-8'))
        details[case['id']] = detail
        identity = {'id': case['id'], 'maker': case['maker'], 'car': case['car'], 'brand': case['brand'], 'series': case['series']}
        keys = []
        for image in detail['images']:
            key = image_key(image)
            keys.append(key)
            image_uses[key].append({**identity, 'image': image})
            domains[case['id']].add((urlparse(image).hostname or '').lower())
        set_uses[tuple(sorted(keys))].append(identity)
        source_cars[detail.get('sourceFile', '')].add((case['maker'], case['car']))
        if any('/gallerys/v2/' in image for image in detail['images']):
            manual_v2.append({**identity, 'photoCount': case['photoCount'], 'images': detail['images']})
        if case['photoCount'] >= 10:
            high_photo_count.append({**identity, 'photoCount': case['photoCount'], 'domains': sorted(domains[case['id']])})

        expected = norm(case['car'])
        for info in detail.get('photoInfo', []):
            model = str(info.get('型式', '')).strip()
            if not model:
                continue
            model_norm = norm(model)
            mentioned = [car for car, car_norm in car_norms if car_norm in model_norm]
            if mentioned and not any(car_norm in expected or expected in car_norm for car, car_norm in car_norms if car in mentioned):
                conflict_key = (case['id'], model_norm, tuple(mentioned))
                if conflict_key not in photo_info_conflict_keys:
                    photo_info_conflict_keys.add(conflict_key)
                    row = {**identity, 'modelText': model, 'mentionedCars': mentioned, 'sourceFile': detail.get('sourceFile', '')}
                    reason = REVIEWED_PHOTO_INFO_MISMATCHES.get(case['id'])
                    if reason:
                        reviewed_photo_info_mismatches.append({**row, 'reviewReason': reason})
                    else:
                        photo_info_conflicts.append(row)

    def cross_groups(mapping, field):
        output = []
        for key, uses in mapping.items():
            vehicles = {(use['maker'], use['car']) for use in uses}
            products = {(use['brand'], use['series']) for use in uses}
            if len(vehicles) > 1 or len(products) > 1:
                output.append({field: key, 'vehicles': sorted([list(v) for v in vehicles]), 'products': sorted([list(v) for v in products]), 'uses': uses})
        return sorted(output, key=lambda row: (-len(row['uses']), str(row[field])))

    mixed_domain_cases = []
    for case in cases:
        if len(domains[case['id']]) > 1:
            mixed_domain_cases.append({'id': case['id'], 'maker': case['maker'], 'car': case['car'], 'brand': case['brand'], 'series': case['series'], 'domains': sorted(domains[case['id']])})

    source_file_multi_vehicle_all = [
        {'sourceFile': source, 'vehicles': sorted([list(value) for value in vehicles])}
        for source, vehicles in source_cars.items() if source and len(vehicles) > 1
    ]
    reviewed_source_file_multi_vehicle = [
        {**row, 'reviewReason': REVIEWED_MULTI_VEHICLE_SOURCES[row['sourceFile']]}
        for row in source_file_multi_vehicle_all if row['sourceFile'] in REVIEWED_MULTI_VEHICLE_SOURCES
    ]
    source_file_multi_vehicle = [
        row for row in source_file_multi_vehicle_all if row['sourceFile'] not in REVIEWED_MULTI_VEHICLE_SOURCES
    ]
    report = {
        'summary': {
            'cases': len(cases),
            'images': sum(case['photoCount'] for case in cases),
            'manualV2Cases': len(manual_v2),
            'highPhotoCountCases': len(high_photo_count),
            'mixedDomainCases': len(mixed_domain_cases),
            'reviewedPhotoInfoMismatches': len(reviewed_photo_info_mismatches),
            'reviewedMultiVehicleSources': len(reviewed_source_file_multi_vehicle),
        },
        'exactImageCrossAssignments': cross_groups(image_uses, 'imageKey'),
        'exactSetCrossAssignments': cross_groups(set_uses, 'imageSet'),
        'photoInfoVehicleConflicts': photo_info_conflicts,
        'reviewedPhotoInfoMismatches': reviewed_photo_info_mismatches,
        'mixedDomainCases': mixed_domain_cases,
        'sourceFileMultiVehicle': sorted(source_file_multi_vehicle, key=lambda row: row['sourceFile']),
        'reviewedSourceFileMultiVehicle': sorted(reviewed_source_file_multi_vehicle, key=lambda row: row['sourceFile']),
        'manualV2Cases': sorted(manual_v2, key=lambda row: (row['maker'], row['car'], row['brand'], row['series'])),
        'highPhotoCountCases': sorted(high_photo_count, key=lambda row: -row['photoCount']),
    }
    output = ROOT / 'audit/data-integrity.json'
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({**report['summary'],
                      'exactImageCrossAssignments': len(report['exactImageCrossAssignments']),
                      'exactSetCrossAssignments': len(report['exactSetCrossAssignments']),
                      'photoInfoVehicleConflicts': len(photo_info_conflicts),
                      'sourceFileMultiVehicle': len(source_file_multi_vehicle)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
