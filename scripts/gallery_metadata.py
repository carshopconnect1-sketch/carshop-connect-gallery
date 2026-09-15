"""Color labels from saved photo descriptions; no image or review-text inference."""
import re
from urllib.parse import urlsplit, urljoin

COLOR_NAMES = {
    'ブラック':['black'],
    **{x:['brown'] for x in ['ブラウン','ダークブラウン','キャメル','ビターショコラ','ナチュラルブラウン','アースブラウン','モカブラウン','ココアブラウン']},
    **{x:['beige'] for x in ['ベージュ','シルキーベージュ','アイボリー','ショコラベージュ']},
    **{x:['white'] for x in ['スノーホワイト','ホワイト','シャインホワイト']},
    **{x:['gray'] for x in ['グレー','ライトグレー','チャコールグレー','ミストグレー','ダークグレー','シルバー']},
    'グレージュ':['gray','beige'], 'ブルーグレー':['blue','gray'],
    **{x:['red'] for x in ['ワインレッド','レッド','ボルドー','ガーネット','バーガンディ','アロマワイン','スカーレット']},
    **{x:['blue'] for x in ['アクアマリン','インディゴブルー','ネイビー','スカイブルー','セレストブルー','セルリアンブルー','ライトブルー','ブルー']},
    **{x:['green'] for x in ['ディープグリーン','ダークグリーン','スプリンググリーン','グリーン']},
    **{x:['yellow'] for x in ['マスタード','クリームイエロー','レモンイエロー']},
    **{x:['orange'] for x in ['レトロオレンジ','ミッドオレンジ']},
    **{x:['pink'] for x in ['ピーチピンク','ローズピンク']},
    'ピオニーパープル':['purple'], 'ビンテージ':['other'],
}
COLOR_PATTERN = re.compile(r'\s('+ '|'.join(sorted(map(re.escape,COLOR_NAMES),key=len,reverse=True)) +r')\s+シートカバー装着写真\s*$')

def photo_color(alt):
    match=COLOR_PATTERN.search(alt)
    label=match[1] if match else ''
    return label, COLOR_NAMES.get(label, [])

def image_key(url):
    parsed=urlsplit(urljoin('https://seatcover.jp/gallerys/v2/',url))
    return parsed.netloc+parsed.path.removesuffix('.webp')
