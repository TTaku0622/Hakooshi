"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Globe2, MapPin, Plane, Ship, TrainFront } from "lucide-react";
import { prefectureFlagColors } from "./prefecture-colors";
import type { TripStatus } from "./trip-data";

export const PASSPORT_WIDTH = 800;
export const PASSPORT_HEIGHT = 520;
export type TravelMode = "train" | "ferry" | "plane" | "other";
export const travelModeNames: Record<TravelMode, string> = { train: "鉄道", ferry: "船・フェリー", plane: "飛行機", other: "その他" };

export function PassportFrame({ pageRef, color, destination, className, children }: {
  pageRef: RefObject<HTMLDivElement | null>; color: string; destination: string; className?: string; children: ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // タブで隠れると幅0が届く。無視しないと scale(0) になり、タブを戻すたびにパスポートがちらつく
    const observer = new ResizeObserver(([entry]) => { if (entry.contentRect.width) setScale(Math.min(1, entry.contentRect.width / PASSPORT_WIDTH)); });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  return <div className={className ? `passportStage ${className}` : "passportStage"}><div className="passportViewport" ref={viewportRef}>
    <div className="passportSheet" ref={pageRef} style={{ transform: `scale(${scale})`, "--oshi": color, "--prefecture": prefectureFlagColors[destination] } as CSSProperties}>
      <div className="passportBook">{children}<div className="passportSpine" aria-hidden="true" /></div>
    </div>
  </div></div>;
}

export function TravelIcon({ mode, size = 16 }: { mode: TravelMode; size?: number }) {
  return mode === "ferry" ? <Ship size={size} /> : mode === "train" ? <TrainFront size={size} /> : mode === "plane" ? <Plane size={size} /> : <MapPin size={size} />;
}

export type PassportSpreadProps = {
  origin: string; destination: string; oshi: string; event: string; date: string;
  memory: string; photo: string; color: string; seed: number; destinationPath: string; status: TripStatus; venueName?: string; visitCount?: number; travelMode: TravelMode; ferryName?: string;
};

// 01・02 ページの見開き（PNG 保存用）
export function PassportSpread({ pageRef, ...props }: PassportSpreadProps & { pageRef: RefObject<HTMLDivElement | null> }) {
  return <PassportFrame pageRef={pageRef} color={props.color} destination={props.destination}>
    <IdentityPage {...props} />
    <VisaPage {...props} showStampTool />
  </PassportFrame>;
}

// 01 ページ：推しと旅の情報
export function visitTier(count: number) {
  if (count >= 6) return "legend";
  if (count === 5) return "fifth";
  if (count === 4) return "fourth";
  if (count === 3) return "third";
  if (count === 2) return "second";
  return count === 1 ? "first" : "unvisited";
}

function visitRankLabel(count: number) {
  if (count >= 6) return "LEGENDARY";
  if (count === 5) return "FIFTH VISIT";
  if (count === 4) return "FOURTH VISIT";
  if (count === 3) return "THIRD VISIT";
  if (count === 2) return "SECOND VISIT";
  return count === 1 ? "FIRST VISIT" : "";
}

function VisitSparkles({ count }: { count: number }) {
  if (count < 1) return null;
  const particles = Math.min(4 + Math.min(count, 6) * 3, 22);
  const power = Math.min(count, 6);
  const radius = 38 + power * 5;
  return <span
    className={`passportVisitSparkles ${visitTier(count)}`}
    aria-hidden="true"
    style={{ "--visit-power": power } as CSSProperties}
  >
    {Array.from({ length: particles }, (_, index) => {
      const angle = (index / particles) * 360;
      const distance = radius + (index % 3) * 7;
      return <i
        key={index}
        style={{
          transform: `rotate(${angle}deg) translateY(-${distance}px) rotate(-${angle}deg)`,
          animationDelay: `${(index % 12) * 0.13}s`,
          fontSize: `${12 + power * 0.9}px`,
        }}
      >✦</i>;
    })}
  </span>;
}

export function IdentityPage({ origin, destination, oshi, event, date, seed, venueName, travelMode, visitCount = 0 }: PassportSpreadProps) {
  return <div className="passportPage passportIdentity" data-visit-count={visitCount > 0 ? visitCount : undefined} data-visit-tier={visitTier(visitCount)} style={{ "--visit-power": Math.min(visitCount, 6) } as CSSProperties}>
      <div className="passportBrand"><Globe2 size={23} /><span>OSHI PASSPORT<small>推し旅パスポート</small></span></div>
      <p className="passportKicker">EVERY JOURNEY BRINGS ME CLOSER TO YOU.</p>
      <div className="passportField passportArtist"><span>ARTIST / OSHI · 推しの名前</span><strong>{oshi || "推しの名前を入れてね"}</strong></div>
      <div className="passportField"><span>PURPOSE OF VISIT · イベント</span><strong>{event || "次のライブをここに"}</strong></div>
      <div className="passportRoute"><div><span>FROM</span><strong>{origin}</strong></div><TravelIcon mode={travelMode} size={22} /><div><span>TO</span><strong>{destination}</strong></div></div>
      <div className="passportField"><span>DATE OF JOURNEY · 公演日</span><strong>{date ? date.replaceAll("-", ".") : "日付を選択"}</strong></div>
      <div
        className={`passportVenueAura ${visitTier(visitCount)}`}
        style={{ "--visit-power": Math.min(visitCount, 6) } as CSSProperties}
      >
        <VisitSparkles count={visitCount} />
        <div className="passportField passportVenue"><span>VENUE · 会場</span><strong>{venueName || "会場はあとから追加できます"}</strong></div>
        {visitCount > 0 && <span className="passportVisitCount">{visitCount} {visitCount === 1 ? "VISIT" : "VISITS"} · {visitRankLabel(visitCount)}</span>}
      </div>
      <div className="passportDocument"><span>PERSONAL MEMORY DOCUMENT</span><b>OJ&lt;{String(seed % 10000000).padStart(7, "0")}&lt;JPN</b></div>
    </div>;
}

// 02 ページ：訪問スタンプと思い出
export function VisaPage({ destination, date, memory, photo, destinationPath, status, travelMode, ferryName, visitCount = 0, stampVisible = status === "completed", stampImpact, onStampContact, onStampLanded, onStampPress, stampPressDisabled, showStampTool }: PassportSpreadProps & {
  stampVisible?: boolean;
  stampImpact?: { count: number; afterPageTurn: boolean };
  onStampContact?: () => void;
  onStampLanded?: () => void;
  onStampPress?: () => void;
  stampPressDisabled?: boolean;
  showStampTool?: boolean;
}) {
  const pressing = !!stampImpact && stampVisible;
  const impactClass = pressing ? " visitStampImpact" : "";
  return <div className="passportPage passportVisa" data-visit-count={visitCount > 0 ? visitCount : undefined} data-visit-tier={visitTier(visitCount)} style={{ "--visit-power": Math.min(visitCount, 6) } as CSSProperties}>
      <div className="passportPageHeading"><span>VISAS / 訪問の記録</span><b>01</b></div>
      <div className={`visitStampSlot${pressing && stampImpact.afterPageTurn ? " visitStampAfterPageTurn" : ""}`}>
        {stampVisible && visitCount > 0 && (
          <div className={`passportStampAura ${visitTier(visitCount)}`} style={{ position: "absolute", margin: 0, "--visit-power": Math.min(visitCount, 6) } as CSSProperties}>
            <VisitSparkles count={visitCount} />
          </div>
        )}
        {onStampPress && (
          <button type="button" className="visitStampTarget" onClick={onStampPress} disabled={stampPressDisabled}>
            ここをタッチ
          </button>
        )}
        {stampVisible && (
          <div key={stampImpact?.count} className={`visitStamp visitStampSeal${impactClass}`}
            onAnimationStart={(event) => { if (event.animationName === "visitStampInk") onStampContact?.(); }}
            onAnimationEnd={(event) => { if (event.animationName === "visitStampImpact") onStampLanded?.(); }}>
            <span>VISITED WITH MY OSHI</span><Globe2 size={25} /><strong>{destination}</strong><b>{date.replaceAll("-", ".")}</b><small>訪問の思い出</small>
            {visitCount > 0 && <em>{visitCount} {visitCount === 1 ? "VISIT" : "VISITS"}</em>}
          </div>
        )}
        {pressing && <div className="visitStampTool visitStampToolPressing" aria-hidden="true" />}
        {stampVisible && showStampTool && <div className="visitStampTool visitStampToolSnapshot" aria-hidden="true" />}
      </div>
      {stampVisible && travelMode === "ferry" && ferryName && <div className="ferryStamp"><Ship size={22} /><span>SEA JOURNEY<small>船旅の記録</small></span></div>}
      <div className="passportMemoryPhoto">{photo ? <img src={photo} alt="旅の思い出" /> : <><svg viewBox="0 0 58 88" aria-label={`${destination}の地図`} role="img"><path d={destinationPath} fill="currentColor" fillOpacity=".13" stroke="currentColor" strokeWidth=".6" fillRule="evenodd" /></svg><span>{status === "planned" ? "帰ってきたら、ここに思い出の一枚を。" : "この旅の写真を残そう。"}</span></>}</div>
      <p className="passportMemoryText">{memory || "推しに会うたび、世界が少し広がっていく。"}</p>
      <div className="passportPageFoot"><span>YOUR OSHI. YOUR JOURNEY.</span><span>02</span></div>
    </div>;
}
