# futureshop実装可否の確認

確認日：2026年9月25日。対象：gallery-next（コミット `8b62549`）、seatcover.jpの公開ページ、futureshop公式仕様。

**判定：現在のギャラリーはfutureshopに実装可能と判断する。ただし、futureshop向けの組み込み・配信パスの修正が必要。管理画面への登録・非公開プレビューでの実機確認は今回実施していない。**

既存のデザイン、車種画像、複数条件の絞り込み、写真詳細、ライフスタイル紹介を維持する構成を取れる。ギャラリー本体はHTML・CSS・JavaScriptと静的データで動き、公開時にNode.jsサーバーやデータベースを必要としない。

## 1. 実店舗で確認できたこと

| 調査対象 | 確認結果 | 意味 |
| --- | --- | --- |
| `https://seatcover.jp/` | HTTP 200。`fs-body-top`等のクラス、futureshopシステムCSS/JSを確認 | 現在の店舗はcommerce creatorを使用 |
| `https://seatcover.jp/f/gallery_renewal` | HTTP 200。`fs-body-custom`、共通ヘッダー、装着写真ギャラリー本文を確認 | 店舗内のフリーページが既に存在する。空のテスト用URLではない |
| `https://seatcover.jp/gallerys/` | HTTP 200。独自のHTML・CSS・JSを配信。取得HTMLには上記のfutureshopクラスなし | `/f/`とは構成が異なる。配置サーバー・契約・更新権限までは外部から確定できない |
| 現在の独自JS 2本 | `carshopconnect.itembox.cloud`からHTTP 200、`Content-Type: text/javascript`、`Access-Control-Allow-Origin: *` | この店舗のアイテムボックスで、独自JSの配信と別ドメインからの読み込みに必要な応答を確認 |
| 現在の独自CSS | 同ホストからHTTP 200、`Content-Type: text/css`、`Access-Control-Allow-Origin: *` | 独自CSS配信を確認 |
| 既存ヒーロー動画 | `/gallerys/v2/alphard.mp4`へのHEADが200。10,407,549 bytes、`video/mp4`、`Accept-Ranges: bytes` | 約10.4MBの動画が現在配信されている。将来の配置先の承認や再生試験とは別 |

JSの確認対象は既存の `car-model-link.js` と `common.js`。新規にアップロードするJSON・フォント・動画の受入可否を、この結果だけで保証はしない。

