# 装着ギャラリー：プログラマー向け引き継ぎ

更新日：2026-10-09。この資料を入口に、README.md、DEPLOY.md、AGENTS.md、CHECKPOINT.mdを参照してください。後半の古い変更履歴より、各資料の最新追記を優先します。

## 受け取るもの

- GitHub： https://github.com/carshopconnect1-sketch/carshop-connect-gallery （`main`）
- 共有確認サイト： https://carshop-connect-gallery-renewal.masaruharuyama.chatgpt.site/
- PC・スマホ比較：同サイトの `/preview.html`
- 編集・ビルド元：このリポジトリ。以前の `gallery-publish` コピーは今回の配信には使用していません。

共有確認サイトはSitesのpublic／ログイン不要・noindexです。本店 `seatcover.jp` への組み込みは別作業です。GitHubへのPUSHだけで共有サイトや本店が自動更新される設定はありません。

## 最初の起動

Node.js 24系を使用してください（検証環境は24.14.1）。ローカルCMSは組み込み `node:sqlite` を使用します。現在の実行にReactやPythonは不要です。

```powershell
git clone --depth 1 --origin github https://github.com/carshopconnect1-sketch/carshop-connect-gallery.git
cd carshop-connect-gallery
npm ci
npm run check
npm test
npm run build
pwsh -NoProfile -File scripts/start-preview.ps1
```

このcloneではGitHubのremote名を `github` にします。ローカル確認とGitHubへの保存にはこれだけで足ります。既存Sitesへ更新する場合に限り、DEPLOY.mdに記載した現在のSites URLを `origin` として追加し、そのアカウントのアクセス権を確認してください。

ギャラリーは `http://127.0.0.1:4180/`、比較は `/preview.html`、スタッフ登録画面は `/admin/`。プレビューは独立した非表示プロセスで起動し、同じフォルダーの正常なサーバーを再利用します。4180を別プロジェクトが使用中なら勝手に停止・移動しないでください。

ローカルのログインは検証用です。共有サイトのChatGPTログイン・スタッフ権限とは別です。`scripts/server.mjs` はループバック専用で、公開サーバーには使用しません。

## 構成と編集箇所

| 場所 | 役割 |
| --- | --- |
| `public/index.html`・各CSS | ギャラリーと検索画面。素のHTML/CSS/JavaScript |
| `public/app.js`・`filter.js`・`finder-state.js` | 一覧・詳細・検索条件・URL・段階表示 |
| `public/vehicle-identity.js` | 車種の表記揺れ。デリカD:5等の別名と件数を共通化 |
| `public/product-link.js`・`fitment.js`・`vehicle-info.js` | 商品導線・適合情報・掲載車両情報の扱い |
| `public/admin/`・`worker/gallery.mjs` | スタッフ登録、下書き、公開、役割、履歴、競合検出、写真アップロード |
| `scripts/local-gallery-store.mjs` | ローカルSQLite／画像保存。共有環境ではD1／R2を使用 |
| `scripts/gallery-base.mjs` | 保存カタログ、新着スナップショット、写真差し替え表の合成 |
| `public/data/catalog.json`・`data/details/` | 旧HP等から再構成した2,896事例のベース |
| `public/data/mail-publications.json` | 掲載同意確認済み新着64事例と詳細。下書きではない |
| `public/data/photo-replacements.json`・`photo-replacements.js` | 事例ID＋元URLで補正版を対応させる。詳細とCMS公開情報にも適用 |
| `public/assets/gallery/corrected-20261009-lite/` | 補正済み1,458枚と480px一覧用画像 |
| `public/assets/gallery/mail-20261009-lite/` | 新着の未補正原本から作成した配信用画像221枚 |
| `scripts/build-site.mjs` | Workerを `dist/server/index.js`、静的配信を `dist/client/` へ出力 |
| `scripts/package-site.ps1` | Windows標準tarによる配信梱包と展開後容量・構成の検証 |
| `drizzle/`・`.openai/hosting.json` | CMSスキーマと既存Sitesの配信設定 |

