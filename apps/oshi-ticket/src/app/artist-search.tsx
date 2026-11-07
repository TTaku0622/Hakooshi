"use client";

import { useRef, useState } from "react";
import { Search } from "lucide-react";

type Artist = { id: number; name: string; genre: string; };

export function ArtistSearch({ value, onChange }: { value: string; onChange: (name: string) => void; }) {

  const [artists, setArtists] = useState<Artist[]>([]);

  const [searching, setSearching] = useState(false);

  const [message, setMessage] = useState("");

  const requestId = useRef(0);


  async function search() {

    const query = value.trim();

    if (!query || searching) return;

    const currentRequest = ++requestId.current;

    setSearching(true);

    setMessage("");

    setArtists([]);

    try {

      const response = await fetch(`/api/artists?q=${encodeURIComponent(query)}`);

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      if (currentRequest !== requestId.current) return;

      setArtists(data.artists);

      if (!data.artists.length) setMessage("候補が見つかりませんでした。入力した名前で登録できます。");
    } catch (error) {

      if (currentRequest === requestId.current) setMessage(error instanceof Error ? error.message : "検索できませんでした。手入力で続けられます。");
    } finally {

      setSearching(false);
    }
  }


  return (
    <div className="field artistSearch">

      <label htmlFor="oshi">推しの名前・グループ名 <span className="requiredMark">必須</span>
      </label>

      <div className="artistSearchRow">

        <input id="oshi" value={value} maxLength={35} required placeholder="アーティスト名を入力" onChange={(event) => { requestId.current++; onChange(event.target.value); setArtists([]); setMessage(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} />

        <button type="button" onClick={search} disabled={searching || !value.trim()} aria-label="アーティストを検索">
          <Search size={17} />{searching ? "検索中" : "検索"}</button>

      </div>

      <p className="fieldHint">検索して選ぶか、名前をそのまま手入力できます。</p>
      {artists.length > 0 && <div className="artistResults" aria-label="アーティスト検索結果">{artists.map((artist) =>
        <button type="button" key={artist.id} onClick={() => { requestId.current++; onChange(artist.name.slice(0, 35)); setArtists([]); setMessage("アーティストを選択しました。"); }}>
          <strong>{artist.name}</strong>
          <span>{artist.genre}</span>
        </button>)}<small>検索データ: Apple iTunes Search API</small>
      </div>}
      {message && <p className="fieldHint" role="status">{message}</p>}
    </div>
  );
}
