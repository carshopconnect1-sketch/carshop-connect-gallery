import copy
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from gallery_source_corrections import apply_source_corrections


class OfficialSourceCorrections(unittest.TestCase):
    def setUp(self):
        review = json.loads((ROOT / 'audit/yellow-color-review-2026-10-01.json').read_text(encoding='utf-8'))
        self.cases = [dict(id=row['caseId'], brand='Sandii', car=row['car'],
            series=row['series'], colorName=row['savedColor'], colors=['yellow'],
            detail={'images':row['verifiedImages'], 'photoInfo':row['savedPhotoInfo'],
                'alt':f'{row["car"]} Sandii {row["series"]} {row["savedColor"]} シートカバー装着写真'})
            for row in review['entries']]

    def test_extraction_cannot_restore_the_wrong_color_or_photo_code(self):
        self.assertEqual(len(apply_source_corrections(self.cases)), 15)
        spacia = next(c for c in self.cases if c['id'] == 'e2d0548abb55')
        self.assertEqual(spacia['colors'], ['beige'])
        self.assertEqual(spacia['detail']['photoInfo'][0]['品番'], 'S0361-09')
        self.assertIn('マスタード', spacia['detail']['originalAlt'])
        corrected = copy.deepcopy(self.cases)
        apply_source_corrections(self.cases)
        self.assertEqual(self.cases, corrected)

    def test_a_changed_photo_set_stops_the_correction(self):
        spacia = next(c for c in self.cases if c['id'] == 'e2d0548abb55')
        spacia['detail']['images'] = ['https://sandii.net/a-different-photo.jpeg']
        with self.assertRaisesRegex(ValueError, 'no longer matches photos'):
            apply_source_corrections(self.cases)

    def test_missing_reviewed_cases_stop_full_extraction(self):
        with self.assertRaisesRegex(ValueError, 'Missing reviewed source cases'):
            apply_source_corrections([])


if __name__ == '__main__':
    unittest.main()