通常の閲覧・ビルドに、ローカルの受注CSVや画像監査フォルダーは不要です。公開データと画像をGitから取得します。ベースJSONだけを数えて全件数を表示せず、合成後の公開APIを使用してください。

## 画像の受け渡し

2026-10-09の公開中データを全件照合し、装着写真10,354枚分のうち10,351枚を実ファイルとしてGitに保存しました。取得できなかった3枚には、別の写真を当てず「この写真は現在表示できません」と表示します。事例数2,960・写真順・レビュー・初回掲載日を保持しています。

補正済み1,458枚、一覧用サムネイル、新着の未補正221枚は従来の `public/assets/gallery/corrected-20261009-lite/` と `mail-20261009-lite/`。未差し替えの既存画像・車種画像は `public/assets/gallery/archive-20261009/` にSHA256の名前で保存しています。既存画像は取得したバイト列を保持し、承認済みの情報非表示版を優先しています。

詳細・表紙・サムネイル・車種画像を合わせた保存台帳は11,375実ファイル、5,025,760,538 bytes（約5.03GB、重複排除後）。画像以外や別用途の既存素材を含むリポジトリ全体はこれより大きくなります。Git LFSは使用していません。cloneで実ファイルを受け取れますが、空き容量とダウンロード時間を確保してください。

対応表は `audit/image-archive-2026-10-09.json`（元の表示URL・保存先・SHA256・容量・事例ID・写真位置・取得状況）と `.csv`（装着写真10,354行）。`public/data/photo-replacements.json` の `archivedUrls` によって、元URLを記録したベースJSONとCMS公開データも保存先へ置き換えます。ブランドサイト側の画像変更・削除で、このGit版の保存済み画像が変わることはありません。実ファイルの検証は `npm run verify:images`。

この独立保存はGit版・ローカルに適用済みです。現在の共有Sites version13は以前の配信を維持しており、まだ外部画像参照があります。全画像を含む現在のビルドはSitesの256MiB梱包上限を超えるため、そのまま再配信できません。本番移植ではこの保存フォルダーを画像ストレージへ転送するか、全容量を扱えるホストを使用してください。詳細はDEPLOY.md。

元解像度の写真、承認済み補正PNG、作業前後の比較資料・ZIPは所有者のPCに別保管しています。監査原本はローカル `gallery-next/.preview/photo-appearance-20261006/`、配信変換の控えは `.preview/photo-replacement-20261009/`。これらはGitHubには含めず、元データが必要な場合は所有者から別の共有ファイルとして受け取ってください。画像と事例の対応は `public/data/photo-replacements.json`、詳細内の `images` 配列で確認できます。

## 今回の反映状態

- 公開：2,960事例（旧HP等2,896＋新着メール64）。デリカD:5は共通の車種判定で117件。
- 承認済み写真1,458枚／988事例を一覧・詳細に差し替え。37枚の情報非表示版も適用。
- 新着64事例の256写真は、補正35枚と形式変換のみ221枚。配信は長辺1,200px・WebP品質82、一覧は480px。元写真・元解像度の承認PNGは手元に保管。
- NEWは初回掲載日で判定。既存事例の編集やデータ移行で初回日を更新しない。
- 共有公開版：version13、公開ソース `c15729bf04686a29f4b310d3d9d46769bb7a90e2`。
- deployment：`appgdep_6ac87accea008191abe9f45ddd8f836b`、2026-10-09 05:27 UTCにsucceeded。今回の引き継ぎ資料のコミットは公開ソースの後続です。

今回のGit版はNodeテスト81件、構文チェック、Workerビルドを確認。画像のSHA256と全保存画像のデコードを検証し、全件のローカル画像参照・補正版優先・写真順・件数を確認。Chromeでヒーロー動画の再生と一時停止／再開を確認しました。PCでは自動再生が拒否された場合も「動画を再生」から再開できます。ユーザー指定によりSP（760px以下）の操作ボタンは非表示。元の停止原因そのものは再現していません。