公開ページ：[店舗トップ](https://seatcover.jp/)、[既存フリーページ](https://seatcover.jp/f/gallery_renewal)、[現行ギャラリー](https://seatcover.jp/gallerys/)。

## 2. 推奨する組み込み方

**commerce creatorのフリーページにギャラリー本文を入れ、店舗の共通ヘッダー・フッターを使う。写真・CSS・JavaScriptはアイテムボックスに配置する。**

フリーページは `/f/` 配下に作成でき、ページ別のレイアウトとHTML本文、パーツを使用できる。まず専用の非公開ページとレイアウトで確認し、既存の `/f/gallery_renewal` を直接上書きせず進める。[公式：フリーページ追加・変更](https://manual.future-shop.jp/builder-CC/freepage/freepage-setting)

ギャラリー用CSS/JSはこのレイアウトだけに読み込む。全ページ共通のheadやオリジナルCSSへ一括投入しない。既存のナビゲーション、会員表示、カートは店舗の共通パーツを再利用する。[公式：CSS・JavaScriptの配置方法](https://faq.future-shop.jp/hc/ja/articles/4419637666073-CSS%E3%82%84JavaScript%E3%82%92%E8%A8%98%E8%BF%B0%E3%81%99%E3%82%8B%E5%A0%B4%E6%89%80%E3%81%AF%E3%81%A9%E3%81%93%E3%81%A7%E3%81%99%E3%81%8B)、[公式：フリーパーツ](https://manual.future-shop.jp/builder-CC/parts/parts-free)

画像等の通常アイテムは `https://carshopconnect.itembox.cloud/item/...` で配信する。公式に認められた静的HTMLの `/s/` にはHTML・JavaScriptだけを配置し、CSS・JSON・画像をまとめて同じ場所へ置かない。[公式：アイテム一覧・静的HTML](https://manual.future-shop.jp/builder-CC/item/itemList/)

写真データは、JSONのアップロードと読み込みを非公開検証で確かめて採用する。利用できなければ、データをJavaScriptモジュールとして書き出し、一覧用と必要時に読む詳細用に分ける構成が取れる。既存JSの配信ヘッダーはこの代替案に必要な条件を満たしているが、生成物の実動作は別途確認する。

| 配置方法 | 判断 |
| --- | --- |
| commerce creatorのフリーページ＋アイテムボックス | 推奨。店舗共通のヘッダー・フッターを維持しやすい |
| 既存 `/gallerys/` の配置先を更新 | 更新権限・ルーティングが分かれば候補。既存URLを維持できる利点がある |
| `/s/...html` に独立したHTMLを置く | 技術上の代替案。ただし静的HTMLでは会員情報や共通パーツの置換機能を利用できないため、今回の希望には優先しない |

CMSオプションならショップドメインの下に独自コンテンツを置ける。ただし、現在の `/gallerys/` がその契約によるものかは未確認。今回の静的ギャラリーのために、新しくCMS契約が必須とは判断しない。[公式：CMSサーバーオプション](https://www.future-shop.jp/function/cms.html)

## 3. 現在のコードに必要な修正

| 優先度 | 発見した問題 | 対応 |
| --- | --- | --- |
| 必須 | 画像・CSS・JSが `/assets/...` や `/app.js` のようにサイト直下を参照 | futureshopの実際の配信URLに合わせ、参照先をまとめて設定できるビルドを追加 |
| 必須 | 一覧・詳細が `/data/catalog.json`、`/data/details/{id}.json` 固定 | データ配置先を変更。JSONの配信確認、またはJSモジュールへの変換 |
| 必須 | ライフスタイルの車種リンクが `/?maker=...#photoResults` | `/f/`等への移植後は店舗トップへ飛ぶ。ギャラリーのページパスを含めて生成する |
| 必須 | ギャラリー自身のヘッダー・フッターと店舗メニューJSがある | 本体から切り離し、futureshop側の共通パーツに統合 |
| 必須 | `:root`、`body`、見出し、ボタン、`.wrap`等への広いCSS指定 | ギャラリーの領域に限定。店舗共通CSSとの競合をPC/SPで確認。外側のレイアウト幅も専用ページで調整 |
| 公開前 | `noindex,nofollow`、制作プレビュー注記、比較ページへのリンクが残る | 本番用出力では制作向けUIを除去し、タイトル・検索エンジン向け設定を整える |
| 公開前 | 現在のビルドはSites専用のホスティング設定を要求 | futureshop用の出力とアップロード手順を別途追加。GitHubへのpushだけではfutureshopに反映されない |

確認箇所：

- [一覧・詳細のデータ読み込み](C:/Users/CONNECT_creator/Documents/ChatGPT/HP改修/gallery-next/public/app.js:297)
- [ページ直下へ飛ぶ車種リンク](C:/Users/CONNECT_creator/Documents/ChatGPT/HP改修/gallery-next/public/lifestyle-data.js:269)
- [HTML・アセット参照・本番向け設定](C:/Users/CONNECT_creator/Documents/ChatGPT/HP改修/gallery-next/public/index.html:5)
- [CSSの適用範囲](C:/Users/CONNECT_creator/Documents/ChatGPT/HP改修/gallery-next/public/gallery.css:2)
- [現在のSites用ビルド](C:/Users/CONNECT_creator/Documents/ChatGPT/HP改修/gallery-next/scripts/build-site.mjs:1)

HTMLのIDは、今回取得した既存フリーページとギャラリーの間では重複していなかった。ただし、共通CSSやJSの操作対象まで競合しないという意味ではない。

## 4. 機能と運用の範囲

| 機能 | 実装判断・条件 |
| --- | --- |
| 車メーカー・車種・ブランド・カラー等の絞り込み | 実装可能。現在のブラウザー内処理を移植できる |
| 車種画像・ブランドロゴ・写真一覧 | 実装可能。正しい画像URLと遅延読み込みを維持する |
| 詳細モーダル・複数写真・サムネイル | 実装可能。詳細データの読み込み先を直す |
| ライフスタイル紹介・インタビューへの導線 | 実装可能。リンクのページパスを修正する |
| 動画 | 実装可能。配信先・容量・読み込みタイミングを確認する。CMS VPSは動画配信用ではない |
| 「この商品を見る」 | 通常の店舗商品ページへのリンクとして実装可能 |
| 会員・カート表示 | futureshopの共通パーツで扱う。現在のコピーしたヘッダーだけでは状態連動しない |
| 商品の在庫・販売終了・価格の自動反映 | 現在のギャラリーに連携処理はない。必要なら別途データ連携を設計 |
| 年式・型式・グレードによる適合判定 | 車種の絞り込みだけでは保証できない。商品ページ側の適合情報と対応づけが必要 |
| 写真・事例・タグの継続追加 | 現状はデータ再生成・再配置で更新。futureshopの商品登録だけで自動追加される仕組みではない |

動画をCMS VPSへ移す案は採用しない。公式にも動画配信を控える旨が示されている。[公式：CMSサーバーオプション](https://www.future-shop.jp/function/cms.html)

## 5. データ量と配信上の確認

- 現在の公開ビルド：3,228ファイル、28,513,130 bytes（約28.5MB）。
- 一覧データ：2,895事例、約1.14MB。詳細は個別に取得する構成。
- ローカルの動画4本：合計約4.45MB。最も大きいローカルファイルは約1.18MB。
- 別途参照中の既存ヒーロー動画：約10.4MB。上記28.5MBには含まない。
- 多数の装着写真はブランドサイト、車種画像は `m-connect.co.jp` を参照している。上記容量は全写真の移設容量ではない。

通常アイテムの公式上限は1ファイル30MB。今回のローカルファイルはその容量条件を満たす。ただし、総空き容量と拡張子ごとの実際の登録・配信は管理画面で確認する。[公式：アイテムの容量と登録](https://manual.future-shop.jp/builder-CC/item/itemList/)

現在の `/gallerys/` は3,571事例と表示し、今回のデータは2,895事例。重複整理・除外など集計条件が異なるため、単純に差分676件が欠落とは判断できない。本番置換前に、採用・重複・除外・追加分の対応表で収録範囲を確定する。実装可能であることと、全データの移行完了は別の確認である。

## 6. 実環境で残る確認

1. 管理画面で専用の非公開フリーページとレイアウトを作れること、アイテム登録権限・空き容量を確認する。
2. 小さいテストデータとJS・CSS・WebP・フォント・動画を配置し、正常な配信形式と読み込みを確認する。JSONが使えない場合は前述のJS形式を検証する。
3. 本体を組み込み、PC/SPでヘッダー、メニュー、絞り込み、詳細写真、動画、商品リンクを確認する。URL再読込・ブラウザーの戻る操作も対象にする。
4. 実際の携帯回線相当で初期表示と絞り込みの応答を測る。共通CSS/JSが加わるため、Sitesでの表示速度をそのまま本番の速度とはみなさない。
5. 既存の `/gallerys/` と車種別URLの扱い、ページタイトル、canonical、noindexの解除方針、収録データの範囲を確定して公開する。

今回行ったのは、ローカルコードの確認、公開ページのHTTP取得、既存アセットの配信ヘッダー確認、公式仕様との照合。本番ページの変更、管理画面操作、ファイルアップロードは行っていない。

取得証跡は [公開ページ情報](C:/Users/CONNECT_creator/Documents/ChatGPT/HP改修/gallery-next/.source/futureshop-feasibility-2026-09-25/live-page-metadata.json) と [アセット配信確認](C:/Users/CONNECT_creator/Documents/ChatGPT/HP改修/gallery-next/.source/futureshop-feasibility-2026-09-25/asset-probes.json) に保存した（いずれもGit管理対象外）。
