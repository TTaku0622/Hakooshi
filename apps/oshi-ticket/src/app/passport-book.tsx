"use client";

import { useRef, useState, type ReactNode } from "react";
import { PassportFrame } from "./passport-spread";
import type { TicketSide } from "./trip-data";

// 01〜04 ページを1冊の本として表示する。02（表）と 03（裏）が1枚の紙で、背表紙を軸にめくる
// 下には左に 01、右に 04 を置いておき、紙がめくれると 04 が見え、03 が 01 の上に重なる
export function PassportBook({ side, color, destination, pages }: {
  side: TicketSide; color: string; destination: string; pages: [ReactNode, ReactNode, ReactNode, ReactNode];
}) {
  const bookRef = useRef<HTMLDivElement>(null);
  const [first, second, third, fourth] = pages;
  const isBack = side === "back";

  // めくった回数。変わるたびに影のアニメーションを最初から流し直す
  // めくっている途中で戻したときは、紙がすぐ戻るので影は流し直さない（流し直すと着地後に影が出る）
  const [turns, setTurns] = useState(0);
  const [turning, setTurning] = useState(false);
  const [lastSide, setLastSide] = useState(side);
  if (lastSide !== side) {
    setLastSide(side);
    if (!turning) setTurns((count) => count + 1);
    setTurning(true);
  }
  const shade = turns > 0 && <i key={turns} className="passportShade" aria-hidden="true" />;

  return <PassportFrame pageRef={bookRef} color={color} destination={destination} className={`passportFlipStage${isBack ? " isBack" : ""}`}>
    <div className="passportUnder" aria-hidden={isBack}>{first}{shade}</div>
    <div className="passportUnder" aria-hidden={!isBack}>{fourth}{shade}</div>
    <div className="passportLeaf" onTransitionEnd={(event) => { if (event.target === event.currentTarget) setTurning(false); }}>
      <div className="passportLeafFace passportLeafFront" aria-hidden={isBack}>{second}{shade}</div>
      <div className="passportLeafFace passportLeafBack" aria-hidden={!isBack}>{third}{shade}</div>
    </div>
  </PassportFrame>;
}