以前の公開差し替え検証（version13）：988詳細と補正／一覧2,916画像のハッシュ一致、新着64詳細と221配信画像の一致。詳細は `audit/photo-replacement-2026-10-09.md`。現在の全画像保存とは配信版を区別してください。

## 変更時に守ること

1. 車種はメーカーを含め、確認済みの別名だけを統合する。デリカD:2／D:5／ミニ、コペン／GRなど別仕様を広い文字除去で混ぜない。一覧・候補・写真レール・URLに同じ判定を使う。
2. 色・品番・型式・適合を写真から推測しない。掲載車両情報と購入前の適合条件を区別する。商品URLが未確定なら確認用の導線を使う。
3. 感想は実際の投稿に基づく。苦労した点も含め意味を保持し、架空のレビューや評価を追加しない。メール案内等をそのまま公開しない。
4. 写真の差し替えは元URLと事例IDで照合する。順番・枚数・レビュー・初回日を保持し、情報非表示対象を旧原画像へ戻さない。
5. 補正の再生成に使う `scripts/apply-photo-corrections.py` は手元の監査資料と承認PNGに依存する。clone直後に実行する手順ではない。既存の配信用WebPはそのままビルド可能。

## 保存先・認証・本店への組み込み

共有CMSはD1 `DB`、R2 `BUCKET`、環境変数 `GALLERY_OWNER_EMAIL` とSitesが付与する認証ヘッダーを使用します。秘密値・所有者の設定値はこの資料に含めません。コードの役割はowner、editor、publisher。下書きと公開データは別で、公開変更には確認項目とrevisionの一致が必要です。

本店や別ホストへ移す場合は、認証・役割・DB・画像保存・バックアップ・メール取り込みを移植先で設計してください。共有版での実スタッフ招待・複数PCの編集運用は受け入れ確認が必要です。ブラウザーから任意の認証ヘッダーを信頼する公開サーバーは作らないでください。

新着スナップショットは共有配信にも渡せる公開情報だけです。`.preview/gallery-data/` 内のローカルCMS状態、スタッフ情報、原メール・受注CSV、元画像・承認PNG、比較レポート、配信ZIPはGitに含めていません。必要な原本資料は所有者の手元にあります。GitからCMSの非公開データやアップロード状態を復元できると扱わないでください。

## 残っている確認事項

- 取得不可の写真は3枚：P07079（CLAの2枚目）、P10045（A3スポーツバックの3枚目）、P03643（デュアリスの3枚目）。P00349・P01220・P04940・P06514は同名のWordPress元JPEGから回収済み。車種画像の福祉車両10点は元サイト404のため空値で記録し、装着写真へフォールバック。
- 旧移行保留1事例（ムーヴキャンバス・ネイビーD0488-02）。旧HP最新全件と同期済みとは説明しない。
- `seatcover.jp` への本番組み込み・既存システムとの認証／保存連携は別工程。
- 装着メール登録は月1回、所有者の依頼時に開始。メール側APIの有料拡張を前提にせず、メール情報と受注CSVで照合する。無人巡回・定期実行・自動公開は未承認。詳細はAGENTS.mdの月次運用。

## 受け入れ時に見る画面

検索条件なしの2,960件、デリカの旧別表記URLから117件、ブランド・シリーズ・色の複合絞り込み、写真の送り・戻り、装着レビュー、商品導線、スマホでの表示を確認してください。CMSは別途、所有者／編集者／公開者でログイン・保存・競合・掲載確認・公開・非公開を確認します。

既存Sitesへ更新する手順と正しいリモートはDEPLOY.mdにあります。所有者の既存checkoutでは `github` はGitHub、`origin` は現在のSites、`sites-previous` は旧Sitesです。上記の新規cloneには `github` だけが登録されます。名称を推測して上書きしたり新しいサイトを重複作成したりしないでください。
