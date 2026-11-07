"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Globe2, MapPin, Plane, Ship, TrainFront } from "lucide-react";
import { prefectureFlagColors } from "./prefecture-colors";
import type { TripStatus } from "./trip-data";

export const PASSPORT_WIDTH = 800;
export const PASSPORT_HEIGHT = 520;
export type TravelMode = "train" | "ferry" | "plane" | "other";
export const travelModeNames: Record<TravelMode, string> = { train: "鉄道", ferry: "船・フェリー", plane: "飛行機", other: "その他" };

export function PassportFrame({ pageRef, color, destination, children }: {
  pageRef: RefObject<HTMLDivElement | null>; color: string; destination: string; children: ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / PASSPORT_WIDTH)));
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  return <div className="passportStage"><div className="passportViewport" ref={viewportRef}>
    <div className="passportSheet" ref={pageRef} style={{ transform: `scale(${scale})`, "--oshi": color, "--prefecture": prefectureFlagColors[destination] } as CSSProperties}>
      <div className="passportBook">{children}<div className="passportSpine" aria-hidden="true" /></div>
    </div>
  </div></div>;
}

export function TravelIcon({ mode, size = 16 }: { mode: TravelMode; size?: number }) {
  return mode === "ferry" ? <Ship size={size} /> : mode === "train" ? <TrainFront size={size} /> : mode === "plane" ? <Plane size={size} /> : <MapPin size={size} />;
}

export function PassportSpread({ pageRef, origin, destination, oshi, event, date, memory, photo, color, seed, destinationPath, status, venueName, travelMode, ferryName }: {
  pageRef: RefObject<HTMLDivElement | null>; origin: string; destination: string; oshi: string; event: string; date: string;
  memory: string; photo: string; color: string; seed: number; destinationPath: string; status: TripStatus; venueName?: string; travelMode: TravelMode; ferryName?: string;
}) {
  return <PassportFrame pageRef={pageRef} color={color} destination={destination}>
    <div className="passportPage passportIdentity">
      <div className="passportBrand"><Globe2 size={23} /><span>OSHI PASSPORT<small>推し旅パスポート</small></span></div>
      <p className="passportKicker">EVERY JOURNEY BRINGS ME CLOSER TO YOU.</p>
      <div className="passportField passportArtist"><span>ARTIST / OSHI · 推しの名前</span><strong>{oshi || "推しの名前を入れてね"}</strong></div>
      <div className="passportField"><span>PURPOSE OF VISIT · イベント</span><strong>{event || "次のライブをここに"}</strong></div>
      <div className="passportRoute"><div><span>FROM</span><strong>{origin}</strong></div><TravelIcon mode={travelMode} size={22} /><div><span>TO</span><strong>{destination}</strong></div></div>
      <div className="passportField"><span>DATE OF JOURNEY · 公演日</span><strong>{date ? date.replaceAll("-", ".") : "日付を選択"}</strong></div>
      <div className="passportField passportVenue"><span>VENUE · 会場</span><strong>{venueName || "会場はあとから追加できます"}</strong></div>
      <div className="passportDocument"><span>PERSONAL MEMORY DOCUMENT</span><b>OJ&lt;{String(seed % 10000000).padStart(7, "0")}&lt;JPN</b></div>
    </div>
    <div className="passportPage passportVisa">
      <div className="passportPageHeading"><span>VISAS / 訪問の記録</span><b>01</b></div>
      <div className={`visitStamp ${status}`} style={{ color: prefectureFlagColors[destination] }}>
        <span>{status === "planned" ? "NEXT DESTINATION" : "VISITED WITH MY OSHI"}</span><Globe2 size={25} /><strong>{destination}</strong><b>{date ? date.replaceAll("-", ".") : "COMING SOON"}</b><small>{status === "planned" ? "旅の予定" : "訪問の思い出"}</small>
      </div>
      {travelMode === "ferry" && ferryName && <div className={`ferryStamp ${status}`}><Ship size={22} /><span>SEA JOURNEY<small>{status === "planned" ? "船旅の予定" : "船旅の記録"}</small></span></div>}
      <div className="passportMemoryPhoto">{photo ? <img src={photo} alt="旅の思い出" /> : <><svg viewBox="0 0 58 88" aria-label={`${destination}の地図`} role="img"><path d={destinationPath} fill="currentColor" fillOpacity=".13" stroke="currentColor" strokeWidth=".6" fillRule="evenodd" /></svg><span>{status === "planned" ? "帰ってきたら、ここに思い出の一枚を。" : "この旅の写真を残そう。"}</span></>}</div>
      <p className="passportMemoryText">{memory || "推しに会うたび、世界が少し広がっていく。"}</p>
      <div className="passportPageFoot"><span>YOUR OSHI. YOUR JOURNEY.</span><span>02</span></div>
    </div>
  </PassportFrame>;
}
