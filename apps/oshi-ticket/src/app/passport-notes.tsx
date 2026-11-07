"use client";

import { type RefObject } from "react";
import { Globe2, Ship } from "lucide-react";
import { PassportFrame, TravelIcon, travelModeNames, type TravelMode } from "./passport-spread";
import { dateMonth, stayFacts } from "./stay-insights";
import { ferryFacts, type RailwayFact } from "./travel-data";
import { yen, type TourismData, type TripStatus } from "./trip-data";

export type PassportNotesProps = {
  destination: string; color: string; date: string; status: TripStatus; data: TourismData | null;
  actualTotal: number | null; memory: string; travelMode: TravelMode; railway?: RailwayFact; ferryRoute: string;
};

// 03・04 ページの見開き（PNG 保存用）
export function PassportNotes({ pageRef, ...props }: PassportNotesProps & { pageRef: RefObject<HTMLDivElement | null> }) {
  return <PassportFrame pageRef={pageRef} color={props.color} destination={props.destination}>
    <DestinationNotesPage {...props} />
    <MyJourneyPage {...props} />
  </PassportFrame>;
}

// 03 ページ：旅先の宿泊データ
export function DestinationNotesPage({ destination, date, data }: PassportNotesProps) {
  const facts = stayFacts(destination, data?.year ?? 2024, dateMonth(date));
  return <div className="passportPage passportDataPage">
      <div className="passportPageHeading"><span>DESTINATION NOTES / 旅先の横顔</span><b>03</b></div>
      <h2><Globe2 size={20} />{destination}</h2>
      <div className="passportGuestCount"><span>{data?.year ?? "—"}年の延べ宿泊者数</span><strong>{data?.guestCount === null || data?.guestCount === undefined ? "データなし" : `${(data.guestCount / 10000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万`}</strong><small>人泊 / 同じ人の連泊・再訪を含む</small></div>
      <p className="passportDataSource">出典：Project LINKS 観光統計データ（2025年度）を加工</p>
      <div className="passportStayFact"><span>{facts.year}年の月別客室稼働率</span><div className="passportMonthChart">{facts.months.map((row) => <div key={row.month} className={dateMonth(date) === row.month ? "active" : ""}><span><i style={{ height: `${row.occupancy ?? 0}%` }} /></span><small>{row.month}</small></div>)}</div><b>{facts.selected ? `${facts.selected.month}月：${facts.selected.occupancy === null ? "データなし" : `${facts.selected.occupancy.toFixed(1)}%`}` : `最も高かった月：${facts.peakMonths.map((m) => `${m}月`).join("・")}`}</b></div>
      <p className="passportDataSource">出典：観光庁 宿泊旅行統計調査・{facts.year}年確定値。県全体の過去の月平均で、現在の空室や会場の混雑予測ではありません。{destination === "石川県" && "石川県は一部地域が調査対象外。"}</p>
      <div className="passportPageFoot"><span>KNOW A LITTLE MORE, TRAVEL A LITTLE DEEPER.</span><span>03</span></div>
    </div>;
}

// 04 ページ：交通手段と実費の記録
export function MyJourneyPage({ destination, status, actualTotal, memory, travelMode, railway, ferryRoute }: PassportNotesProps) {
  const sea = ferryFacts(destination);
  return <div className="passportPage passportDataPage">
      <div className="passportPageHeading"><span>MY JOURNEY / 私の旅の記録</span><b>04</b></div>
      <div className="passportTransportTitle"><TravelIcon mode={travelMode} size={25} /><h2>{travelModeNames[travelMode]}で会いに行く</h2></div>
      {travelMode === "train" && railway ? <div className="passportTransportFact"><strong>{railway.name}</strong><span>{railway.year}年度の旅客営業キロ</span><b>{railway.kilometers.toLocaleString("ja-JP")} km</b><small>事業者・路線全体の統計です。今回の乗車距離ではありません。出典：Project LINKS 鉄道輸送実績・財務関連データ（2025年度）</small></div> : travelMode === "ferry" ? <div className="passportTransportFact"><strong>{ferryRoute || "海を渡る、特別な遠征。"}</strong><span>{sea.region}を起終点に含む航路の申請サンプル</span><b>{sea.samples} 件</b><small>Project LINKS 一般旅客定期航路事業データ（2024年度）。2007〜2024年度の匿名化された標本で、現在の航路数ではありません。</small></div> : <p className="passportTravelPrompt">移動の時間も、大切な旅の一部。利用した交通手段を記録しよう。</p>}
      <div className="passportOwnCost"><span>MY TRAVEL COST / 実際にかかった費用</span><strong>{status === "planned" ? "遠征後に記録" : actualTotal === null ? "未入力" : yen(actualTotal)}</strong><small>1人分の実費</small></div>
      <p className="passportNotesMemory">{status === "planned" ? "この旅で出会う景色を、帰ってきたら書き留めよう。" : memory || "忘れたくない瞬間を、このページに。"}</p>
      {travelMode === "ferry" && <div className="passportSeaNote"><Ship size={17} />船旅スタンプは利用者の記録に基づきます。</div>}
      <div className="passportPageFoot"><span>COLLECT MOMENTS, NOT JUST MILES.</span><span>04</span></div>
    </div>;
}
