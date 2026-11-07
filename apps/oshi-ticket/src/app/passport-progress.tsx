"use client";

import { Award, Globe2 } from "lucide-react";
import { prefectures, type SavedTicket } from "./trip-data";
import { getJourneyBadges } from "./journey-badges";

export function PassportProgress({ records, onOpen }: { records: SavedTicket[]; onOpen: (record: SavedTicket) => void }) {
  const visits = records.filter((record) => (record.status ?? "completed") === "completed");
  const visited = new Set(visits.map((record) => record.destination));
  const badges = getJourneyBadges(records);
  const earnedBadges = badges.filter((badge) => badge.progress >= badge.target);
  return <section className="passportProgress" aria-label="都道府県の訪問スタンプ">
    <div><span className="insightEyebrow">MY STAMP COLLECTION</span><h2><Globe2 size={20} />推しと広がる、私の地図。</h2><p><strong>{visited.size}</strong> / 47 都道府県を訪問</p></div>
    <div className="prefectureStamps">{prefectures.map((prefecture) => {
      const record = visits.find((entry) => entry.destination === prefecture);
      return <button type="button" key={prefecture} disabled={!record} className={record ? "collected" : ""} onClick={() => record && onOpen(record)} aria-label={`${prefecture}${record ? "の訪問記録を開く" : " 未訪問"}`} title={record ? `${prefecture} / ${record.date}` : `${prefecture} / まだ行っていない場所`}><span>{prefecture.replace(/(都|府|県)$/, "")}</span><small>{record ? "VISITED" : "···"}</small></button>;
    })}</div>
    <small>遠征済みの記録を保存するとスタンプが増えます。訪問はご自身の記録に基づきます。</small>
    <div className="journeyBadges" aria-labelledby="journeyBadgesHeading">
      <div className="journeyBadgesHeading">
        <h3 id="journeyBadgesHeading"><Award size={17} />旅のバッジ</h3>
        <span>{earnedBadges.length} / {badges.length} 獲得</span>
      </div>
      <div className="journeyBadgeGrid">
        {badges.map((badge) => {
          const earned = badge.progress >= badge.target;
          const Icon = badge.icon;
          const progress = Math.min(badge.progress, badge.target);
          return <article className={`journeyBadge ${earned ? "earned" : ""}`} key={badge.id} aria-label={`${badge.name}、${earned ? "獲得済み" : `進捗 ${progress} / ${badge.target}`}`}>
            <span className="journeyBadgeIcon"><Icon size={20} /></span>
            <div className="journeyBadgeInfo">
              <strong>{badge.name}</strong>
              <small>{badge.description}</small>
              {earned ? <span className="journeyBadgeStatus">獲得済み</span> : <span className="journeyBadgeProgress">{progress} / {badge.target}</span>}
            </div>
          </article>;
        })}
      </div>
      <small className="journeyBadgeNote">遠征済みとして保存した記録から自動で集計します。同じ会場かどうかは会場名で判定します。コレクション用の記録であり、訪問の事実を証明するものではありません。</small>
    </div>
  </section>;
}
