"use client";

import { useState } from "react";

const colors = [
  ["レッド", "#e66b75"], ["クリムゾン", "#d92d48"], ["ローズ", "#e62e8b"],
  ["ピンク", "#ed83aa"], ["ビビッドピンク", "#ff48a0"], ["ベビーピンク", "#f5b8cd"],
  ["オレンジ", "#e99a5b"], ["タンジェリン", "#ff7b24"], ["イエロー", "#e9c45d"],
  ["レモン", "#ffe43b"], ["ライム", "#a6d943"], ["グリーン", "#71b99a"],
  ["エメラルド", "#0c9b73"], ["ミント", "#a2e4cf"], ["アクア", "#43cad8"],
  ["スカイブルー", "#a7d6f2"], ["ブルー", "#65a9e8"], ["ロイヤルブルー", "#3265da"],
  ["ネイビー", "#243979"], ["パープル", "#a48ae8"], ["バイオレット", "#7d4ac7"],
  ["ラベンダー", "#c8b8ef"], ["ブラウン", "#986f55"], ["ブラック", "#252733"],
  ["シルバー", "#d8d8d8"], ["ホワイト", "#ffffff"],
];

function HexColor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const valid = /^#[\da-f]{6}$/i.test(draft);
  function commit() { if (valid) onChange(draft.toLowerCase()); }
  return <div className="hexColor">
    <label htmlFor="oshiHex">カラーコード</label>
    <input id="oshiHex" value={draft} maxLength={7} spellCheck={false} aria-invalid={!valid} aria-describedby={!valid ? "hexHelp" : undefined} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); } }} />
    {!valid && <small id="hexHelp">#と6桁の英数字（0–9、A–F）で入力</small>}
  </div>;
}

export function OshiColors({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const name = colors.find(([, hex]) => hex === value)?.[0] ?? "カスタム";
  return <div className="field">
    <span className="colorLabel">推しカラー <small>{name}</small></span>
    <div className="colorList" role="group" aria-label="推しカラーの選択">{colors.map(([name, hex]) =>
      <button key={hex} type="button" title={name} aria-label={name} aria-pressed={value === hex} className={`colorButton ${value === hex ? "colorSelected" : ""}`} style={{ backgroundColor: hex }} onClick={() => onChange(hex)} />)}</div>
    <div className="customColorRow"><label className="nativeColorLabel" htmlFor="oshiCustom"><input id="oshiCustom" type="color" value={value} onChange={(event) => onChange(event.target.value)} />自由に色を選ぶ</label><HexColor key={value} value={value} onChange={onChange} /></div>
  </div>;
}
