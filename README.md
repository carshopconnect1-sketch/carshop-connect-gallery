# CONNECT 装着ギャラリー 新案

2026-09-14。ユーザーの「一個まえがよかった」に合わせ、新TOP（4177の確認画面／実体4173）の書体・白背景を使う案へ戻し、動画は現行ギャラリーのものに差し替えた、検索・詳細閲覧ができるローカル制作プレビュー。

- 新案: http://127.0.0.1:4180/
- SP・PCを左右に並べるプレビュー: http://127.0.0.1:4180/preview.html
- 旧版・現在構成・新案の比較: http://127.0.0.1:4180/compare.html
- 調査と検証: [audit/comparison-analysis.md](audit/comparison-analysis.md)
- 絞り込みUIの参考サイト・採用判断・検証: [audit/filter-ux-research-2026-09-15.md](audit/filter-ux-research-2026-09-15.md)
- 専用Git・Sitesの公開手順: [DEPLOY.md](DEPLOY.md)

## 編集するファイル

| ファイル | 用途 |
|---|---|
| public/index.html | 新ギャラリーの見出し・検索欄・フッター |
| public/gallery.css | TOPと共通の色・書体・レスポンシブ表示 |
| public/gallery-editorial.css | 取り消した現行風案の未使用CSS。読み込みなし |
| public/hero-video.css / hero-video.js | 全幅動画ヒーローと再生・一時停止。動画URLはindex.htmlで指定。停止時は冒頭フレームを表示 |
| public/app.js | 検索UI・段階表示・写真詳細 |
| public/filter.js | ブランド・シリーズ・色系統・掲載色名の複合検索、URL・表記揺れの照合 |
| public/discovery-filters.css | ブランド・シリーズ・色の大きな選択ボタンの基礎スタイル |
| public/finder-workbench.css | 最新の4つの検索入口・条件要約・車種候補・追従ボタン。最後に読み込む |
| public/finder-state.js | 条件解除の依存関係、車種名の候補検索、0件時の回復候補の計算 |
| public/typography.css | 最新指定のJosefin Sans。英字・数字とヒーローのサイズ調整。日本語は既存書体へフォールバック |
| public/maker-data.js | ロゴから選べる国産10社・輸入14社のメーカー対応 |
| audit/brand-maker-assets.json | 円形表示に使うブランドロゴ4点とメーカー24社の素材出典・ハッシュ |
| scripts/import-old-gallery.py / gallery_metadata.py | 提供ZIPの静的データ抽出、保存写真説明の色名抽出 |
| public/data/catalog.json | 軽量検索インデックス。画像・全コメントは別JSON |
| public/data/details/ | 事例別の元写真、掲載コメント、元の商品リンク |
| scripts/build-data.py | 保存HTMLからの再現可能なデータ抽出 |
| scripts/prepare-featured.py | 先頭12事例の元写真からWebPを生成 |
| public/compare.* | 新旧の切り替えと比較表 |

新TOPの既存ファイルは編集していない。共通ロゴとBebas Neueを使用。動画は現行ギャラリーのalphard.mp4。左寄せの大きな見出し、白背景、動画直下の検索へ復帰。写真は実データで、年式・色・価格・星評価を生成していない。

2026-09-15の最新検索UIは車／ブランド・シリーズ／色／その他の4パネル。大きな入口から自由に組み合わせ、選択条件を個別に解除できる。メーカー選択後の車種は名前検索と件数付きボタン、選択ブランドのシリーズは全縦写真を表示。写真への件数付き追従ボタンと0件時の具体的な条件解除候補を追加。従来のPCサイドバー、SP追加条件ダイアログ、車種・シリーズの重複セレクトは廃止している。以下の変更履歴より、この記述を最新とする。

同日の追加調整で、入口をPC/SP共通の1行タブに整理。空の条件ボックス、重複する説明・ナビゲーション・件数を削減し、個別解除は条件チップへ集約した。キーワード入力と詳しい色名は必要なときに開く。写真閲覧は1つのボタンに統一し、長いシリーズ一覧のときだけ追従する。丸ロゴと全シリーズ表示は維持。

## 起動・検証

```powershell
pwsh -NoProfile -File scripts/start-preview.ps1
node --test tests/*.test.mjs
npm run check
```

