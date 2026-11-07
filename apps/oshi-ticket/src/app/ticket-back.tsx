"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Globe2, MapPin } from "lucide-react";
import { prefectureFlagColors } from "./prefecture-colors";
import { yen, type TourismData, type TripStatus, type TripType } from "./trip-data";
import { TICKET_WIDTH } from "./boarding-ticket";

type Props = {
  ticketRef: RefObject<HTMLDivElement | null>;
  destination: string;
  color: string;
  status: TripStatus;
  tripType: TripType;
  data: TourismData | null;
  actualTotal: number | null;
  memory: string;
  error: string;
};

export function TicketBack({ ticketRef, destination, color, status, tripType, data, actualTotal, memory, error }: Props) {


  const viewportRef = useRef<HTMLDivElement>(null);


  const [scale, setScale] = useState(1);


  useEffect(() => {


    const viewport = viewportRef.current;


    if (!viewport) return;


    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / TICKET_WIDTH)));


    observer.observe(viewport);


    return () => observer.disconnect();
  }, []);


  const costs = data?.averages;


  const average = costs?.total ?? null;


  const difference = actualTotal !== null && average !== null ? actualTotal - average : null;


  const items = [
    ...(tripType === "overnight" ? [{ label: "宿泊費平均", value: costs?.accommodation ?? null }] : []),
    { label: "交通費平均", value: costs?.transportation ?? null },
    { label: "飲食費平均", value: costs?.food ?? null },
    { label: "娯楽・サービス平均", value: costs?.entertainment ?? null },
    { label: "買物平均", value: costs?.shopping ?? null },
    { label: "その他平均", value: costs?.other ?? null },
  ];



  return (
    <div className="ticketStage">


      <div className="ticketViewport" ref={viewportRef}>


        <div className="ticket ticketReverse" ref={ticketRef} style={{ transform: `scale(${scale})` }}>


          <div className="ticketPaper" style={{ backgroundImage: `linear-gradient(110deg, ${color}, ${prefectureFlagColors[destination]})` }}>


            <div className="boardingHeader reverseHeader">

              <span>

                <Globe2 size={16} /> TRAVEL NOTES / PROJECT LINKS</span>

              <strong>REVERSE SIDE</strong>

            </div>


            <div className="reverseRail">

              <MapPin size={24} />

              <span>BEFORE & AFTER YOUR JOURNEY</span>

            </div>


            <div className="reverseMain">


              <div className="reverseDestination">

                <strong>{destination}</strong>

                <span>{tripType === "daytrip" ? "日帰り旅行" : "宿泊旅行"} / {data ? `${data.year}年の統計` : "統計を取得中"}</span>

              </div>
              {data ? <>


                <div className="reverseAverage">

                  <div>

                    <span>1人・1旅行あたりの旅行消費額平均</span>

                    <strong>{yen(average)}</strong>

                  </div>

                  <small>Project LINKS<br />旅行・観光消費動向調査</small>

                </div>


                <div className="reverseCostGrid">{items.map((item) =>

                  <div key={item.label}>

                    <span>{item.label}</span>

                    <strong>{yen(item.value)}</strong>

                  </div>)}</div>


                <p className="reverseDefinition">各費目の平均は合算できません。宿泊費も1泊あたりではなく1旅行あたりです。</p>


                <div className="reverseSource">出典: 国土交通省 Project LINKS 観光統計データ（2025年度） / {data.year}年</div>
              </> : <div className="reverseLoading">{error || "目的地の参考データを読み込んでいます…"}</div>}
            </div>


            <div className="reverseStub">


              <span className={`tripBadge ${status}`}>{status === "planned" ? "遠征予定" : "遠征済み"}</span>


              <div className="reverseActual">

                <span>MY TRAVEL COST / 1人分</span>

                <strong style={{ fontSize: actualTotal !== null && actualTotal > 99999999 ? 16 : undefined }}>{status === "completed" ? actualTotal !== null ? yen(actualTotal) : "実費未入力" : "実費は遠征後に"}</strong>

              </div>
              {status === "completed" && difference !== null && <p className="reverseDifference">統計の平均との差<br />

                <strong>{difference === 0 ? "±0円" : `${difference > 0 ? "+" : "−"}${Math.abs(difference).toLocaleString("ja-JP")}円`}</strong>

              </p>}
              <p className="reverseMemory">{status === "planned" ? "この旅の思い出は、\n帰ってきてから。" : memory || "この旅を、大切な一枚に。"}</p>
              {data?.guestCount !== null && data?.guestCount !== undefined && <div className="reverseGuests">

                <span>{data.year}年の延べ宿泊者数</span>

                <strong>{(data.guestCount / 10000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万人</strong>

              </div>}
              <small>国内旅行の統計値です。<br />現在の料金や遠征の見積もりではありません。</small>


            </div>


          </div>


        </div>


      </div>


    </div>
  );
}
