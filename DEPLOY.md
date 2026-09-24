# 装着ギャラリーのデプロイ

このディレクトリは装着ギャラリー専用のGitリポジトリ。SitesのプロジェクトIDは `.openai/hosting.json` を使う。

- URL: https://carshop-connect-gallery-renewal.masaruharuyama.chatgpt.site/
- SP・PC比較: https://carshop-connect-gallery-renewal.masaruharuyama.chatgpt.site/preview.html
- ローカル: http://127.0.0.1:4180/preview.html
- Gitの送信先ブランチ: `main`
- 閲覧範囲: 公開（ログイン不要）。2026-09-15の「URL知っている人全員が見れるように」の明示依頼による。検索エンジン向けnoindexは維持する。

2026-09-24の「新規でPUSH」により、新しいSitesプロジェクトへ移行。現在のIDは `.openai/hosting.json`、Push先は `origin` を正とする。旧プロジェクト `appgprj_6aa8facb7dec8191917e02752c5d2d51` と旧URL https://carshop-connect-gallery.connect369.chatgpt.site/ は履歴として残し、以後の公開先には使わない。旧リモートは `sites-previous` として保持する。新規登録時の作業コピーは `gallery-publish`、通常の編集・4180プレビューは `gallery-next` を使用する。

## 手順

1. `npm run check` と `npm test` を通す。
2. 対象差分を確認してコミットし、Sitesが発行する短期Git資格情報で `HEAD:main` をPUSHする。トークンを設定ファイルやログに保存しない。
3. PUSH成功後に `git rev-parse --verify HEAD` を実行し、完全なSHAを記録する。
4. そのソース状態で `npm run build` を実行する。
5. `.deploy` を作成し、`tar -czf .deploy/site.tar.gz .openai/hosting.json dist/client` で設定と出力だけを梱包し、内容を検証する。
6. Sitesのsave_site_versionへプロジェクトID・完全SHA・アーカイブの絶対パスを渡す。
7. 現在の閲覧範囲を維持して保存版をデプロイし、成功状態・HTTP・実画面を確認する。

`dist/client` は公開用静的ファイル。配信設定の `.openai/hosting.json` と一緒に梱包する。ローカルの旧版比較ページは配信対象外。ヘッダー・フッターのリンクは現行seatcover.jpへ統一。最下部の制作比較リンクだけSP・PC比較へビルド時に置換する。ローカル画面には旧版比較リンクを残す。

2,895件は保存資料に由来するデータで、本番の最新データ全件との同期ではない。本番 `seatcover.jp` への手動アップロードとは別の確認サイト。ローカルの4180サーバーは終了しない。
