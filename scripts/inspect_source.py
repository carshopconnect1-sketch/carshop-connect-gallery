from html.parser import HTMLParser
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.source/archive/ビュー/_gallery_handoff_view/gallery'

class GalleryParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.cards = []
        self.active = None
        self.title = ''
        self.in_title = False
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'title': self.in_title = True
        if 'g-card' in a.get('class', '').split():
            self.active = a.copy()
            self.cards.append(self.active)
        if tag == 'img' and self.active is not None and 'thumbnail' not in self.active:
            self.active['thumbnail'] = a.get('src', '')
            self.active['alt'] = a.get('alt', '')
    def handle_endtag(self, tag):
        if tag == 'title': self.in_title = False
    def handle_data(self, data):
        if self.in_title: self.title += data

if __name__ == '__main__':
    total = 0
    for file in sorted(SOURCE.glob('*.html')):
        p = GalleryParser(); p.feed(file.read_text(encoding='utf-8-sig'))
        total += len(p.cards)
        if file.stem in ['toyota_hiace2', 'suzuki_jimny', 'daihatsu_movecanbus', 'honda_nbox', 'suzuki_jimny_combined', 'audi_a3-sportback', 'honda_vezel']:
            sample = p.cards[min(3, len(p.cards)-1)] if p.cards else {}
            print(json.dumps({'file':file.name,'title':p.title,'count':len(p.cards),'sample':{k:v[:260] for k,v in sample.items()}},ensure_ascii=False))
    print('FILES',len(list(SOURCE.glob('*.html'))),'CARDS',total)
