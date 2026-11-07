"use client";

import { useEffect, useRef, useState } from "react";
import { CarFront, MapPin, ExternalLink } from "lucide-react";
import { fromWorldPixel, hasCoordinates, osmLocation, toWorldPixel, type Coordinates, type SightseeingSpot, type Venue } from "./map-utils";

type RentalLocation = Coordinates & {
  id: string;
  city: string;
  averageDailyPrice: number;
  recordCount: number;
  distance: number;
};

function fitView(points: Coordinates[], width: number, height: number) {
  const pixels = points.map((point) => toWorldPixel(point, 0));
  const left = Math.min(...pixels.map((p) => p.x));
  const right = Math.max(...pixels.map((p) => p.x));
  const top = Math.min(...pixels.map((p) => p.y));
  const bottom = Math.max(...pixels.map((p) => p.y));
  const zoom = points.length === 1 ? 14 : Math.max(11, Math.min(16, Math.floor(Math.log2(Math.min((width - 80) / Math.max(right - left, .0001), (height - 80) / Math.max(bottom - top, .0001))))));
  return { center: fromWorldPixel((left + right) / 2, (top + bottom) / 2, 0), zoom };
}

function SpotMap({ venue, spots, selected, onSelect }: {
  venue: Venue & Coordinates;
  spots: SightseeingSpot[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 320 });
  const [visible, setVisible] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [view, setView] = useState({ center: venue as Coordinates, zoom: 14 });
  const drag = useRef<{ x: number; y: number; center: { x: number; y: number } } | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
      const active = spots.find((spot) => spot.id === selected);
      setView(active ? { center: active, zoom: 15 } : fitView([venue, ...spots], width, height));
    });
    const intersection = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    resize.observe(element); intersection.observe(element);
    return () => { resize.disconnect(); intersection.disconnect(); };
  }, [venue, spots, selected]);

  const center = toWorldPixel(view.center, view.zoom);
  const left = center.x - size.width / 2;
  const top = center.y - size.height / 2;
  const tiles = [];
  if (visible && size.width) {
    for (let x = Math.floor(left / 256); x <= Math.floor((left + size.width) / 256); x++) {
      for (let y = Math.floor(top / 256); y <= Math.floor((top + size.height) / 256); y++) {
        const n = 2 ** view.zoom;
        if (y >= 0 && y < n) tiles.push({ x, y, tx: ((x % n) + n) % n });
      }
    }
  }
  function position(point: Coordinates) {
    const pixel = toWorldPixel(point, view.zoom);
    return { left: pixel.x - left, top: pixel.y - top };
  }

  return <div ref={ref} className="spotMap" aria-label={`${venue.name}周辺の観光マップ`} onPointerDown={(event) => {
    if ((event.target as HTMLElement).closest("button, a") || event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, center };
    event.currentTarget.setPointerCapture(event.pointerId);
  }} onPointerMove={(event) => {
    if (!drag.current) return;
    setView({ ...view, center: fromWorldPixel(drag.current.center.x - event.clientX + drag.current.x, drag.current.center.y - event.clientY + drag.current.y, view.zoom) });
  }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    {tiles.map((tile) => (
      // Direct browser tile requests preserve OpenStreetMap's cache and Referer requirements.
      // eslint-disable-next-line @next/next/no-img-element
      <img className="mapTile" key={`${view.zoom}/${tile.x}/${tile.y}`} src={`https://tile.openstreetmap.org/${view.zoom}/${tile.tx}/${tile.y}.png`} alt="" draggable={false} width={256} height={256} onError={() => setTileError(true)} style={{ left: tile.x * 256 - left, top: tile.y * 256 - top }} />
    ))}
    <a className="mapVenuePin" style={position(venue)} href={osmLocation(venue)} target="_blank" rel="noreferrer" aria-label={`${venue.name}をOpenStreetMapで開く`} title={venue.name}><MapPin size={21} /></a>
    {spots.map((spot, index) => <button type="button" key={spot.id} className={`mapSpotPin${selected === spot.id ? " selected" : ""}`} style={position(spot)} onClick={() => onSelect(spot.id)} aria-label={`${index + 1}. ${spot.name}`} aria-pressed={selected === spot.id} title={spot.name}>{index + 1}</button>)}
    <div className="mapControls">
      <button type="button" aria-label="地図を拡大" disabled={view.zoom >= 17} onClick={() => setView({ ...view, zoom: view.zoom + 1 })}>＋</button>
      <button type="button" aria-label="地図を縮小" disabled={view.zoom <= 11} onClick={() => setView({ ...view, zoom: view.zoom - 1 })}>−</button>
      <button type="button" onClick={() => { onSelect(null); setView(fitView([venue, ...spots], size.width, size.height)); }}>全体</button>
    </div>
    <a className="mapAttribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
    {tileError && <p className="mapTileError">地図の一部を読み込めませんでした。<a href={osmLocation(venue)} target="_blank" rel="noreferrer">大きな地図で見る</a></p>}
  </div>;
}

