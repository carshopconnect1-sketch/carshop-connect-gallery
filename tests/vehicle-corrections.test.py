import copy
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from gallery_source_corrections import apply_vehicle_metadata_corrections


class VehicleMetadataCorrections(unittest.TestCase):
    def setUp(self):
        review = json.loads((ROOT / 'audit/vehicle-identity-2026-10-06.json').read_text(encoding='utf-8'))
        self.cases = [dict(id=row['caseId'], brand=row['brand'], detail={
            'images':row['verifiedImages'], 'photoInfo':row['originalPhotoInfo']})
            for row in review['metadataCorrections']]

    def test_rebuild_keeps_original_metadata_and_is_idempotent(self):
        self.assertEqual(len(apply_vehicle_metadata_corrections(self.cases)), 2)
        self.assertEqual(self.cases[0]['detail']['photoInfo'][0]['品番'], 'T0047-02')
        self.assertEqual(self.cases[1]['detail']['photoInfo'][0]['型式'], 'DA17V')
        corrected = copy.deepcopy(self.cases)
        apply_vehicle_metadata_corrections(self.cases)
        self.assertEqual(corrected, self.cases)

    def test_changed_photos_or_metadata_stop_the_correction(self):
        changed = copy.deepcopy(self.cases)
        changed[0]['detail']['images'] = ['https://refinad.com/a-different-photo.jpg']
        with self.assertRaisesRegex(ValueError, 'no longer matches photos'):
            apply_vehicle_metadata_corrections(changed)
        self.cases[0]['detail']['photoInfo'] = [{'品番':'ANOTHER'}]
        with self.assertRaisesRegex(ValueError, 'review before replacing'):
            apply_vehicle_metadata_corrections(self.cases)


if __name__ == '__main__':
    unittest.main()
