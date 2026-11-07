# 会場候補CSV

ユーザー提供の`raibu.csv`を変更せず収録。OSM識別子・座標を含む施設データ（ヘッダーを除く28,629行、途中に重複ヘッダー1行あり）。取得日・抽出条件は元ファイルに記載なし。

- 原データの提供元: ユーザー。施設の地理情報: © OpenStreetMap contributors。
- 出典とライセンス: https://www.openstreetmap.org/copyright （ODbL）
- `python3 scripts/import-venues.py`で会場候補7,869件の`src/data/venues.json`を生成。
- theatre / music_venue / events_venue / arts_centre / conference_centre / community_centre、またはstadium / sports_hall / sports_centre等の施設種別から抽出。
- OSM ID・名称・有効な座標を持ち、既存の都道府県境界内にある候補のみ。駐輪場・福祉施設などの無関係な種別と重複ヘッダーは除外。境界外の施設は検索対象外となる場合あり。
- 座標から都道府県を付与。日本語名・別名で検索可能。外部APIキー不要。
- ライブ開催対応・営業状況・収容人数は保証しない。観光スポットのデータとしては使わない。
- 候補選択後も出典のOSM施設ページへリンクし、OpenStreetMapのクレジットを表示。