function RentalMap({ venue, rentals, selected, onSelect }: {
  venue: Venue & Coordinates;
  rentals: RentalLocation[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 320 });
  const [visible, setVisible] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [view, setView] = useState({ center: venue as Coordinates, zoom: 14 });
  const drag = useRef<{ x: number; y: number; center: { x: number; y: number } } | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
      const active = rentals.find((rental) => rental.id === selected);
      setView(active ? { center: active, zoom: 15 } : fitView([venue, ...rentals], width, height));
    });
    const intersection = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    resize.observe(element);
    intersection.observe(element);
    return () => { resize.disconnect(); intersection.disconnect(); };
  }, [venue, rentals, selected]);

  const center = toWorldPixel(view.center, view.zoom);
  const left = center.x - size.width / 2;
  const top = center.y - size.height / 2;
  const tiles = [];
  if (visible && size.width) {
    for (let x = Math.floor(left / 256); x <= Math.floor((left + size.width) / 256); x++) {
      for (let y = Math.floor(top / 256); y <= Math.floor((top + size.height) / 256); y++) {
        const n = 2 ** view.zoom;
        if (y >= 0 && y < n) tiles.push({ x, y, tx: ((x % n) + n) % n });
      }
    }
  }
  function position(point: Coordinates) {
    const pixel = toWorldPixel(point, view.zoom);
    return { left: pixel.x - left, top: pixel.y - top };
  }

  return <div ref={ref} className="spotMap" aria-label={`${venue.name}周辺のレンタカー料金マップ`} onPointerDown={(event) => {
    if ((event.target as HTMLElement).closest("button, a") || event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, center };
    event.currentTarget.setPointerCapture(event.pointerId);
  }} onPointerMove={(event) => {
    if (!drag.current) return;
    setView({ ...view, center: fromWorldPixel(drag.current.center.x - event.clientX + drag.current.x, drag.current.center.y - event.clientY + drag.current.y, view.zoom) });
  }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    {tiles.map((tile) => (
      // Direct browser tile requests preserve OpenStreetMap's cache and Referer requirements.
      // eslint-disable-next-line @next/next/no-img-element
      <img className="mapTile" key={`${view.zoom}/${tile.x}/${tile.y}`} src={`https://tile.openstreetmap.org/${view.zoom}/${tile.tx}/${tile.y}.png`} alt="" draggable={false} width={256} height={256} onError={() => setTileError(true)} style={{ left: tile.x * 256 - left, top: tile.y * 256 - top }} />
    ))}
    <a className="mapVenuePin" style={position(venue)} href={osmLocation(venue)} target="_blank" rel="noreferrer" aria-label={`${venue.name}をOpenStreetMapで開く`} title={venue.name}><MapPin size={21} /></a>
    {rentals.map((rental) => <button type="button" key={rental.id} className={`mapRentalPin${selected === rental.id ? " selected" : ""}`} style={position(rental)} onClick={() => onSelect(rental.id)} aria-label={`${rental.city}のレンタカー料金、1日平均${rental.averageDailyPrice.toLocaleString()}円`} aria-pressed={selected === rental.id} title={`${rental.city}・1日平均${rental.averageDailyPrice.toLocaleString()}円`}><CarFront size={14} /></button>)}
    <div className="mapControls">
      <button type="button" aria-label="地図を拡大" disabled={view.zoom >= 17} onClick={() => setView({ ...view, zoom: view.zoom + 1 })}>＋</button>
      <button type="button" aria-label="地図を縮小" disabled={view.zoom <= 11} onClick={() => setView({ ...view, zoom: view.zoom - 1 })}>−</button>
      <button type="button" onClick={() => setView(fitView([venue, ...rentals], size.width, size.height))}>全体</button>
    </div>
    <a className="mapAttribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
    {tileError && <p className="mapTileError">地図の一部を読み込めませんでした。<a href={osmLocation(venue)} target="_blank" rel="noreferrer">大きな地図で見る</a></p>}
  </div>;
}