Node.jsだけでプレビュー可能。npm installは不要。起動スクリプトは4180番と所属を検査し、同じプロジェクトの正常なサーバーを再利用。別プロセスには介入しない。新規起動は独立した非表示プロセスで行い、`.preview/launcher.json`、`server.json`、標準出力・エラーログに記録。終了時に自動停止しない。Windowsへの自動起動登録は追加していない。

## データを再構築するとき

取得済みアーカイブは除外ディレクトリ`.source/archive`。`csc-gallery-handoff`のコミット`290401cb164b6fdf6d1dccaff4da8252e7b45269`から取得。別のPCではこのリポジトリへの権限が必要。

```powershell
python -X utf8 scripts/import-old-gallery.py C:/Users/CONNECT_creator/Downloads/old.zip
python -X utf8 scripts/build-data.py
python -X utf8 scripts/prepare-featured.py
python -X utf8 scripts/build-data.py
```

2回目の抽出で生成済みサムネイルのパスをインデックスに取り込む。画像処理はPillowを使用。取り込み対象は車種別396HTML。6ページ578レコードを保留、同じブランド・シリーズ・表紙画像の168レコードを重複整理する。さらに、ジムニー Heritage Mesh の手動追加3カードは内容を目視精査し、車外・別車種・別シリーズの写真を除外して9枚の1カードへ統合した。提供されたold.zipからIXUS143件を加え、公開カタログは合計2,895件。除外・重複・手動精査の記録は`audit/data-extraction.json`に残す。IXUSはメーカー名だけがあり車種名・色名は未記載。写真説明に色名が残る2,706件に52色名を付与し、色系統・掲載色名で検索できる。輸入車などの表記統一・写真対応は本番移行時に追加確認が必要。

## 本番へ移す前に

これは完成形をレビューするためのローカル実装。現在の本番配置先・反映方法・更新元を確認し、最新データを照合する。現在はルート(`/`)で動くため、本番の`/gallerys/`に置く場合はJS/CSS/data/assetのベースパスを合わせる。ロゴのTOPリンクは4173から本番TOPに変更し、比較用リンク・noindex・プレビュー注記を制作環境と本番で分ける。

旧版比較のHTMLは親フォルダ`audit/gallery-2026-09-14/sources`と`.source/archive`を明示ルートから読み込む。`.source`全体はHTTP公開しない。比較の車種別リンク先は6月保存版であり、5月のサイト全体を復元したものではない。

Git pushからseatcover.jpへ自動反映する処理は追加していない。7月の引き継ぎ資料の手動アップロード運用が現在も有効かどうかは未確認。


## 最新: ブランドロゴと縦型シリーズ選択

公式 https://seatcover.jp/c/seatcovermaker のPICK UPから51シリーズ分の縦写真（576/577×680）を取得。public/assets/seriesへ元バイト列を保存し、ブランド別の写真選択カードを実装した。PC6列・1400px以下4列・スマホ2列。全一覧展開、赤枠とチェック、装着写真へのリンク。事例未収録のシリーズは準備中。旧シリーズで画像との対応が未確認のものは「その他の掲載シリーズ」と元のセレクトで探せる。

4ブランドのロゴは新TOPのSVGをそのままコピー。シリーズ別表記はseries-data.jsで明示対応しfilter.jsで集約（マカロン237件、シルキーベージュ41件）。元カタログは書き換えていない。パネル等は混ぜない。audit/series-reference.mdに詳細、audit/series-assets.jsonに画像出典・寸法・ハッシュ。スマホ390/320pxの収まりと条件復元、PCの写真選択と一覧開閉を確認。


## 最新変更: 全シリーズを初期表示

ユーザーの「なぜ4つしか出ない？」に対応。初期4/6件への制限と折り畳み操作を削除し、Sandii選択時は14件、すべてのブランドでは51件を最初から並べる。PCの4/6列とスマホ2列は維持。画像対応未確認の旧シリーズも「その他の掲載シリーズ」から常時選べる。


## 最新変更: ブランドの「すべて」を削除

ブランドボタンをRefinad・Sandii・Dotty・IXUSの4択に変更（PC4列、スマホ2列）。ブランド未選択時はシリーズ写真を隠してシリーズ名選択を無効にし、ブランド選択を案内。選択後はそのブランドの全シリーズを表示する。リセットとブランド条件解除は未選択へ戻り、従属するシリーズ・掲載色名も解除。車種・キーワード・色による検索は引き続き可能。
