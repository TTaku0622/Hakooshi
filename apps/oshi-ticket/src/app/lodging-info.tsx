"use client";

import { useEffect, useState } from "react";
import { BedDouble, ExternalLink } from "lucide-react";
import { hasCoordinates, type SightseeingSpot, type Venue } from "./map-utils";

export function LodgingInfo({ venue }: { venue: Venue | null }) {
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ lodgings?: SightseeingSpot[]; error?: string } | null>(null);
  const located = hasCoordinates(venue);
  const latitude = located ? venue.latitude : null; const longitude = located ? venue.longitude : null;
  useEffect(() => {
    if (!refresh || latitude === null || longitude === null) return;
    const controller = new AbortController();
    fetch(`/api/lodgings?${new URLSearchParams({ lat: String(latitude), lon: String(longitude) })}`, { signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then((data) => { if (!controller.signal.aborted) setResult({ lodgings: data.lodgings }); })
      .catch((error) => { if (!controller.signal.aborted) setResult({ error: error instanceof Error ? error.message : "取得できませんでした。" }); });
    return () => controller.abort();
  }, [latitude, longitude, refresh]);
  return <section className="lodgingInfo" aria-label="地域の宿泊施設">
    <span className="insightEyebrow">FIND A PLACE TO STAY</span><h2><BedDouble size={20} />旅の拠点を、会場の近くに。</h2>
    <p>{located ? `${venue.name}から直線3km以内の宿泊施設` : "位置情報のある会場を選ぶと、近隣の宿泊施設を探せます。"}</p>
    {located && <><button className="lodgingSearch" type="button" onClick={() => { setResult(null); setRefresh((value) => value + 1); }} disabled={refresh > 0 && !result}>{refresh > 0 && !result ? "宿泊施設を探しています…" : result ? "宿泊施設を再検索" : "近隣の宿泊施設を探す"}</button>
      <div aria-live="polite">{result?.error && <p className="fieldHint">{result.error}</p>}{result?.lodgings?.length === 0 && <p className="fieldHint">この範囲には宿泊施設の登録が見つかりませんでした。</p>}</div>
      {result?.lodgings && <div className="lodgingList">{result.lodgings.map((lodging) => <a key={lodging.id} href={`https://www.openstreetmap.org/${lodging.osmType}/${lodging.osmId}`} target="_blank" rel="noreferrer"><span><strong>{lodging.name}</strong><small>{lodging.category} · 会場から直線 {lodging.distance.toLocaleString()}m</small></span><ExternalLink size={13} /></a>)}</div>}
      <p className="insightSource">施設情報：<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> / Overpass API（VK Maps）。Project LINKSの統計とは別の出典です。営業状況・空室・料金は施設の公式情報をご確認ください。</p>
    </>}
  </section>;
}
