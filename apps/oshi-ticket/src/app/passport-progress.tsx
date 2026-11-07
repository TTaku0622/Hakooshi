"use client";

import { Globe2 } from "lucide-react";
import { prefectures, type SavedTicket } from "./trip-data";

export function PassportProgress({ records, onOpen }: { records: SavedTicket[]; onOpen: (record: SavedTicket) => void }) {
  const visits = records.filter((record) => (record.status ?? "completed") === "completed");
  const visited = new Set(visits.map((record) => record.destination));
  return <section className="passportProgress" aria-label="都道府県の訪問スタンプ">
    <div><span className="insightEyebrow">MY STAMP COLLECTION</span><h2><Globe2 size={20} />推しと広がる、私の地図。</h2><p><strong>{visited.size}</strong> / 47 都道府県を訪問</p></div>
    <div className="prefectureStamps">{prefectures.map((prefecture) => {
      const record = visits.find((entry) => entry.destination === prefecture);
      return <button type="button" key={prefecture} disabled={!record} className={record ? "collected" : ""} onClick={() => record && onOpen(record)} aria-label={`${prefecture}${record ? "の訪問記録を開く" : " 未訪問"}`} title={record ? `${prefecture} / ${record.date}` : `${prefecture} / まだ行っていない場所`}><span>{prefecture.replace(/(都|府|県)$/, "")}</span><small>{record ? "VISITED" : "···"}</small></button>;
    })}</div>
    <small>遠征済みの記録を保存するとスタンプが増えます。訪問はご自身の記録に基づきます。</small>
  </section>;
}
