# プロダクト情報

> このファイルはチームで自由に編集します（変更は PR で共有）。CLAUDE.md から読み込まれます。
> 制作物が決まったら以下を埋めてください。

- ハッカソン: Progate ハッカソン（事前開発 2026-10-31〜11-06 オンライン／本番 2026-11-07・08 11:00〜18:00 Uvance Innovation Studio）
- プロダクト名: OSHI PASSPORT（Hakooshi）
- 概要: 推しに会う遠征を見開きのパスポートとして保存。県別の月別宿泊傾向とProject LINKSの年次宿泊需要を表示し、遠征後に写真・実費・思い出を同じ記録へ追記する。
- 技術スタック: Next.js 16 / React 19 / TypeScript / CSS / html-to-image。保存先はブラウザのlocalStorage。
- セットアップ手順: `cd apps/oshi-ticket` → `npm ci`。追加パッケージ・APIキーは不要。
- 起動方法: `npm run dev`。本番確認は `npm run build` → `npm start`。
- テスト・lint の実行方法: `npm run lint` / `npx tsc --noEmit` / `npm run build` / `node scripts/check-map.mjs`。動作確認は予定保存→コレクションから写真・実費追記→更新→再読み込み、および訪問ページ・旅先ノートのPNG生成。
- アーティスト検索: `/api/artists?q=名前` からApple iTunes Search APIのmusicArtist検索。検索操作時のみ呼び出し、取得結果をキャッシュ。候補がない場合や接続失敗時も手入力できる。
- 会場検索: `/api/venues?q=会場名` → 提供された`raibu.csv`由来の7,869会場候補を検索。一致がない場合はMusicBrainzのplace検索。位置情報のある日本国内の会場候補を表示し、都道府県境界から県を設定。登録がない会場は手入力で保存可能（地図は候補選択が必要）。プロセス内で1.1秒間隔に制限し検索結果をキャッシュ。複数インスタンスで運用する場合は共有のレート制限が必要。
- 周辺観光: `/api/nearby?lat=...&lon=...` → Overpass API。会場から2km以内のOpenStreetMapの観光スポットを近い順に最大15件表示。距離は直線距離。取得失敗時は再試行可能。
- 地図表示: OpenStreetMap標準タイルをブラウザから直接取得し、表示範囲のみ描画。著作権表示と出典リンクを表示。周辺地図はパスポートPNGに含めず、会場名・位置・出典はチケット記録に保存。POI一覧は保存せず、記録を開くと再取得。旧チケットも従来どおり開ける。追加ライブラリ・キーは不要。
- 推しカラー: 26色のプリセット＋自由なカラーピッカー＋6桁HEX入力。選んだ推し色と県旗色のグラデーションを訪問ページ・旅先ノートと保存画像に反映。
- 宿泊傾向: 観光庁2024年確定値の月別客室稼働率を47県×12月収録。公演月の値・県内12月での順位を表示。県全体の過去の月平均で、現在の空室・会場周辺や観光地の人出の予測ではない。石川県は能登半島地震に伴う調査対象地域の制限を注記。月別データはProject LINKSではなく観光庁が出典。
- 観光統計: `/api/tourism?prefecture=大阪府&type=daytrip&year=2024`。`type` は `daytrip` または `overnight`。配布CSVを取り込んだデータから返す。現在価格のリアルタイム取得ではない。
- 統計の扱い: 画面と裏面は年次の延べ宿泊者数の増減と月別稼働率を中心に表示。旧版の費用フィールドと内部APIは互換性のため維持するが、平均費用や実費との差は画面に表示しない。空欄とゼロ、比較元のない年を区別。保存時の統計年を保持する。
- ディレクトリ構成: `src/app/page.tsx`（認証チェック）、`TicketApp.tsx`（予定・記録・コレクション）、`passport-spread.tsx`（訪問ページ）、`passport-notes.tsx`（旅先ノート）、`passport-progress.tsx`（47県スタンプ）、`artist-search.tsx`、`trip-data.ts`、`api/`、`src/data/links-tourism.json`（加工データ）、`public/data/links/`（元CSV・出典）。

