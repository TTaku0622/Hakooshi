"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { logout } from "./auth-actions";
import { toPng } from "html-to-image";
import { Download, MapPin, Sparkles, BookOpen, Bookmark, Trash2, Plus, Pencil, LogOut } from "lucide-react";
import { PassportSpread, IdentityPage, VisaPage, PASSPORT_WIDTH, PASSPORT_HEIGHT, travelModeNames, type PassportSpreadProps, type TravelMode } from "./passport-spread";
import { PassportNotes, DestinationNotesPage, MyJourneyPage, type PassportNotesProps } from "./passport-notes";
import { PassportBook } from "./passport-book";
import { PassportProgress } from "./passport-progress";
import { getEarnedJourneyBadges } from "./journey-badges";
import { railways, ferryFacts } from "./travel-data";
import { ArtistSearch } from "./artist-search";
import { StayInsights } from "./stay-insights";
import { OshiColors } from "./oshi-colors";
import { VenueSearch } from "./venue-search";
import { NearbyMap } from "./nearby-map";
import { LodgingInfo } from "./lodging-info";
import { JourneyGps } from "./JourneyGps";
import type { Venue } from "./map-utils";
import { prefectureFlagColors } from "./prefecture-colors";
import { prefectures, tourismYears, parseActualTotal, type SavedTicket, type TourismData, type TripType, type TripStatus, type TicketSide } from "./trip-data";

function hashString(value: string) {

  return [...value].reduce((hash, char) => {

    return (hash * 31 + char.charCodeAt(0)) >>> 0;
  }, 7);
}


type Position = [number, number];

type GeoGeometry =
  | { type: "Polygon"; coordinates: Position[][]; }
  | { type: "MultiPolygon"; coordinates: Position[][][]; };

type GeoFeature = {
  properties: { N03_001: string; };
  geometry: GeoGeometry;
};

type GeoJSONData = {
  features: GeoFeature[];
};

function geometryToSvgPath(geometry: GeoGeometry, width: number, height: number) {

  const allPolygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.coordinates;

  // MultiPolygonの場合は面積が大きい順に並べる
  // 東京のように離島を含む場合、本土部分を優先して表示する

  const polygonArea = (polygon: Position[][]) => {

    const ring = polygon[0];

    if (!ring || ring.length < 3) return 0;


    let area = 0;

    for (let i = 0; i < ring.length; i++) {

      const [x1, y1] = ring[i];

      const [x2, y2] = ring[(i + 1) % ring.length];

      area += x1 * y2 - x2 * y1;
    }

    return Math.abs(area / 2);
  };


  const sortedPolygons = [...allPolygons].sort(
    (a, b) => polygonArea(b) - polygonArea(a)
  );

  // 最大の地形を表示対象にする

  const polygons =
    geometry.type === "MultiPolygon"
      ? sortedPolygons.slice(0, 1)
      : sortedPolygons;


  const points = polygons.flat(2) as Position[];


  if (!points.length) return "";


  const longitudes = points.map((p) => p[0]);

  const latitudes = points.map((p) => p[1]);


  const minX = Math.min(...longitudes);

  const maxX = Math.max(...longitudes);

  const minY = Math.min(...latitudes);

  const maxY = Math.max(...latitudes);


  const rangeX = maxX - minX || 1;

  const rangeY = maxY - minY || 1;

  const padding = 3;


  const scale = Math.min(
    (width - padding * 2) / rangeX,
    (height - padding * 2) / rangeY
  );


  const offsetX = (width - rangeX * scale) / 2;

  const offsetY = (height - rangeY * scale) / 2;


  return polygons
    .map((polygon) =>
      polygon
        .map((ring) =>
          ring
            .map(([x, y], index) => {

              const px = (x - minX) * scale + offsetX;

              const py = (maxY - y) * scale + offsetY;

              return `${index === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`;
            })
            .join(" ") + " Z"
        )
        .join(" ")
    )
    .join(" ");
}

