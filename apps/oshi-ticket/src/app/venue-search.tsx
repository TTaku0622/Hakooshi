"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { hasCoordinates, type Venue } from "./map-utils";

export function VenueSearch({ value, onChange, onSelect }: {
  value: Venue | null; onChange: (value: Venue | null) => void; onSelect: (value: Venue) => void;
}) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function search() {
    const query = value?.name.trim();
    if (!query) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setSearching(true); setMessage(""); setVenues([]);
    try {
      const response = await fetch(`/api/venues?q=${encodeURIComponent(query)}`, { signal: request.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (request.signal.aborted) return;
      setVenues(data.venues);
      if (!data.venues.length) setMessage("候補が見つかりませんでした。英語名でも検索できます。手入力のまま保存もできます。");
    } catch (error) {
      if (!request.signal.aborted) setMessage(error instanceof Error ? error.message : "検索できませんでした。会場名は手入力できます。");
    } finally {
      if (!request.signal.aborted) setSearching(false);
    }
  }

  return <div className="field">
    <label htmlFor="venue">ライブ会場</label>
    <div className="artistSearchRow">
      <input id="venue" value={value?.name ?? ""} maxLength={100} placeholder="例：Zepp Osaka Bayside" onChange={(event) => {
        controller.current?.abort(); setSearching(false); setVenues([]); setMessage("");
        onChange(event.target.value ? { name: event.target.value, source: "manual" } : null);
      }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} />
      <button type="button" onClick={search} disabled={searching || !value?.name.trim()} aria-label="会場を検索"><Search size={17} />{searching ? "検索中" : "検索"}</button>
    </div>
    <p className="fieldHint">候補を選ぶと遠征先の県を設定し、会場周辺の観光マップを表示します。</p>
    {hasCoordinates(value) && <p className="venueSelected">📍 {value.prefecture} {value.address}
      {value.source === "musicbrainz" && value.id && <a href={`https://musicbrainz.org/place/${value.id}`} target="_blank" rel="noreferrer">会場情報: MusicBrainz</a>}</p>}
    {value?.source === "osm" && value.id && /^(node|way|relation)\/\d+$/.test(value.id) && <p className="fieldHint"><a href={`https://www.openstreetmap.org/${value.id}`} target="_blank" rel="noreferrer">会場情報: © OpenStreetMap contributors（提供CSV）</a></p>}
    {venues.length > 0 && <div className="artistResults" aria-label="会場検索結果">{venues.map((venue) =>
      <button type="button" key={venue.id} onClick={() => { onSelect(venue); setVenues([]); setMessage("会場の場所を設定しました。"); }}>
        <strong>{venue.name}</strong><span>{venue.prefecture} / {venue.address}</span>
      </button>)}<small>会場候補: 提供CSV / OpenStreetMap・MusicBrainz。ライブ対応は会場公式で確認してください。</small></div>}
    {message && <p className="fieldHint" role="status">{message}</p>}
  </div>;
}