## 利用するデータ

- 国土交通省 Project LINKS「観光統計データ（2025年度）」: https://www.geospatial.jp/ckan/dataset/links_kankoutoukei_2025
- 対象は2021〜2024年。表示には都道府県別の延べ宿泊者数を使用。費用データも内部APIには保持。
- 詳細な出典・加工方法: `apps/oshi-ticket/public/data/links/README.md`
- 旗の配色は表示用の近似色。白地の旗には紋章の有彩色を採用する。

## 地図の検証と利用条件

- 座標変換・都道府県判定・スポットの距離順／範囲／重複除外: `node scripts/check-map.mjs`（`apps/oshi-ticket`で実行）。
- MusicBrainz: https://musicbrainz.org/doc/MusicBrainz_API 。商用利用へ移行する場合は利用条件を確認する。
- Overpass公開インスタンス（VK Maps）: https://maps.mail.ru/osm/tools/overpass/ 。送信するのは選択会場の公開座標のみ。
- OpenStreetMap: https://www.openstreetmap.org/copyright / https://operations.osmfoundation.org/policies/tiles/ 。地図の事前一括取得・オフライン保存は行わない。
- アーティスト・会場・観光スポットのAPIと、Project LINKSの旅行費用統計は別のデータソース。統計CSVは`public/data/links/`、加工データは`src/data/links-tourism.json`。

- 月別データの出典・加工方法: `apps/oshi-ticket/public/data/jta/README.md`。年次Project LINKSと混同しない。
- 会場CSVの取り込み: `python3 scripts/import-venues.py`。候補であり、ライブ対応・収容人数・開催予定を保証しない。

- 観光検索失敗時は、提供CSVのtheatre / arts_centreから2km内の文化施設を代替表示（会場とほぼ同位置の30m以内は除外）。代替である旨・出典・再検索ボタンを明示し、観光POI取得成功と区別。

## パスポートのデータ活用

- 訪問ページ: 800×520の見開き。推し・公演・会場・公演日・訪問スタンプ・写真・思い出を保存。推し色と県旗色を装丁のグラデーションに反映。既存の記録・localStorageキーを継続し、旧チケットも表示・編集できる。
- 47都道府県の訪問スタンプ: 遠征済みの記録がある県だけ取得。同じ県への再訪は県数に重複計上しない。予定の県は訪問済みにしない。
- 都道府県別観光統計・宿泊旅行統計: Project LINKSの県別延べ宿泊者数を旅先ノートに記録。月別稼働率は観光庁から補完し、観光スポットはOpenStreetMapから取得。出典を区別する。
- 宿泊施設: `/api/lodgings?lat=...&lon=...`。位置情報のある会場から3km以内のホテル等をOSM / Overpass APIから近い順に最大8件。操作時のみ取得。LINKSの公開観光CSVにホテル名・住所の一覧は含まれないため補完出典を明示。空室・料金を保証しない。
- 鉄道: `03_tetsudou_eigyoukiro.csv`の2022年度・旅客営業キロを使用。利用した事業者・路線をユーザーが選び旅先ノートに表示。事業者・路線全体の数字で、県内区間長や今回の乗車距離ではない。重複事業者や路線別行を勝手に合算しない。
- フェリー: LINKSの2024年度公開資料を取得し、起終点の地方ごとに申請サンプル件数を集計（元106件、起終点のある97件）。船名・事業者・港名の復元を試みない。全航路の一覧や現在の運航状況ではない。船旅スタンプはユーザーの自己申告で、公開データによる乗船認証ではない。予定時は予定スタンプ。
- データ加工: `python3 scripts/import-railway.py` / `python3 scripts/import-ferry.py`。Python標準ライブラリのみ。出典は`public/data/links/railway/README.md`と`public/data/links/ferry/README.md`。
- 最新ブランチをgit pullで取り込み、パスポートのクライアント画面を`TicketApp.tsx`へ統合。既存の`getCurrentUser`によるページ認証、ユーザー名表示、ログアウト処理を保持。ログインフォームは表示名のみOSHI PASSPORTへ変更。
