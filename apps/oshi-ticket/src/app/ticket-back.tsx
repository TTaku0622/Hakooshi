"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Globe2, MapPin } from "lucide-react";
import { prefectureFlagColors } from "./prefecture-colors";
import { yen, type TourismData, type TripStatus, type TripType } from "./trip-data";
import { TICKET_WIDTH } from "./boarding-ticket";
import { dateMonth, stayFacts } from "./stay-insights";

type Props = {
  ticketRef: RefObject<HTMLDivElement | null>; destination: string; color: string; status: TripStatus;
  tripType: TripType; data: TourismData | null; actualTotal: number | null; memory: string; error: string; date: string;
};

export function TicketBack({ ticketRef, destination, color, status, tripType, data, actualTotal, memory, error, date }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / TICKET_WIDTH)));
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  const month = dateMonth(date);
  const facts = stayFacts(destination, data?.year ?? 2024, month);
  const occupancy = facts.selected?.occupancy;

  return <div className="ticketStage"><div className="ticketViewport" ref={viewportRef}>
    <div className="ticket ticketReverse" ref={ticketRef} style={{ transform: `scale(${scale})` }}>
      <div className="ticketPaper" style={{ backgroundImage: `linear-gradient(110deg, ${color}, ${prefectureFlagColors[destination]})` }}>
        <div className="boardingHeader reverseHeader"><span><Globe2 size={16} /> TRAVEL NOTES / STAY TRENDS</span><strong>REVERSE SIDE</strong></div>
        <div className="reverseRail"><MapPin size={24} /><span>KNOW YOUR DESTINATION</span></div>
        <div className="reverseMain">
          <div className="reverseDestination"><strong>{destination}</strong><span>{tripType === "daytrip" ? "日帰り旅行" : "宿泊旅行"} / 宿泊の傾向をチェック</span></div>
          <div className="reverseAverage"><div><span>{month ? `${month}月の客室稼働率` : "稼働率が最も高かった月"} / {facts.year}年の実績</span><strong>{month ? occupancy === null || occupancy === undefined ? "データなし" : `${occupancy.toFixed(1)}%` : facts.peakMonths.map((m) => `${m}月`).join("・")}</strong></div><small>観光庁<br />宿泊旅行統計調査</small></div>
          <div className="reverseMonthChart">{facts.months.map((row) => <div key={row.month} className={month === row.month ? "active" : ""}><span><i style={{ height: `${row.occupancy ?? 0}%` }} /></span><small>{row.month}</small></div>)}</div>
          <p className="reverseTrendText">{facts.rank !== null ? `この県の12か月で、高い方から${facts.rank}番目。` : "公演日を入力すると、その月の傾向を表示します。"}</p>
          <p className="reverseDefinition">県全体の過去の月平均です。現在の空室や会場周辺の混雑予測ではありません。{destination === "石川県" && " 石川県は一部地域が調査対象外。"}</p>
          <div className="reverseSource">月別：観光庁 {facts.year}年確定値 / 年次：Project LINKS 観光統計（2025年度）</div>
        </div>
        <div className="reverseStub"><span className={`tripBadge ${status}`}>{status === "planned" ? "遠征予定" : "遠征済み"}</span>
          <div className="reverseActual"><span>MY TRAVEL COST / 1人分</span><strong style={{ fontSize: actualTotal !== null && actualTotal > 99999999 ? 16 : undefined }}>{status === "completed" ? actualTotal !== null ? yen(actualTotal) : "実費未入力" : "実費は遠征後に"}</strong></div>
          <p className="reverseMemory">{status === "planned" ? "この旅の思い出は、\n帰ってきてから。" : memory || "この旅を、大切な一枚に。"}</p>
          <div className="reverseGuests"><span>Project LINKS / {data?.year ?? 2024}年の宿泊需要</span><strong>{facts.change === null ? "比較データなし" : `前年比 ${facts.change >= 0 ? "+" : "−"}${Math.abs(facts.change).toFixed(1)}%`}</strong></div>
          <small>{error || "延べ宿泊者数の変化です。総数だけでは混雑は判断できません。"}</small>
        </div>
      </div>
    </div>
  </div></div>;
}