const emptySpots: SightseeingSpot[] = [];

export function NearbyMap({ venue }: { venue: Venue | null }) {
  const [result, setResult] = useState<{ key: string; spots?: SightseeingSpot[]; error?: string; notice?: string; kind?: string } | null>(null);
  const [rentalResult, setRentalResult] = useState<{ key: string; rentals?: RentalLocation[]; error?: string; expanded?: boolean; radius?: number } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedRental, setSelectedRental] = useState<string | null>(null);
  const located = hasCoordinates(venue);
  const latitude = located ? venue.latitude : null;
  const longitude = located ? venue.longitude : null;
  const key = `${latitude}/${longitude}/${refresh}`;
  const current = result?.key === key ? result : null;
  const spots = current?.spots ?? emptySpots;
  const active = spots.find((spot) => spot.id === selected);
  const currentRentals = rentalResult?.key === key ? rentalResult : null;
  const rentals = currentRentals?.rentals ?? [];
  const activeRental = rentals.find((rental) => rental.id === selectedRental);

  useEffect(() => {
    if (latitude === null || longitude === null) return;
    const controller = new AbortController();
    fetch(`/api/nearby?${new URLSearchParams({ lat: String(latitude), lon: String(longitude) })}`, { signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then((data) => { if (!controller.signal.aborted) { setResult({ key, spots: data.spots, notice: data.notice, kind: data.kind }); setSelected(null); } })
      .catch((error) => { if (!controller.signal.aborted) setResult({ key, error: error instanceof Error ? error.message : "周辺スポットを取得できませんでした。" }); });
    return () => controller.abort();
  }, [latitude, longitude, key]);

  useEffect(() => {
    if (latitude === null || longitude === null) return;
    const controller = new AbortController();
    fetch(`/api/rentals?${new URLSearchParams({ lat: String(latitude), lon: String(longitude) })}`, { signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then((data) => { if (!controller.signal.aborted) { setRentalResult({ key, rentals: data.rentals, expanded: data.expanded, radius: data.radius }); setSelectedRental(null); } })
      .catch((error) => { if (!controller.signal.aborted) setRentalResult({ key, error: error instanceof Error ? error.message : "レンタカー情報を取得できませんでした。" }); });
    return () => controller.abort();
  }, [latitude, longitude, key]);

  return <>
    <section className="nearbySection" aria-label="会場周辺の観光スポット">
    <div className="nearbyHeading"><span>EXPLORE AROUND THE VENUE</span><h2><MapPin size={19} />ライブの前後に、寄り道を。</h2>
      <p>{located ? `${venue.name}周辺の観光スポット・レンタカー` : "会場を検索して候補を選ぶと、周辺の観光マップを表示します。"}</p></div>
    {located && <>
      <SpotMap key={`${latitude}/${longitude}/${spots.map((spot) => spot.id).join(",")}`} venue={venue} spots={spots} selected={selected} onSelect={setSelected} />
      <a className="mapExternal" href={osmLocation(venue)} target="_blank" rel="noreferrer">会場を大きな地図で見る <ExternalLink size={12} /></a>
      <div className="mapLegend"><span><i className="venueLegend" />ライブ会場</span><span><i className="sightseeingLegend" />観光スポット</span></div>
      <div aria-live="polite">
        {!current && <p className="nearbyMessage">周辺の観光スポットを探しています…</p>}
        {current?.error && <p className="nearbyMessage">{current.error}<button type="button" onClick={() => setRefresh((value) => value + 1)}>再試行</button></p>}
        {current?.notice && <p className="nearbyMessage">{current.notice}<button type="button" onClick={() => setRefresh((value) => value + 1)}>観光スポットを再検索</button></p>}
        {current?.spots?.length === 0 && <p className="nearbyMessage">周辺2kmに登録された観光スポットが見つかりませんでした。</p>}
        {active && <div className="spotDetail"><strong>{active.name}</strong><span>{active.category} · 会場から直線 {active.distance.toLocaleString()}m</span><a href={`https://www.openstreetmap.org/${active.osmType}/${active.osmId}`} target="_blank" rel="noreferrer">場所の詳細を開く <ExternalLink size={12} /></a></div>}
      </div>
      {spots.length > 0 && <ol className="spotList" aria-label="近隣の観光スポット一覧">{spots.map((spot, index) => <li key={spot.id}>
        <button type="button" aria-pressed={selected === spot.id} onClick={() => setSelected(spot.id)}><b>{index + 1}</b><span><strong>{spot.name}</strong><small>{spot.category} · 直線 {spot.distance.toLocaleString()}m</small></span></button>
      </li>)}</ol>}
      <p className="nearbySource">{current?.kind === "cultural" ? "周辺施設: © OpenStreetMap contributors / 提供CSV（raibu.csv）" : <>観光スポット: OpenStreetMap / Overpass API（<a href="https://maps.mail.ru/osm/tools/overpass/" target="_blank" rel="noreferrer">VK Maps</a>）</>}<br />営業時間・営業状況は訪問前にご確認ください。宿泊需要の年次データ: Project LINKS。月別稼働率: 観光庁。</p>
    </>}
    </section>
    <section className="nearbySection rentalSection" aria-label="周辺のレンタカー">
    <div className="nearbyHeading"><span>RENT A CAR</span><h2><CarFront size={19} />会場周辺のレンタカー</h2>
      <p>{located ? `${venue.name}周辺の料金データ。マーカーまたは一覧を選ぶと、1日あたりの平均料金を確認できます。` : "会場を検索して候補を選ぶと、周辺のレンタカー料金を表示します。"}</p></div>
    {located && <>
      {!currentRentals && <p className="nearbyMessage">レンタカー料金データを読み込んでいます…</p>}
      {currentRentals?.error && <p className="nearbyMessage">{currentRentals.error}<button type="button" onClick={() => setRefresh((value) => value + 1)}>再試行</button></p>}
      {currentRentals?.expanded && rentals.length > 0 && <p className="nearbyMessage">5km以内にデータがないため、検索範囲を30kmに広げて表示しています。</p>}
      {currentRentals?.rentals?.length === 0 && <p className="nearbyMessage">周辺30kmにレンタカー料金データがありません。</p>}
      {rentals.length > 0 && <>
        <RentalMap key={`${latitude}/${longitude}/${rentals.map((rental) => rental.id).join(",")}`} venue={venue} rentals={rentals} selected={selectedRental} onSelect={setSelectedRental} />
        <div className="mapLegend"><span><i className="venueLegend" />ライブ会場</span><span><i className="rentalLegend"><CarFront size={12} /></i>レンタカー</span></div>
        {activeRental && <div className="rentalDetail"><strong>{activeRental.city}のレンタカー</strong><span>1日あたり平均</span><b>¥{activeRental.averageDailyPrice.toLocaleString()}<small> / 日</small></b><small>{activeRental.recordCount}件の料金データ · 会場から直線 {activeRental.distance.toLocaleString()}m</small></div>}
        <ol className="rentalList" aria-label="近隣のレンタカー料金一覧">{rentals.map((rental) => <li key={rental.id}>
          <button type="button" aria-pressed={selectedRental === rental.id} onClick={() => setSelectedRental(rental.id)}>
            <CarFront size={16} /><span><strong>{rental.city}</strong><small>会場から直線 {rental.distance.toLocaleString()}m · {rental.recordCount}件のデータ</small></span><b>¥{rental.averageDailyPrice.toLocaleString()}<small> / 日</small></b>
          </button>
        </li>)}</ol>
      </>}
      <p className="nearbySource">料金は提供CSVに記録された1日あたり料金の平均です。近い座標のデータをまとめています。{currentRentals?.radius && <>検索範囲: 会場から{(currentRentals.radius / 1000).toLocaleString()}km以内。</>}</p>
    </>}
    </section>
  </>;
}
