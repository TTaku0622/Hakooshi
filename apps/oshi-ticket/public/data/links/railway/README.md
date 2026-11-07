# 鉄道の旅客営業キロ

出典：国土交通省 Project LINKS「鉄道輸送実績・財務関連データ（2025年度）」。ユーザー提供の公式CSVを変更せず収録。

- 公式案内：https://www.mlit.go.jp/links/open-data.html
- `YEAR`の最新年2022年度、`FISCAL_YEAR_TOTAL_OPERATING_KILOMETERS_PASSENGER`（km）を使用。
- 0・欠損・非数値の旅客営業キロを除いた335件。事業者・路線単位の元の行を維持し、別路線や管轄の異なる行を合算しない。
- `CORPORATION_NAME`、`JURISDICTION`を表示しユーザーが選択。県の区間や本人の移動距離を推定しない。
- `python3 scripts/import-railway.py`で`src/data/railway.json`を生成。元CSVを加工して表示。
