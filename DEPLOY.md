# 装着ギャラリーの保存・共有公開

更新日：2026-10-09。静的ファイルだけを梱包する以前の手順は使用しないでください。現在はD1／R2を使うWorker構成です。プログラマー向けの入口は [PROGRAMMER_HANDOFF.md](PROGRAMMER_HANDOFF.md)。

## 現在の接続先

- 共有URL： https://carshop-connect-gallery-renewal.masaruharuyama.chatgpt.site/
- 公開project_id：`.openai/hosting.json` の `appgprj_6ab4e198f3d48191ad6dc8d6d43b2009`
- 閲覧範囲：public／ログイン不要。noindexは維持。
- 通常の編集・ビルド・今回の公開元：この `gallery-next` リポジトリ。`gallery-publish` は以前の公開コピー。
- ローカル： http://127.0.0.1:4180/ 。Windowsは `scripts/start-preview.ps1` で起動。

| remote | 接続先 | 送信先 |
| --- | --- | --- |
| `github` | `https://github.com/carshopconnect1-sketch/carshop-connect-gallery.git` | `main`。プログラマーへ渡す保存先 |
| `origin` | `https://git.chatgpt-team.site/796e203e-d5f6-42e8-a83d-a5f9736c204e/appgprj_6ab4e198f3d48191ad6dc8d6d43b2009.git` | `main`。現在のSitesソース保存先 |
| `sites-previous` | 旧Sites `appgprj_6aa8facb7dec8191917e02752c5d2d51` | 履歴。今後のPUSH／公開先に使わない |

`origin` をGitHubだと判断して上書きしないでください。GitHubへのPUSHでSitesや本店 `seatcover.jp` が自動更新される設定はありません。既存Siteを更新し、新しいproject_idを作らないでください。

## GitHubへのコミット・PUSH

```powershell
git status --short
git fetch --no-tags github main
git rev-list --left-right --count github/main...HEAD
git diff --check
npm run check
npm test
```

依頼対象のファイルを指定してstage／commitし、`git push github HEAD:main`。force pushは使用しません。完了後に `git ls-remote github refs/heads/main` とローカルの `git rev-parse HEAD` が一致することを確認します。元の作業ブランチ名を変更する必要はありません。

`.preview/`、`.source/`、`.deploy/`、`.env*`、`node_modules/` は除外済み。非公開メール、受注CSV、CMSの実DB、スタッフ情報、認証情報をstageしないでください。配信用WebPと公開スナップショットは追跡対象です。

## Sitesへの更新

1. `.openai/hosting.json` と現在のremote・ブランチ・作業差分を確認し、対象Siteの現在の所有権／閲覧範囲を照合する。公開範囲を維持する。
2. Sitesの短期Git資格情報とsource helperで既存ソースを開く。現在の編集元が同じ履歴に属することを確認する。秘密値はセッション内で保持してstdinだけで渡し、ファイル／引数／ログへ保存しない。
3. 対象ソースのチェック・テストを行い、source helperでcommit／`HEAD:main`のPUSHを完了させる。PUSHした完全SHAを保持する。
4. そのソースから `npm run build`。編集後は再ビルドする。出力は `dist/client/`、`dist/server/index.js`、`dist/.openai/hosting.json`、マイグレーション。
5. source helperで配信出力だけを梱包する。Windowsで公式梱包処理を起動できない場合に限り、下の検証済み代替を使う。commit／PUSHと配信出力の対応は維持する。
6. `save_site_version` に既存project_id、PUSH済み完全SHA、そのソースから作ったアーカイブの絶対パスを渡す。保存成功までアーカイブを変更しない。
7. 保存された版の正確なIDで、既存public範囲のまま `deploy_site_version`。pending／building／publishingなら同じdeploymentの状態を確認し、成功まで追う。
8. 公開URLで件数・詳細・画像・必要な操作を確認し、配信版・ソースSHA・deployment・日時を保存する。

### Windowsの梱包代替

プロジェクト直下から実行：

```powershell
npm run build
pwsh -NoProfile -File scripts/package-site.ps1
```

標準Windows `tar.exe` を使用し、`dist` を唯一のトップディレクトリとして梱包します。必須ファイル、既存Site ID／保存バインディング、元URLを含む照合用JSONの除外、圧縮後・展開後の両方の256MiB上限を検証します。SQLは `dist/.openai/drizzle/` にも収録します。

出力は `.deploy/site-<完全SHA>.tar.gz` と `.json` の配信控え。既存アーカイブは上書きせず、必要なら `-ArchivePath .deploy/別名.tar.gz` を指定します。ローカル専用資料やソース一式、依存ライブラリを配信tarへ入れません。

`dist/client/` だけでは共有CMSと公開APIは配信できません。`.openai/hosting.json` のD1 `DB`、R2 `BUCKET`を維持し、共有CMSの所有者設定 `GALLERY_OWNER_EMAIL` と信頼できるログイン環境も別途確認してください。

## 現在の共有版

version13／公開source `c15729bf04686a29f4b310d3d9d46769bb7a90e2`、deployment `appgdep_6ac87accea008191abe9f45ddd8f836b` は2026-10-09 05:27 UTCにsucceeded。2,960事例、補正1,458枚／988事例、新着64事例を配信済み。公開ソースの後続に引き継ぎ資料のコミットがあります。GitHub保存用の最新SHAと公開中のソースSHAを混同しないでください。

今回の既存プレビュー4180と写真比較4183は返答後も停止しません。共有サイトは本店の最新全件同期ではなく、取得不可7写真・旧移行保留1事例が残ります。詳細はPROGRAMMER_HANDOFF.md、CHECKPOINT.md、audit/photo-replacement-2026-10-09.mdを参照してください。
