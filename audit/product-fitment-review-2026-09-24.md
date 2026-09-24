# 商品リンク・車種適合の監査

確認日：2026年9月24日

## 確認範囲

- 保存カタログ2,895件と、各詳細JSONの直接商品URL・型式・品番を全件集計。
- 直接商品URLは2,670件、重複を除くと987 URL。記録されたURLはすべて `seatcover.jp` ドメイン。
- 225件は事例単位の直接商品URLを持たず、118件はシリーズ一覧、107件は車種別一覧へ案内する構造。リンク先ページがあることと、個別商品が選べることは異なる。
- 987 URLすべてに対するリアルタイムHTTP応答・商品在庫の一括確認は未実施。公式ページの内容まで個別に照合したのは、今回の不一致に関係する商品と適合表。

## 確定した不一致

デリカD:5として掲載された次の4事例で、写真情報だけがデリカD:2・品番 `S0116-11` になっていた。公式D:2適合表では `S0116-11` は型式 `MB36S / MB46S / MB37S`、定員5名のD:2向け。公式D:5商品ページは `MI0164` 系の品番を掲載している。したがって、4事例のD:2型式・品番は誤り。

| Case ID | 掲載シリーズ | 写真数 | 判定 |
| --- | --- | ---: | --- |
| `ed4a78adcd33` | Refinad Leather Deluxe | 5 | 見出し・写真説明・商品リンクはD:5。`sourceFile` と `galleryUrl` の参照先名は `mitsubishi_delicad2.html` のため、元ページの所在も要注意。 |
| `5878a8425126` | Sandii デニムサンド | 5 | 写真説明・商品リンクはD:5。 |
| `eda85e0268de` | Sandii エクレア | 3 | 写真説明・商品リンク・掲載レビューはD:5。 |
| `521f4e240f04` | Sandii ワッフル | 4 | 写真説明はD:5。個別商品リンクは公式の現行D:5商品URLへ更新。 |

公式D:5適合表には年式、型式、定員、グレード、運転席の手動／電動など複数の区分があり、写真だけから該当品番を一意に決められない。誤ったD:2情報は4件とも詳細表示から除去し、正確なD:5品番を推測で補っていない。購入時は各商品ページの適合表で確認が必要。

## 商品ページと在庫の見分け

- [Refinad Leather Deluxe・デリカD:5](https://seatcover.jp/c/seatcovermaker/refinad/refinad-leatherdx/refinad-dx00164)：D:5の商品名・品番 `refinad-dx00164`、価格、`MI0164-01`〜`MI0164-14` の選択欄、カート操作を確認。
- [Sandii デニムサンド・デリカD:5](https://seatcover.jp/c/seatcovermaker/sandii/denimsand/sandii-ds00164)：D:5の商品名・商品番号・価格、品番／色の選択欄、カート操作を確認。
- [Sandii エクレア・デリカD:5](https://seatcover.jp/c/seatcovermaker/sandii/sandii-eclair/sandii-ec00164)：D:5の商品名・商品番号・価格、品番／色の選択欄、カート操作を確認。
- ワッフルの保存URLは `.../seatcovermaker/sandii/sandii-waffle/sandii-wf00164`。取得時にページ内容を確認できなかった。公式D:5カテゴリにワッフルの掲載があり、現行商品として見つかった[デリカD:5用ワッフルページ](https://seatcover.jp/c/mitsubishi/delicad5/sandii-wf00164)へ、カタログの直接リンクを更新。

商品ページに価格・選択欄・カート操作があることは、ページが掲載され注文操作を開始できる状態を示すだけで、実在庫や納期を保証しない。カート投入・注文は実行していない。公式ページには受注生産・納期の案内もあり、即納在庫とは区別する。

## 適合欄のカタログ全体の状態

- 1,576件に型式と品番の両方がある。
- 1,019件は品番のみ、300件は型式・品番ともにない。
- 年式・グレードを独立して記録する欄はない。品番が記録されているだけでも、掲載写真の車両へ現行商品の適合を断定できない。
- 監査スクリプトは従来、車種候補をギャラリー掲載車種だけから作っていたため、カタログに車種分類のない「デリカD:2」をD:5との不一致候補として認識できなかった。D:2を照合語彙に加え、同種の見落としを検出するよう修正。

## 変更と検証

- 4事例から誤ったD:2型式・品番を除去。正しい品番は車両の詳細が不足しているため記載なし。
- ワッフルの直接リンクを公式D:5商品ページへ更新。車種別カテゴリへの共通リンクは変更していない。
- `scripts/build-data.py` を更新し、元データから再生成しても補正が維持されるようにした。
- `scripts/audit-data-integrity.py` を更新。再生成後は2,895事例、10,096画像、写真情報と掲載車種の衝突0件。

## 根拠資料

- [公式デリカD:2適合表：S0116-11、MB36S／MB46S／MB37S](https://seatcover.jp/c/mitsubishi/delicad2/refinad-ol00163)
- [公式デリカD:5適合表・車種別商品一覧](https://seatcover.jp/c/mitsubishi/delicad5)
- [公式Refinad Leather Deluxe・デリカD:5](https://seatcover.jp/c/seatcovermaker/refinad/refinad-leatherdx/refinad-dx00164)
- [公式Sandii デニムサンド・デリカD:5](https://seatcover.jp/c/seatcovermaker/sandii/denimsand/sandii-ds00164)
- [公式Sandii エクレア・デリカD:5](https://seatcover.jp/c/seatcovermaker/sandii/sandii-eclair/sandii-ec00164)
- [公式Sandii ワッフル・デリカD:5](https://seatcover.jp/c/mitsubishi/delicad5/sandii-wf00164)
