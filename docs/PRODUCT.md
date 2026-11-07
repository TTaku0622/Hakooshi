# プロダクト情報

> このファイルはチームで自由に編集します（変更は PR で共有）。CLAUDE.md から読み込まれます。
> 制作物が決まったら以下を埋めてください。

- ハッカソン: Progate ハッカソン（事前開発 2026-10-31〜11-06 オンライン／本番 2026-11-07・08 11:00〜18:00 Uvance Innovation Studio）
- プロダクト名: OSHI JOURNEY（Hakooshi）
- 概要: 推しに会う遠征の予定を搭乗券風チケットとして保存。目的地・日帰り／宿泊・統計年からProject LINKSの参考費用を裏面に表示し、遠征後に写真・実費・思い出を同じ記録へ追記する。
- 技術スタック: Next.js 16 / React 19 / TypeScript / CSS / html-to-image。保存先はブラウザのlocalStorage。
- セットアップ手順: `cd apps/oshi-ticket` → `npm ci`。追加パッケージ・APIキーは不要。
- 起動方法: `npm run dev`。本番確認は `npm run build` → `npm start`。
- テスト・lint の実行方法: `npm run lint` / `npx tsc --noEmit` / `npm run build`。動作確認は予定保存→コレクションから写真・実費追記→更新→再読み込み、および表裏PNG生成。
- アーティスト検索: `/api/artists?q=名前` からApple iTunes Search APIのmusicArtist検索。検索操作時のみ呼び出し、取得結果をキャッシュ。候補がない場合や接続失敗時も手入力できる。
- 観光統計: `/api/tourism?prefecture=大阪府&type=daytrip&year=2024`。`type` は `daytrip` または `overnight`。配布CSVを取り込んだデータから返す。現在価格のリアルタイム取得ではない。
- 統計の扱い: 元の万円／人を円に変換。総額は元データの合計旅行消費平均を使用し、費目別平均を合算しない。宿泊費も1人・1旅行あたりで1泊単価ではない。空欄とゼロを区別。保存時の参考値・統計年を記録に保持する。
- ディレクトリ構成: `src/app/page.tsx`（予定・記録・コレクション）、`boarding-ticket.tsx`（表面）、`ticket-back.tsx`（裏面）、`artist-search.tsx`、`trip-data.ts`、`api/`、`src/data/links-tourism.json`（加工データ）、`public/data/links/`（元CSV・出典）。

## 利用するデータ

- 国土交通省 Project LINKS「観光統計データ（2025年度）」: https://www.geospatial.jp/ckan/dataset/links_kankoutoukei_2025
- 対象は2021〜2024年。日帰り・宿泊旅行の平均費用と、都道府県別の延べ宿泊者数を使用。
- 詳細な出典・加工方法: `apps/oshi-ticket/public/data/links/README.md`
- 旗の配色は表示用の近似色。白地の旗には紋章の有彩色を採用する。