export default function TicketApp({ username }: { username: string }) {

  const ticketRef = useRef<HTMLDivElement>(null);

  const backRef = useRef<HTMLDivElement>(null);

  const formRef = useRef<HTMLElement>(null);

  const [origin, setOrigin] = useState("東京都");

  const [destination, setDestination] = useState("大阪府");

  const [oshi, setOshi] = useState("");

  const [event, setEvent] = useState("");
  const [venue, setVenue] = useState<Venue | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>("other");
  const [railwayId, setRailwayId] = useState("");
  const [ferryRoute, setFerryRoute] = useState("");

  const [date, setDate] = useState("");

  const [memory, setMemory] = useState("");

  const [photo, setPhoto] = useState("");

  const [color, setColor] = useState("#a48ae8");

  const [status, setStatus] = useState<TripStatus>("planned");

  const [tripType, setTripType] = useState<TripType>("daytrip");

  const [referenceYear, setReferenceYear] = useState(tourismYears[0]);

  const [actualTotal, setActualTotal] = useState("");

  const [ticketSide, setTicketSide] = useState<TicketSide>("front");

  const [downloading, setDownloading] = useState(false);

  const [savedTickets, setSavedTickets] = useState<SavedTicket[]>([]);

  const [selectedTicket, setSelectedTicket] = useState<SavedTicket | null>(null);

  const [selectedSide, setSelectedSide] = useState<TicketSide>("front");

  const [savingTicket, setSavingTicket] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);

  const [collectionFilter, setCollectionFilter] = useState<"all" | TripStatus>("all");

  const [storageError, setStorageError] = useState("");

  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string; } | null>(null);

  const [tourismData, setTourismData] = useState<TourismData | null>(null);

  const [pinnedBenchmark, setPinnedBenchmark] = useState<TourismData | null>(null);

  const [tourismError, setTourismError] = useState<{ key: string; text: string; } | null>(null);

  const [dataRefresh, setDataRefresh] = useState(0);

  const [mapFeatures, setMapFeatures] = useState<GeoFeature[]>([]);

  const [mapError, setMapError] = useState(false);

  const dataKey = `${destination}|${tripType}|${referenceYear}|${dataRefresh}`;

  const benchmark = tourismData?.prefecture === destination && tourismData.tripType === tripType && tourismData.year === referenceYear ? tourismData : null;

  const currentDataError = tourismError?.key === dataKey ? tourismError.text : "";

  let actualValue: number | null = null;

  let actualError = "";

  if (status === "completed") {

    try {
      actualValue = parseActualTotal(actualTotal);
    }
    catch (error) {
      actualError = error instanceof Error ? error.message : "実費を確認してください。";
    }
  }


  useEffect(() => {

    try {

      const raw = localStorage.getItem("oshi-journey-collection");

      if (!raw) return;

      const saved: unknown = JSON.parse(raw);

      if (!Array.isArray(saved) || !saved.every((ticket) => ticket && typeof ticket.id === "number" && ["oshi", "event", "origin", "destination", "date", "color", "memory", "image"].every((key) => typeof ticket[key] === "string"))) throw new Error("保存データの形式を確認してください。");
      // Browser-local collection is restored once after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSavedTickets(saved);
    } catch {

      setStorageError("保存データを読み込めませんでした。元のデータを保護するため、新規保存を停止しています。");
    }
  }, []);


  useEffect(() => {

    const controller = new AbortController();

    fetch("/data/prefectures.geojson", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("Map unavailable"); return response.json(); })
      .then((data: GeoJSONData) => setMapFeatures(data.features))
      .catch((error) => { if (error.name !== "AbortError") setMapError(true); });

    return () => controller.abort();
  }, []);


  useEffect(() => {

    if (pinnedBenchmark?.prefecture === destination && pinnedBenchmark.tripType === tripType && pinnedBenchmark.year === referenceYear) return;

    const controller = new AbortController();

    const params = new URLSearchParams({ prefecture: destination, type: tripType, year: String(referenceYear) });

    fetch(`/api/tourism?${params}`, { signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data as TourismData; })
      .then((data) => { if (!controller.signal.aborted) { setTourismData(data); setTourismError(null); } })
      .catch((error) => { if (!controller.signal.aborted) setTourismError({ key: dataKey, text: error instanceof Error ? error.message : "統計データを取得できませんでした。" }); });

    return () => controller.abort();
  }, [destination, tripType, referenceYear, dataKey, pinnedBenchmark]);


  useEffect(() => {

    if (!selectedTicket) return;

    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedTicket(null); };

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedTicket]);



  const destinationFeature = useMemo(() => mapFeatures.find((feature) => feature.properties.N03_001 === destination), [mapFeatures, destination]);


  const destinationPath = destinationFeature ? geometryToSvgPath(destinationFeature.geometry, 58, 88) : "";

  const seed = useMemo(() => hashString(`${origin}-${destination}-${oshi}-${event}`), [origin, destination, oshi, event]);

  const visibleTickets = savedTickets.filter((ticket) => collectionFilter === "all" || (ticket.status ?? "completed") === collectionFilter);


  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {

    const input = event.currentTarget;

    const file = input.files?.[0];

    if (!file) return;


    if (!file.type.startsWith("image/")) {

      alert("画像ファイルを選択してください。");

      input.value = "";

      return;
    }

    if (file.size > 8 * 1024 * 1024) {

      alert("写真は8MB以下のものを選択してください。");

      input.value = "";

      return;
    }


    try {

      const result = await new Promise<string>((resolve, reject) => {

        const reader = new FileReader();

        reader.onerror = () => reject(new Error("読み込み失敗"));

        reader.onload = () => {

          const image = new Image();

          image.onerror = () => reject(new Error("画像を開けません"));

          image.onload = () => {

            const scale = Math.min(1, 1200 / Math.max(image.width, image.height));

            const canvas = document.createElement("canvas");

            canvas.width = Math.round(image.width * scale);

            canvas.height = Math.round(image.height * scale);

            const context = canvas.getContext("2d");

            if (!context) {

              reject(new Error("画像を処理できません"));

              return;
            }

            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            resolve(canvas.toDataURL("image/jpeg", 0.82));
          };

          image.src = String(reader.result);
        };

        reader.readAsDataURL(file);
      });

      setPhoto(result);
    } catch (error) {

      console.error(error);

      alert("写真を読み込めませんでした。別の画像をお試しください。");
    } finally {

      input.value = "";
    }
  };


  const renderTicket = (node: HTMLDivElement, pixelRatio: number) => toPng(node, {
    width: PASSPORT_WIDTH, height: PASSPORT_HEIGHT, style: { transform: "none" }, pixelRatio, cacheBust: true,
  });


  const saveTicket = async () => {

    if (!ticketRef.current || !backRef.current || savingTicket || storageError) return;

    if (!oshi.trim() || !event.trim() || !date) {
      setNotice({ type: "error", text: "推しの名前・公演名・日付を入力してください。" });
      return;
    }

    if (!benchmark) {
      setNotice({ type: "error", text: "目的地の統計データを取得してから保存してください。" });
      return;
    }

    if (actualError) {
      setNotice({ type: "error", text: actualError });
      return;
    }

    if (editingId !== null && !savedTickets.some((ticket) => ticket.id === editingId)) {
      setNotice({ type: "error", text: "編集中の訪問ページが見つかりません。新規作成から登録してください。" });
      return;
    }

    const snapshot = {
      id: editingId ?? Date.now(), oshi: oshi.trim(), event: event.trim(), origin, destination, date, color,
      memory, photo, venue: venue ?? undefined, travelMode, railwayId, ferryRoute, format: "passport" as const,
      status, tripType, actualTotal: actualTotal.trim(), benchmark,
    };

    setSavingTicket(true);

    setNotice(null);

    try {

      const [image, backImage] = await Promise.all([renderTicket(ticketRef.current, 1), renderTicket(backRef.current, 1)]);

      const ticket: SavedTicket = { ...snapshot, image, backImage };

      const updated = editingId === null ? [ticket, ...savedTickets] : savedTickets.map((item) => item.id === editingId ? ticket : item);
      const previousBadgeIds = new Set(getEarnedJourneyBadges(savedTickets).map((badge) => badge.id));
      const newlyEarnedBadges = getEarnedJourneyBadges(updated).filter((badge) => !previousBadgeIds.has(badge.id));

      localStorage.setItem("oshi-journey-collection", JSON.stringify(updated));

      setSavedTickets(updated);

      setEditingId(ticket.id);

      setPinnedBenchmark(benchmark);

      const savedMessage = editingId !== null ? "訪問ページを更新しました。" : status === "planned" ? "遠征の予定を保存しました。帰ってきたら写真と実費を追記できます。" : "遠征の思い出を保存しました。";
      setNotice({ type: "success", text: newlyEarnedBadges.length ? `${savedMessage} バッジ獲得：${newlyEarnedBadges.map((badge) => `「${badge.name}」`).join("、")}` : savedMessage });
    } catch {

      setNotice({ type: "error", text: "保存できませんでした。ブラウザの保存容量を確認してください。" });
    } finally {
      setSavingTicket(false);
    }
  };


  const startNewTrip = () => {

    setEditingId(null);
    setOshi("");
    setEvent("");
    setVenue(null);
    setTravelMode("other"); setRailwayId(""); setFerryRoute("");
    setDate("");
    setMemory("");
    setPhoto("");
    setActualTotal("");

    setOrigin("東京都");
    setDestination("大阪府");
    setColor("#a48ae8");
    setStatus("planned");
    setTripType("daytrip");

    setReferenceYear(tourismYears[0]);
    setPinnedBenchmark(null);
    setTicketSide("front");
    setNotice(null);
  };


  const editTicket = (ticket: SavedTicket, complete = false) => {

    setEditingId(ticket.id);
    setOshi(ticket.oshi);
    setEvent(ticket.event);
    setVenue(ticket.venue ?? null);
    setTravelMode(ticket.travelMode ?? "other"); setRailwayId(ticket.railwayId ?? ""); setFerryRoute(ticket.ferryRoute ?? "");
    setOrigin(ticket.origin);
    setDestination(ticket.destination);

    setDate(ticket.date);
    setColor(ticket.color);
    setMemory(ticket.memory);
    setPhoto(ticket.photo ?? "");
    setActualTotal(ticket.actualTotal ?? "");

    setStatus(complete ? "completed" : ticket.status ?? "completed");
    setTripType(ticket.tripType ?? "daytrip");

    setReferenceYear(ticket.benchmark?.year ?? tourismYears[0]);
    setPinnedBenchmark(ticket.benchmark ?? null);

    if (ticket.benchmark) setTourismData(ticket.benchmark);

    setSelectedTicket(null);
    setNotice(null);
    setTicketSide(complete ? "back" : "front");

    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };


  const deleteTicket = (id: number) => {

    if (!confirm("この訪問ページを削除しますか？")) return;

    try {

      const updated = savedTickets.filter((ticket) => ticket.id !== id);

      localStorage.setItem("oshi-journey-collection", JSON.stringify(updated));

      setSavedTickets(updated);

      if (editingId === id) startNewTrip();
    } catch {
      setNotice({ type: "error", text: "訪問ページを削除できませんでした。" });
    }
  };


  const downloadTicket = async () => {

    const node = ticketSide === "front" ? ticketRef.current : backRef.current;

    if (!node || downloading) return;

    setDownloading(true);

    try {

      const dataUrl = await renderTicket(node, 3);

      const link = document.createElement("a");

      link.download = `oshi-passport-${date || "memory"}-${ticketSide}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setNotice({ type: "error", text: "画像を保存できませんでした。もう一度お試しください。" });
    }
    finally {
      setDownloading(false);
    }
  };

  // パスポートの各ページに渡す内容（画面のめくれる本と、PNG 保存用の見開きで共通）
  const spreadProps: PassportSpreadProps = { origin, destination, oshi, event, venueName: venue?.name, date, memory: status === "planned" ? "" : memory, photo: status === "completed" ? photo : "", color, seed, destinationPath, status, travelMode, ferryName: travelMode === "ferry" ? ferryRoute || "船旅" : undefined };
  const notesProps: PassportNotesProps = { destination, color, date, status, data: benchmark, actualTotal: actualValue, memory, travelMode, railway: railways.find((r) => r.id === railwayId), ferryRoute };

  return (
    <main className="page">

      <header className="header">
        <div className="logo">
          <span className="logoIcon">
            <BookOpen size={21} />
          </span>
          <span>OSHI PASSPORT</span>
        </div>
        <div className="headerUser"><span>{username}</span><form action={logout}><button type="submit" className="logoutButton"><LogOut size={14} />ログアウト</button></form></div>
      </header>

      <section className="hero">
        <div className="eyebrow">
          <Sparkles size={14} /> A JOURNEY TO YOUR OSHI</div>
        <h1>推しに会う旅を、<br />
          <span>パスポートに刻もう。</span>
        </h1>
        <p>遠征前は、旅先の宿泊傾向と寄り道をチェック。<br />帰ってきたら写真と実費を加えて、訪問スタンプを増やそう。</p>
      </section>

      <div className="workspace">

        <section className="formPanel" ref={formRef}>

          <fieldset className="tripFields" disabled={savingTicket}>

            <div className="sectionHeading">
              <span className="step">01</span>
              <div>
                <h2>{status === "planned" ? "遠征を準備する" : "思い出を記録する"}</h2>
                <p>{editingId !== null ? "保存済みの訪問ページを編集中です。" : "訪問ページの情報を入力してください。"}</p>
              </div>
            </div>
            {editingId !== null && <div className="editingBanner">
              <Pencil size={14} />訪問ページを編集中<button type="button" onClick={startNewTrip}>新規作成に戻る</button>
            </div>}
            <div className="tripPhase" aria-label="遠征の状態">
              <button type="button" aria-pressed={status === "planned"} onClick={() => setStatus("planned")}>遠征前・予定</button>
              <button type="button" aria-pressed={status === "completed"} onClick={() => setStatus("completed")}>遠征後・記録</button>
            </div>

            <ArtistSearch key={editingId ?? "new-trip"} value={oshi} onChange={setOshi} />

            <div className="field">
              <label htmlFor="event">イベント・ライブ名 <span className="requiredMark">必須</span>
              </label>
              <input id="event" value={event} onChange={(e) => setEvent(e.target.value)} placeholder="例：SPECIAL LIVE 2026" maxLength={40} required />
            </div>

            <VenueSearch key={editingId ?? "new-venue"} value={venue} onChange={setVenue} onSelect={(selected) => {
                setVenue(selected);
                if (selected.prefecture && prefectures.includes(selected.prefecture)) { setDestination(selected.prefecture); setPinnedBenchmark(null); }
            }} />

            <div className="field">
              <label htmlFor="date">公演・遠征の日付 <span className="requiredMark">必須</span>
              </label>
              <input id="date" type="date" value={date} onInput={(e) => setDate(e.currentTarget.value)} onChange={(e) => setDate(e.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="origin">出発地</label>
              <div className="selectWrap">
                <MapPin size={16} />
                <select id="origin" value={origin} onChange={(e) => setOrigin(e.target.value)}>{prefectures.map((p) =>
                  <option key={p}>{p}</option>)}</select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="destination">遠征先の都道府県</label>
              <div className="selectWrap">
                <MapPin size={16} />
                <select id="destination" value={destination} onChange={(e) => { setDestination(e.target.value); setPinnedBenchmark(null); if (venue?.prefecture && venue.prefecture !== e.target.value) setVenue(null); }}>{prefectures.map((p) =>
                  <option key={p}>{p}</option>)}</select>
              </div>
              <p className="destinationColorHint">
                <span style={{ backgroundColor: prefectureFlagColors[destination] }} />{destination}の旗色をグラデーションに使います</p>
            </div>

            <div className="field">
              <label htmlFor="travelMode">主な移動手段</label>
              <select id="travelMode" value={travelMode} onChange={(e) => setTravelMode(e.target.value as TravelMode)}>{Object.entries(travelModeNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
            </div>
            {travelMode === "train" && <div className="field">
              <label htmlFor="railway">利用した鉄道・路線（任意）</label>
              <select id="railway" value={railwayId} onChange={(e) => setRailwayId(e.target.value)}><option value="">事業者・路線を選択</option>{railways.map((railway) => <option key={railway.id} value={railway.id}>{railway.name} / {railway.jurisdiction}</option>)}</select>
              <p className="fieldHint">旅先ノートに旅客営業キロを記録します。事業者・路線全体の統計で、今回の乗車距離ではありません。</p>
            </div>}
            {travelMode === "ferry" && <div className="field">
              <label htmlFor="ferryRoute">利用した船・航路（任意）</label>
              <input id="ferryRoute" maxLength={40} value={ferryRoute} onChange={(e) => setFerryRoute(e.target.value)} placeholder="例：宮島口〜宮島" />
              <p className="fieldHint">船旅スタンプはご自身の利用記録に基づきます。公開航路データは地方単位に匿名化されており、実際の乗船確認には使いません。</p>
              <p className="ferryLearning">{ferryFacts(destination).region}を起終点に含む申請サンプル：{ferryFacts(destination).samples}件<br /><a href={ferryFacts(destination).sourceUrl} target="_blank" rel="noreferrer">Project LINKS 一般旅客定期航路事業データ</a> / 現在の航路数ではありません。</p>
            </div>}

            <div className="field">
              <label htmlFor="tripType">旅行の種類</label>
              <select id="tripType" value={tripType} onChange={(e) => { setTripType(e.target.value as TripType); setPinnedBenchmark(null); }}>
                <option value="daytrip">日帰り</option>
                <option value="overnight">宿泊あり</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="referenceYear">宿泊需要を比較する年（Project LINKS）</label>
              <select id="referenceYear" value={referenceYear} onChange={(e) => { setReferenceYear(Number(e.target.value)); setPinnedBenchmark(null); }}>{tourismYears.map((year, i) =>
                <option key={year} value={year}>{year}年{i === 0 ? "（収録データの最新年）" : ""}</option>)}</select>
            </div>

            <OshiColors value={color} onChange={setColor} />
            {status === "completed" ? <div className="afterTripFields">

              <h3>おかえりなさい。旅を記録しよう。</h3>

              <div className="field">
                <label htmlFor="actualTotal">実際にかかった費用の合計（円・1人分）</label>
                <input id="actualTotal" type="number" inputMode="numeric" min="0" step="1" value={actualTotal} onChange={(e) => setActualTotal(e.target.value)} placeholder="例：35000" aria-invalid={!!actualError} />
                <p className="fieldHint">交通・宿泊・飲食・入場券・グッズなど、1人分の総額。未入力と0円は区別して記録します。</p>{actualError && <p className="formError">{actualError}</p>}</div>

              <div className="field photoField">
                <label htmlFor="ticketPhoto">遠征の思い出写真（任意）</label>
                <input id="ticketPhoto" type="file" accept="image/*" onChange={handlePhotoChange} className="photoInput" />
                <p className="photoHelp">ライブ会場や旅先の写真を追加できます（8MBまで）。</p>{photo && <div className="photoPreview">
                  <img src={photo} alt="選択した思い出の写真" />
                  <button type="button" onClick={() => setPhoto("")}>写真を削除</button>
                </div>}</div>

              <div className="field">
                <label htmlFor="memory">思い出のひとこと</label>
                <textarea id="memory" value={memory} onChange={(e) => setMemory(e.target.value)} placeholder="あの日の思い出を一言で…" maxLength={55} rows={3} />
              </div>

            </div> : <div className="beforeTripNote">写真と実費は遠征後に追加できます。まずは予定を保存しておこう。</div>}
          </fieldset>

        </section>

        <section className="previewPanel">

          <div className="sectionHeading">
            <span className="step">02</span>
            <div>
              <h2>あなただけの推し旅パスポート</h2>
              <p>訪問スタンプと旅先の発見を、見開きのページに。</p>
            </div>
          </div>

          <div className="ticketTabs" role="tablist" aria-label="パスポートのページ">{(["front", "back"] as const).map((side) =>
            <button type="button" role="tab" aria-selected={ticketSide === side} key={side} onClick={() => setTicketSide(side)}>{side === "front" ? "訪問ページ · VISAS" : "旅先ノート · NOTES"}</button>)}</div>

          <PassportBook side={ticketSide} color={color} destination={destination} pages={[
            <IdentityPage key="01" {...spreadProps} />, <VisaPage key="02" {...spreadProps} />,
            <DestinationNotesPage key="03" {...notesProps} />, <MyJourneyPage key="04" {...notesProps} />]} />

          {/* PNG 保存用の見開き（画面の外に置く） */}
          <div className="ticketExportOnly" aria-hidden inert>
            <PassportSpread pageRef={ticketRef} {...spreadProps} />
          </div>
          <div className="ticketExportOnly" aria-hidden inert>
            <PassportNotes pageRef={backRef} {...notesProps} />
          </div>

          <StayInsights key={`${destination}/${date}/${referenceYear}`} prefecture={destination} date={date} year={referenceYear} />
          {currentDataError && <p className="dataSourceNote" role="status">{currentDataError}<button type="button" onClick={() => { setPinnedBenchmark(null); setDataRefresh((value) => value + 1); }}>再試行</button></p>}
          <button className="collectionSaveButton" onClick={saveTicket} disabled={savingTicket || !benchmark || !!storageError}>
            <Bookmark size={18} />{savingTicket ? "パスポートに記録中…" : editingId !== null ? "訪問ページを更新する" : status === "planned" ? "遠征の予定を保存する" : "遠征の思い出を保存する"}</button>

          <button className="downloadButton" onClick={downloadTicket} disabled={downloading}>
            <Download size={18} />{downloading ? "画像を作成中…" : `${ticketSide === "front" ? "訪問ページ" : "旅先ノート"}をPNGで保存`}</button>
          {notice && <p className={`saveNotice ${notice.type}`} role="status">{notice.text}</p>}
          {storageError && <p className="formError" role="alert">{storageError}</p>}
          {mapError && <p className="note">地図データを読み込めませんでした。再読み込みしてください。</p>}
          <p className="note">個人の旅の記録として楽しむ、推し旅パスポートです。</p>

          <NearbyMap venue={venue} />
          <LodgingInfo key={`${venue?.latitude}/${venue?.longitude}`} venue={venue} />

          <PassportProgress records={savedTickets} onOpen={(record) => { setSelectedTicket(record); setSelectedSide("front"); }} />

          <JourneyGps tickets={savedTickets} />

          <div className="collectionSection">

            <div className="collectionHeading">
              <div>
                <span className="collectionEyebrow">YOUR PASSPORT</span>
                <h2>MY JOURNEYS</h2>
              </div>
              <span className="collectionCount">{savedTickets.length} JOURNEYS</span>
            </div>

            <p className="collectionStorageNote">このブラウザに保存されます。予定の訪問ページを開くと、写真や実費を追記できます。</p>

            <div className="collectionFilters" aria-label="コレクションの絞り込み">{(["all", "planned", "completed"] as const).map((filter) =>
              <button type="button" key={filter} aria-pressed={collectionFilter === filter} onClick={() => setCollectionFilter(filter)}>{filter === "all" ? "すべて" : filter === "planned" ? "遠征予定" : "遠征済み"}</button>)}</div>
            {visibleTickets.length === 0 ? <div className="collectionEmpty">
              <BookOpen size={30} />
              <p>まだ訪問ページがありません。</p>
              <span>次の遠征の予定から、記録を始めよう。</span>
            </div> : <div className="collectionGrid">{visibleTickets.map((ticket) =>
              <article className="collectionCard" key={ticket.id}>
                <button type="button" className="collectionOpen" onClick={() => { setSelectedTicket(ticket); setSelectedSide("front"); }} aria-label={`${ticket.event}の訪問ページを開く`}>
                  <img src={ticket.image} alt={`${ticket.event}の記念訪問ページ`} />
                  <div className="collectionCardInfo">
                    <span className={`tripBadge ${ticket.status ?? "completed"}`}>{ticket.status === "planned" ? "遠征予定" : "遠征済み"}</span>
                    <strong>{ticket.event || "イベント名未設定"}</strong>
                    <span>{ticket.oshi || "推し未設定"}</span>
                    <small>{ticket.origin} → {ticket.destination}</small>
                    <small>{ticket.date || "日付未設定"}</small>
                  </div>
                </button>
                <button type="button" className="deleteTicketButton" onClick={() => deleteTicket(ticket.id)} aria-label={`${ticket.event}の訪問ページを削除`}>
                  <Trash2 size={16} />
                </button>
              </article>)}</div>}
            <button type="button" className="newTripButton" onClick={() => { startNewTrip(); formRef.current?.scrollIntoView({ behavior: "smooth" }); }}>
              <Plus size={16} />新しい遠征を作る</button>

          </div>

        </section>

      </div>
      {selectedTicket && <div className="ticketModalOverlay" onClick={() => setSelectedTicket(null)}>
        <div className="ticketModal" role="dialog" aria-modal="true" aria-label="訪問ページの詳細" onClick={(event) => event.stopPropagation()}>
          <button className="ticketModalClose" onClick={() => setSelectedTicket(null)} aria-label="閉じる">×</button>
          <span className={`tripBadge ${selectedTicket.status ?? "completed"}`}>{selectedTicket.status === "planned" ? "遠征予定" : "遠征済み"}</span>
          <h2>MY PASSPORT</h2>
          <div className="ticketTabs" role="tablist" aria-label="保存済みパスポートのページ">{(["front", "back"] as const).map((side) =>
            <button type="button" role="tab" key={side} aria-selected={selectedSide === side} onClick={() => setSelectedSide(side)}>{side === "front" ? "訪問ページ" : "旅先ノート"}</button>)}</div>{selectedSide === "front" || selectedTicket.backImage ? <img className="ticketModalImage" src={selectedSide === "front" ? selectedTicket.image : selectedTicket.backImage} alt={`${selectedTicket.event}の${selectedSide === "front" ? "訪問ページ" : "旅先ノート"}`} /> : <p className="fieldHint">以前の記録には旅先ノートがありません。編集して保存すると追加できます。</p>}<div className="ticketModalDetails">
            <div>
              <span>ARTIST / OSHI</span>
              <strong>{selectedTicket.oshi}</strong>
            </div>
            <div>
              <span>EVENT</span>
              <strong>{selectedTicket.event}</strong>
            </div>
            <div>
              <span>DATE</span>
              <strong>{selectedTicket.date}</strong>
            </div>
            <div>
              <span>JOURNEY</span>
              <strong>{selectedTicket.origin} → {selectedTicket.destination}</strong>
            </div>
            <div className="ticketModalMemory">
              <span>YOUR MEMORY</span>
              <p>{selectedTicket.memory || "写真と思い出は遠征後に追加できます。"}</p>
            </div>
          </div>{selectedTicket.venue && <><p className="savedVenue"><MapPin size={15} />{selectedTicket.venue.name}</p><NearbyMap venue={selectedTicket.venue} /></>}{selectedTicket.status === "planned" && <button className="downloadButton" onClick={() => editTicket(selectedTicket, true)}>
            <Pencil size={16} />写真・実費を記録する</button>}<button className="ticketModalCloseButton" onClick={() => editTicket(selectedTicket)}>{selectedTicket.status === "planned" ? "予定の内容を編集する" : "記録を編集する"}</button>
          <button className="modalDismissButton" onClick={() => setSelectedTicket(null)}>閉じる</button>
        </div>
      </div>}
      <footer className="footer">OSHI PASSPORT · TRAVEL STORIES WITH PROJECT LINKS</footer>

    </main>
  );
}
