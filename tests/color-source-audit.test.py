import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'scripts'))
spec = importlib.util.spec_from_file_location('color_audit', ROOT/'scripts/audit-source-colors.py')
color_audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(color_audit)
from gallery_source_corrections import apply_color_corrections


class ColorAuditRegression(unittest.TestCase):
    def test_repeated_color_fields_preserve_both_seat_colors(self):
        page = color_audit.parse('https://sandii.net/example/', '''
          <div class="qodef-portfolio-media"><img src="https://sandii.net/wp-content/uploads/seat.jpg"></div>
          <div class="qodef-portfolio-content"><h6>カラー</h6><p>S23ブルーグレー</p>
          <h6>カラー</h6><p>S17スノーホワイト</p></div>
          <footer><h6>カラー</h6><p>イエロー</p><img src="https://sandii.net/wp-content/uploads/unrelated.jpg"></footer>''')
        self.assertEqual(page['fields'], {'カラー':'S23ブルーグレー / S17スノーホワイト'})
        self.assertEqual(page['images'], ['https://sandii.net/wp-content/uploads/seat.jpg'])

    def test_stitches_are_not_the_main_seat_color(self):
        self.assertEqual(color_audit.main_color_text('キャメル（アイボリーステッチ）'), 'キャメル（')
        self.assertEqual(color_audit.main_color_text('BLACK / IVORY PIPING'), 'ブラック / ')
        self.assertEqual(color_audit.main_color_text('黒・アイボリー'), 'ブラック・アイボリー')

    def test_corrections_survive_reextraction_without_changing_photos(self):
        review = json.loads((ROOT/'audit/all-color-review-2026-10-02.json').read_text(encoding='utf-8'))
        cases = [dict(id=e['caseId'], brand=e['brand'], car=e['car'], series=e['series'],
            colorName=e['savedColor'], colors=e['savedColors'], detail=dict(images=e['verifiedImages'],
            photoInfo=e['savedPhotoInfo'], alt=f'{e["car"]} {e["brand"]} {e["series"]} {e["savedColor"]} シートカバー装着写真')) for e in review['entries']]
        before = copy.deepcopy(cases)
        self.assertEqual(len(apply_color_corrections(cases)), 10)
        self.assertEqual([c['detail']['images'] for c in cases], [c['detail']['images'] for c in before])
        for c, original in zip(cases, before):
            if c['id'] in ['615e38a9ff54','24eb4b9aaa35','b325a85665c8','59a755160844']:
                self.assertEqual(c, original)
        corrected = copy.deepcopy(cases)
        apply_color_corrections(cases)
        self.assertEqual(cases, corrected)
        cases[0]['detail']['images'] = ['https://sandii.net/unrelated.jpg']
        with self.assertRaisesRegex(ValueError, 'no longer matches photos'):
            apply_color_corrections(cases)
        with self.assertRaisesRegex(ValueError, 'Missing reviewed color cases'):
            apply_color_corrections([])


if __name__ == '__main__':
    unittest.main()
