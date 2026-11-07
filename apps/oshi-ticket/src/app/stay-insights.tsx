"use client";

import { useState } from "react";
import monthly from "../data/stay-seasonality.json";
import annual from "../data/links-tourism.json";
import { prefectures } from "./trip-data";

export function dateMonth(date: string) {
  const month = Number(/^\d{4}-(\d{2})-\d{2}$/.exec(date)?.[1]);
  return month >= 1 && month <= 12 ? month : null;
}

export function stayFacts(prefecture: string, year: number, month: number | null) {
  const code = prefectures.indexOf(prefecture) + 1;
  const months = monthly.records.find((r) => r.prefectureCode === code)?.months ?? [];
  const selected = months.find((r) => r.month === month) ?? null;
  const ranked = months.filter((r) => r.occupancy !== null).sort((a, b) => b.occupancy! - a.occupancy!);
  const rank = selected?.occupancy !== null && selected?.occupancy !== undefined ? 1 + ranked.filter((r) => r.occupancy! > selected.occupancy!).length : null;
  const history = annual.guestCounts.filter((r) => r.prefectureCode === code && r.year <= year).sort((a, b) => a.year - b.year);
  const current = history.find((r) => r.year === year)?.total ?? null;
  const previous = history.find((r) => r.year === year - 1)?.total ?? null;
  const change = current !== null && previous !== null && previous > 0 ? (current / previous - 1) * 100 : null;
  return { months, selected, rank, peakMonths: ranked.filter((r) => r.occupancy === ranked[0]?.occupancy).map((r) => r.month), history, change, year: monthly.year, sourceUrl: monthly.sourceUrl };
}

export function StayInsights({ prefecture, date, year }: { prefecture: string; date: string; year: number }) {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(dateMonth(date));
  const facts = stayFacts(prefecture, year, selectedMonth);
  return <section className="stayInsights" aria-label="宿泊の混雑傾向の参考情報">
    <span className="insightEyebrow">PLAN YOUR STAY</span><h2>宿を探す前に、旅先の傾向を。</h2>
    <p className="insightLead">{prefecture}の月別客室稼働率 <small>{facts.year}年・過去の実績</small></p>
    <div className="occupancyChart" role="group" aria-label="客室稼働率を見る月を選択">{facts.months.map((row) => <button type="button" key={row.month} aria-label={`${row.month}月 客室稼働率 ${row.occupancy === null ? "データなし" : `${row.occupancy}%`}`} aria-pressed={row.month === selectedMonth} onClick={() => setSelectedMonth(row.month)}>
      <span className="occupancyBarTrack"><i style={{ height: `${row.occupancy ?? 0}%` }} /></span><small>{row.month}月</small>
    </button>)}</div>
    {facts.selected ? <div className="occupancyDetail" aria-live="polite"><span>{selectedMonth}月の客室稼働率</span><strong>{facts.selected.occupancy === null ? "データなし" : `${facts.selected.occupancy.toFixed(1)}%`}</strong><p>{facts.rank !== null ? `この県の12か月で、高い方から${facts.rank}番目。` : "この月の値は収録されていません。"}{facts.rank !== null && facts.rank <= 3 ? "宿泊を予定するなら、会場へのアクセスと宿の候補を早めに確認しよう。" : "ライブ開催日は県全体の傾向と異なることもあるので、会場周辺の空室を確認しよう。"}</p></div> : <p className="insightPrompt">月をタップすると詳しく見られます。公演日を入力すると、その月を最初に表示します。</p>}
    <p className="insightPeak">稼働率が最も高かった月：{facts.peakMonths.length ? facts.peakMonths.map((m) => `${m}月`).join("・") : "データなし"}</p>
    {prefecture === "石川県" && <p className="insightCaution">2024年の石川県は能登半島地震の影響で一部地域が調査対象外です。県全域を同じ条件で比較できません。</p>}
    <p className="insightSource"><a href={facts.sourceUrl} target="_blank" rel="noreferrer">出典：観光庁 宿泊旅行統計調査（{facts.year}年・確定値）</a><br />客室稼働率＝利用客室数 ÷ 総客室数。県全体の月平均です。現在の空室・会場周辺の混雑・観光地の人出を表すものではありません。</p>
    <div className="linksDemand"><span className="insightEyebrow">PROJECT LINKS · 宿泊需要の変化</span><p>{year}年の延べ宿泊者数は、{facts.change === null ? "前年との比較データがありません。" : `${year - 1}年より${Math.abs(facts.change).toFixed(1)}%${facts.change > 0 ? "増加" : facts.change < 0 ? "減少" : "で同水準"}。`}</p>
      <div className="demandHistory">{facts.history.map((r) => <div key={r.year}><small>{r.year}</small><span style={{ width: `${Math.max(0, (r.total ?? 0) / Math.max(...facts.history.map((h) => h.total ?? 0), 1) * 100)}%` }} /><b>{r.total === null ? "—" : `${(r.total / 10000).toLocaleString("ja-JP", { maximumFractionDigits: 0 })}万`}</b></div>)}</div>
      <small>延べ宿泊者数（人泊）。同じ人の連泊・再訪も含みます。総数の増減だけでは混雑度は判断できません。</small><a href={annual.sourceUrl} target="_blank" rel="noreferrer">出典：Project LINKS 観光統計データ（2025年度）を加工</a>
    </div>
  </section>;
}
