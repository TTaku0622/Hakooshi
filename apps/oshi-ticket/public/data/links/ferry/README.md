# 地方単位のフェリー・旅客船データ

出典：国土交通省 Project LINKS「一般旅客定期航路事業データ（2024年度）」

- データ：https://www.geospatial.jp/ckan/dataset/links-ippanryokyakuteikikourojigyou-2024
- リソースID：bf008fa9-9bb1-4471-bbf4-1b2050b7346d
- 取得日：2026-11-07。公式メタデータのダウンロードファイル名にはホスト名の重複があり、`/download/01_ippanryokyakuteikikourojigyoukyokashinseisyo.csv`で取得。
- 仕様書：同データセットの`99_データ仕様書`。2007〜2024年度の全国サンプル。企業名・船名はID化、起終点は地方単位へ匿名化されている。
- 元106件。起点`Starting_Point_Area`と終点`End_Point_Area`の両方を持つ97件を地方ペアごとに集計。件数は申請の収録サンプルで、実在する航路の全数や現在の運航航路数ではない。
- 企業名・船名・港名を復元しない。本人の乗船・目的地県への到着を推定しない。
- UI上の船旅スタンプはユーザーによる利用記録。地方の参考情報と乗船記録を区別する。
- `python3 scripts/import-ferry.py`で匿名の地域集計`src/data/ferry.json`を再生成。
- 元データを加工。利用条件：https://www.mlit.go.jp/links/terms-of-use.html
