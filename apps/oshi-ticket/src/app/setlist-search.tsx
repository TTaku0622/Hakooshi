"use client";

import { useState } from "react";
import { officialSongTitle } from "./setlist";

type Concert = {
  id: string;
  artist?: string;
  date: string;
  venue?: string;
  city?: string;
  tour?: string;
  url: string;
  songs: string[];
};

export function SetlistSearch({ artist, date, concertId, onSelect, onImport }: {
  artist: string;
  date: string;
  concertId?: string;
  onSelect?: (id: string) => void;
  onImport?: (id: string, songs: string[], sourceUrl: string) => void;
}) {
  const lookup = !!concertId && !onSelect;
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [pngImportEnabled, setPngImportEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function search() {
    setLoading(true);
    setMessage("");
    setConcerts([]);
    try {
      const query = new URLSearchParams(lookup && concertId ? { id: concertId } : { artist, date });
      const response = await fetch(`/api/setlists?${query}`);
      const data: { concerts?: Concert[]; error?: string; pngImportEnabled?: boolean } = await response.json();
      if (!response.ok) throw new Error(data.error ?? "セットリストを検索できませんでした。");
      const results = data.concerts ?? [];
      setConcerts(results);
      setPngImportEnabled(data.pngImportEnabled === true);
      if (!results.length) setMessage("該当する公演が見つかりませんでした。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "セットリストを検索できませんでした。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="field">
      <div className="artistSearchRow">
        <button type="button" disabled={loading || (!lookup && (!artist.trim() || !date))} onClick={search}>
          {loading ? "取得中…" : lookup ? "セットリストを表示" : "setlist.fmで公演を検索"}
        </button>
      </div>
      {!lookup && <p className="photoHelp">推しの名前と公演日で検索し、行った公演を選んでください。</p>}
      {message && <p role="status">{message}</p>}
      {concerts.map((concert) => (
        <details key={concert.id} open={lookup || undefined}>
          <summary>{[concert.artist, concert.date, concert.venue, concert.city, concert.tour].filter(Boolean).join(" · ")}</summary>
          {concert.songs.length ? (
            <ol className="ticketSetlist">
              {concert.songs.map((song, index) => {
                const title = officialSongTitle(concert.artist || artist, song);
                return <li key={index}>{title}{title !== song && <small>（setlist.fm：{song}）</small>}</li>;
              })}
            </ol>
          ) : <p>曲順はまだ登録されていません。</p>}
          <a href={concert.url} target="_blank" rel="noopener">出典：setlist.fm</a>
          {onImport && pngImportEnabled && concert.songs.length > 0 && (
            <div className="artistSearchRow">
              <button type="button" onClick={() => onImport(
                concert.id,
                concert.songs.map((song) => officialSongTitle(concert.artist || artist, song)),
                concert.url,
              )}>全曲をPNG用の欄に入力</button>
            </div>
          )}
          {onSelect && <div className="artistSearchRow">
            <button type="button" onClick={() => onSelect(concert.id)} disabled={concertId === concert.id}>
              {concertId === concert.id ? "選択済み" : "この公演をパスポートに追加"}
            </button>
          </div>}
        </details>
      ))}
    </div>
  );
}
