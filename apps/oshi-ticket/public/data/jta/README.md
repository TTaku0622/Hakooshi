# 月別の宿泊傾向

出典: 観光庁「宿泊旅行統計調査」2024年・年間値（確定値）。Project LINKSとは別の補完データです。

- 案内: https://www.mlit.go.jp/kankocho/tokei_hakusyo/shukuhakutokei.html
- 原本: https://www.mlit.go.jp/kankocho/content/002026764.xlsx
- 取得日: 2026-11-07。`stays-2024.xlsx`は取得した原本を変更せず収録。
- 第8表(1月)～第8表(12月)のB8:B54: 都道府県別の総数・客室稼働率（%）。第2表の同範囲: 延べ宿泊者数（人泊）。
- `python3 scripts/import-seasonality.py`で`src/data/stay-seasonality.json`を再生成。Python標準ライブラリのみ使用。
- 欠測・秘匿値等の非数値はnull。欠測をゼロや空室として扱わない。
- 月順位は同じ県・同じ年の稼働率で比較し、同率は同順位。現在の混雑度や空室、観光地の人出は推定しない。
- 石川県は令和6年能登半島地震に伴い一部地域が調査対象外。県全域の通常年と同条件の比較ではない。
- 原データを加工して表示。利用条件は観光庁・国土交通省の公共データ利用規約に従う。
