"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { logout } from "./auth-actions";
import { toPng } from "html-to-image";
import { Download, MapPin, Sparkles, BookOpen, Bookmark, Trash2, Plus, Pencil, LogOut } from "lucide-react";
import { PassportSpread, IdentityPage, VisaPage, PASSPORT_WIDTH, PASSPORT_HEIGHT, travelModeNames, type PassportSpreadProps, type TravelMode } from "./passport-spread";
import { PassportNotes, DestinationNotesPage, MyJourneyPage, type PassportNotesProps } from "./passport-notes";
import { PassportBook } from "./passport-book";
import { createPassportSounds } from "./passport-sounds";
import { PassportCoverIntro } from "./passport-cover-intro";
import { PassportProgress } from "./passport-progress";
import { getEarnedJourneyBadges } from "./journey-badges";
import { railways, ferryFacts } from "./travel-data";
import { ArtistSearch } from "./artist-search";
import { SetlistSearch } from "./setlist-search";
import { normalizeSetlist, parseSetlist } from "./setlist";
import { StayInsights } from "./stay-insights";
import { OshiColors } from "./oshi-colors";
import { VenueSearch } from "./venue-search";
import { NearbyMap } from "./nearby-map";
import { LodgingInfo } from "./lodging-info";
import { JourneyGps, type GpsStatus } from "./JourneyGps";
import { hasCoordinates, type Venue } from "./map-utils";
import { prefectureFlagColors } from "./prefecture-colors";
import { artistGenres, prefectures, tourismYears, parseActualTotal, type SavedTicket, type TourismData, type TripType, type TripStatus, type TicketSide } from "./trip-data";

const introBgm = "/sounds/sunlit-passport-intro.wav";
const mainBgm = "/sounds/dawn-passport.mp3";

const pageTabs = [
  { id: "prepare", label: "遠征を準備する" },
  { id: "venue", label: "会場周辺" },
  { id: "account", label: "YOUR PASSPORT" },
  { id: "gps", label: "GPS" },
] as const;

type PageTab = (typeof pageTabs)[number]["id"];

// まだ押印していない記録を画像にするとき、画面に出ていないスタンプまわり（スタンプ・船旅スタンプ・押す道具・周りの光）を外す
const UNSTAMPED_EXPORT_HIDDEN_CLASSES = ["visitStamp", "ferryStamp", "visitStampTool", "passportStampAura"];

// 押印の演出が終わりの合図（animationend）を出さなくても、保存できないままにならないよう打ち切るまでの時間。
// CSS の visitStampImpact は 0.8 秒、めくってから押すときは --stamp-delay 0.85 秒が足されて約 1.7 秒。CSS の時間を延ばすときはここも延ばす
const STAMP_IMPACT_TIMEOUT_MS = 3000;

function sameVenue(a: Venue | undefined, b: Venue | null) {
  if (!a || !b) return false;
  if (a.id && b.id && a.source === b.source) return a.id === b.id;
  const normalize = (name: string) =>
    name.normalize("NFKC").toLocaleLowerCase().replace(/[\s・･_-]/g, "");
  if (normalize(a.name) !== normalize(b.name)) return false;
  return !a.prefecture || !b.prefecture || a.prefecture === b.prefecture;
}

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
  const passportTabsRef = useRef<HTMLDivElement>(null);
  const [stampImpact, setStampImpact] = useState<{ count: number; afterPageTurn: boolean; ticketId: number }>();

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
  const [outfitGenre, setOutfitGenre] = useState("");
  const [outfitDetails, setOutfitDetails] = useState("");
  const outfitMemo = outfitDetails.trim();
  const outfit = outfitGenre || outfitMemo ? { genre: outfitGenre, details: outfitMemo } : undefined;
  const [setlistText, setSetlistText] = useState("");
  const [setlistSource, setSetlistSource] = useState<string>();
  const [linkedConcert, setLinkedConcert] = useState<{ id: string; artist: string; date: string }>();
  const setlistFmId = linkedConcert?.artist === oshi.trim() && linkedConcert.date === date ? linkedConcert.id : undefined;
  const setlist = useMemo(() => parseSetlist(setlistText), [setlistText]);
  const normalizedSetlist = normalizeSetlist(oshi, setlistText);

  const [photo, setPhoto] = useState("");

  const [color, setColor] = useState("#a48ae8");

  const [status, setStatus] = useState<TripStatus>("planned");

  const [tripType, setTripType] = useState<TripType>("daytrip");

  const [referenceYear, setReferenceYear] = useState(tourismYears[0]);

  const [actualTotal, setActualTotal] = useState("");

  const [ticketSide, setTicketSide] = useState<TicketSide>("front");
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const passportSounds = useRef<ReturnType<typeof createPassportSounds>>(null);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const bgm = useRef<HTMLAudioElement>(null);

  const playBgm = useCallback((src: string, loop: boolean) => {
    const player = bgm.current;
    if (!player) return;

    if (player.getAttribute("src") !== src) player.src = src;
    player.loop = loop;
    player.volume = 0.24;
    void player.play().catch(() => {});
  }, []);

  const startIntroBgm = useCallback(() => playBgm(introBgm, false), [playBgm]);
  const startMainBgm = useCallback(() => playBgm(mainBgm, true), [playBgm]);

  const toggleBgm = () => {
    if (bgm.current?.paused) startMainBgm();
    else bgm.current?.pause();
  };

  useEffect(() => () => passportSounds.current?.dispose(), []);

  const preparePassportSounds = () => {
    if (soundsEnabled && !passportSounds.current) {
      passportSounds.current = createPassportSounds();
    }
  };

  const togglePassportSounds = () => {
    if (soundsEnabled) {
      passportSounds.current?.dispose();
      passportSounds.current = null;
    } else {
      passportSounds.current = createPassportSounds();
    }
    setSoundsEnabled(!soundsEnabled);
  };

  const turnPassportPage = (side: TicketSide) => {
    if (side !== ticketSide) {
      preparePassportSounds();
      passportSounds.current?.play("pageTurn");
    }
    setTicketSide(side);
  };

  const [downloading, setDownloading] = useState(false);

  const [savedTickets, setSavedTickets] = useState<SavedTicket[]>([]);

  const [selectedTicket, setSelectedTicket] = useState<SavedTicket | null>(null);

  const [selectedSide, setSelectedSide] = useState<TicketSide>("front");

  const [savingTicket, setSavingTicket] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const savedVisit = savedTickets.find((ticket) => ticket.id === editingId);
  const isStamped = status === "completed" && !!savedVisit && savedVisit.status !== "planned"
    && savedVisit.destination === destination && savedVisit.date === date;

  const [collectionFilter, setCollectionFilter] = useState<"all" | TripStatus>("all");

  const [activeTab, setActiveTab] = useState<PageTab>("prepare");

  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");

  const pageTabRefs = useRef<(HTMLButtonElement | null)[]>([]);

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

  // フォームは「遠征を準備する」タブにあるので、タブを切り替えて表示されてからスクロールする
  const showPrepareForm = () => {
    setActiveTab("prepare");
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  // 保存中（PNG 化の途中）は切り替えない。押印の演出中に離れるときは演出を打ち切る
  // （非表示になるとアニメーションが止まり、終わりの合図が来ないため。保存はもう済んでいるので、移った先にモーダルは出さない）
  const switchTab = (id: PageTab) => {
    if (savingTicket) return false;
    if (stampImpact && id !== "prepare") setStampImpact(undefined);
    setActiveTab(id);
    return true;
  };

  const handlePageTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    // Alt+← などのブラウザ操作は止めない
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    let nextIndex: number;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % pageTabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + pageTabs.length) % pageTabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = pageTabs.length - 1;
    else return;

    event.preventDefault();
    if (switchTab(pageTabs[nextIndex].id)) pageTabRefs.current[nextIndex]?.focus();
  };


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


  const renderTicket = (node: HTMLDivElement, pixelRatio: number, includeStamp = true) => toPng(node, {
    width: PASSPORT_WIDTH, height: PASSPORT_HEIGHT, style: { transform: "none" }, pixelRatio, cacheBust: true,
    // まだ押印していない記録の画像には、スタンプとその周りの光を入れない
    filter: includeStamp ? undefined : (element) => !UNSTAMPED_EXPORT_HIDDEN_CLASSES.some((name) => element.classList?.contains(name)),
  });


  const openSavedTicket = (ticket: SavedTicket) => {
    setStampImpact(undefined);
    setSelectedSide("front");
    setSelectedTicket(ticket);
  };

  const finishStampImpact = () => {
    const ticket = savedTickets.find((record) => record.id === stampImpact?.ticketId);
    if (ticket) openSavedTicket(ticket);
    else setStampImpact(undefined);
  };

  // 終わりの合図が来なくても、一定時間で押印の演出を終えて保存済みのページを開く（finishStampImpact と同じ動き）
  useEffect(() => {
    if (!stampImpact) return;
    const ticket = savedTickets.find((record) => record.id === stampImpact.ticketId);
    const timer = window.setTimeout(() => {
      setStampImpact(undefined);
      if (ticket) { setSelectedSide("front"); setSelectedTicket(ticket); }
    }, STAMP_IMPACT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [stampImpact, savedTickets]);

  const canPressStamp = status === "completed" && !isStamped;
  const saveDisabled = savingTicket || !!stampImpact || !benchmark || !!storageError;
  const showSaveButton = (!canPressStamp || ticketSide === "back") && !stampImpact;
  // 訪問ページのスタンプ欄が押せないときは、その理由を出す（保存領域のエラーは下に別に出る）
  const stampHint = !canPressStamp || ticketSide !== "front" || savingTicket || stampImpact || storageError ? ""
    : benchmark ? "訪問ページのスタンプ欄をタッチして記録"
    : currentDataError ? "旅先の統計を読み込めないため記録できません。「再試行」を押してください"
    : "旅先の統計を読み込んでいます…";

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

    if (editingId !== null && !savedVisit) {
      setNotice({ type: "error", text: "編集中の訪問ページが見つかりません。新規作成から登録してください。" });
      return;
    }

    const snapshot = {
      id: editingId ?? Date.now(), oshi: oshi.trim(), event: event.trim(), origin, destination, date, color,
      memory, photo, venue: venue ?? undefined, travelMode, railwayId, ferryRoute, format: "passport" as const,
      outfit,
      setlist,
      setlistFmId,
      setlistSource: setlist.length ? setlistSource : undefined,
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

      if (ticket.status === "completed" && !isStamped) {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        setTicketSide("front");
        if (reduceMotion) {
          passportSounds.current?.play("stamp");
          openSavedTicket(ticket);
        } else {
          if (ticketSide === "back") passportSounds.current?.play("pageTurn");
          setStampImpact((last) => ({
            count: (last?.count ?? 0) + 1,
            afterPageTurn: ticketSide === "back",
            ticketId: ticket.id,
          }));
          passportTabsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
        }
      }

      const stamped = ticket.status === "completed" && !isStamped;
      const savedMessage = stamped ? "遠征の思い出を記録しました。" : editingId !== null ? "訪問ページを更新しました。" : status === "planned" ? "遠征の予定を保存しました。帰ってきたら写真と実費を追記できます。" : "遠征の思い出を保存しました。";
      setNotice({ type: "success", text: newlyEarnedBadges.length ? `${savedMessage} バッジ獲得：${newlyEarnedBadges.map((badge) => `「${badge.name}」`).join("、")}` : savedMessage });
    } catch {

      setNotice({ type: "error", text: "保存できませんでした。ブラウザの保存容量を確認してください。" });
    } finally {
      setSavingTicket(false);
    }
  };


  const startNewTrip = () => {
    setStampImpact(undefined);

    setEditingId(null);
    setOshi("");
    setEvent("");
    setVenue(null);
    setTravelMode("other"); setRailwayId(""); setFerryRoute("");
    setDate("");
    setMemory("");
    setOutfitGenre("");
    setOutfitDetails("");
    setSetlistText("");
    setSetlistSource(undefined);
    setLinkedConcert(undefined);
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
    setStampImpact(undefined);

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
    setOutfitGenre(ticket.outfit?.genre ?? "");
    setOutfitDetails(ticket.outfit?.details ?? "");
    setSetlistText((ticket.setlist ?? []).join("\n"));
    setSetlistSource(ticket.setlistSource);
    setLinkedConcert(ticket.setlistFmId ? { id: ticket.setlistFmId, artist: ticket.oshi.trim(), date: ticket.date } : undefined);
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

    showPrepareForm();
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

      const dataUrl = await renderTicket(node, 3, isStamped);

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
  const venueVisitCount = venue
    ? savedTickets.filter((record) =>
        record.id !== editingId &&
        (record.status ?? "completed") === "completed" &&
        sameVenue(record.venue, venue)
      ).length + (status === "completed" ? 1 : 0)
    : 0;

  const spreadProps: PassportSpreadProps = { origin, destination, oshi, event, venueName: venue?.name, date, memory: status === "planned" ? "" : memory, photo: status === "completed" ? photo : "", color, seed, destinationPath, status, visitCount: venueVisitCount, travelMode, ferryName: travelMode === "ferry" ? ferryRoute || "船旅" : undefined };
  const notesProps: PassportNotesProps = { destination, color, date, status, data: benchmark, actualTotal: actualValue, memory, outfit, setlist, setlistSource, travelMode, railway: railways.find((r) => r.id === railwayId), ferryRoute, visitCount: venueVisitCount };

  return (
    <main className="page">
      <audio ref={bgm} src={introBgm} preload="metadata"
        onPlaying={() => setBgmPlaying(true)} onPause={() => setBgmPlaying(false)} onError={() => setBgmPlaying(false)} />
      <PassportCoverIntro username={username} onSoundReplay={startIntroBgm} onSoundFinish={startMainBgm} />

      <header className="header">
        <div className="logo">
          <span className="logoIcon">
            <BookOpen size={21} />
          </span>
          <span>OSHI PASSPORT</span>
        </div>
        <nav className="pageNav" role="tablist" aria-label="メインメニュー">
          {pageTabs.map((tab, index) => <button
            key={tab.id}
            ref={(element) => { pageTabRefs.current[index] = element; }}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            aria-label={tab.id === "gps" && gpsStatus !== "idle" ? `GPS（${gpsStatus === "alert" ? "記録に注意あり" : "記録中"}）` : undefined}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => switchTab(tab.id)}
            onKeyDown={(event) => handlePageTabKeyDown(event, index)}
          >{tab.label}{tab.id === "gps" && gpsStatus !== "idle" && <span className={`pageNavStatus ${gpsStatus}`} aria-hidden="true" />}</button>)}
        </nav>
        <div className="headerUser">
          <span>{username}</span>
          <button type="button" className="logoutButton" aria-label="BGM" aria-pressed={bgmPlaying} onClick={toggleBgm}>
            BGM {bgmPlaying ? "オン" : "オフ"}
          </button>
          <form action={logout}><button type="submit" className="logoutButton"><LogOut size={14} />ログアウト</button></form>
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow">
          <Sparkles size={14} /> A JOURNEY TO YOUR OSHI</div>
        <h1>推しに会う旅を、<br />
          <span>パスポートに刻もう。</span>
        </h1>
        <p>遠征前は、旅先の宿泊傾向と寄り道をチェック。<br />帰ってきたら写真と実費を加えて、訪問スタンプを増やそう。</p>
      </section>

      <div className="workspace" id="tabpanel-prepare" role="tabpanel" aria-labelledby="tab-prepare" hidden={activeTab !== "prepare"}>

        <section className="formPanel" id="journey-prep" ref={formRef}>

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
              <button type="button" aria-pressed={status === "planned"} onClick={() => { setStampImpact(undefined); setStatus("planned"); }}>遠征前・予定</button>
              <button type="button" aria-pressed={status === "completed"} onClick={() => setStatus("completed")}>遠征後・記録</button>
            </div>

            {/* 記録を切り替えたら検索候補を消すために key を変える。兄弟の VenueSearch と同じ key にならないよう接頭辞を付ける */}
            <ArtistSearch key={`artist-${editingId ?? "new"}`} value={oshi} onChange={setOshi} />

            <div className="field">
              <label htmlFor="event">イベント・ライブ名 <span className="requiredMark">必須</span>
              </label>
              <input id="event" value={event} onChange={(e) => setEvent(e.target.value)} placeholder="例：SPECIAL LIVE 2026" maxLength={40} required />
            </div>

            <VenueSearch key={`venue-${editingId ?? "new"}`} value={venue} onChange={setVenue} onSelect={(selected) => {
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
            <div className="field">
              <label htmlFor="outfitGenre">アーティストのジャンル（任意）</label>
              <select id="outfitGenre" value={outfitGenre} onChange={(event) => setOutfitGenre(event.target.value)}>
                <option value="">選択しない</option>
                {outfitGenre && !artistGenres.includes(outfitGenre) && (
                  <option value={outfitGenre}>以前の服装分類（{outfitGenre}）</option>
                )}
                {artistGenres.map((genre) => <option key={genre}>{genre}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="outfitDetails">服装メモ（任意）</label>
              <textarea id="outfitDetails" value={outfitDetails} onChange={(event) => setOutfitDetails(event.target.value)} maxLength={200} rows={2} placeholder="例：ツアーTシャツ、黒のパンツ、白のスニーカー" />
            </div>
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

              <SetlistSearch
                key={JSON.stringify([editingId, oshi, date])}
                artist={oshi}
                date={date}
                concertId={setlistFmId}
                onImport={(id, songs, sourceUrl) => {
                  if (setlistText.trim() && !window.confirm("入力済みのセットリストをこの公演の曲順に置き換えますか？")) return;
                  setSetlistText(songs.join("\n"));
                  setSetlistSource(sourceUrl);
                  setLinkedConcert({ id, artist: oshi.trim(), date });
                  setTicketSide("back");
                }}
                onSelect={(id) => {
                  setLinkedConcert({ id, artist: oshi.trim(), date });
                  setTicketSide("back");
                }}
              />
              {setlistFmId && <div className="artistSearchRow">
                <button type="button" onClick={() => setLinkedConcert(undefined)}>公演のひも付けを解除</button>
              </div>}
              <div className="field">
                <label htmlFor="setlist">セットリスト（任意）</label>
                <textarea
                  id="setlist"
                  value={setlistText}
                  onChange={(event) => {
                    const text = event.target.value;
                    setSetlistText(text);
                    if (!text.trim()) setSetlistSource(undefined);
                  }}
                  placeholder="1行に1曲、演奏順に入力"
                  maxLength={5000}
                  rows={5}
                  aria-describedby="setlist-help"
                />
                <p id="setlist-help" className="photoHelp">対応曲を公式表記に変換できます。変換後も編集できます。</p>
                <div className="artistSearchRow">
                  <button
                    type="button"
                    disabled={normalizedSetlist === parseSetlist(setlistText).join("\n")}
                    onClick={() => setSetlistText(normalizedSetlist)}
                  >
                    曲名を公式表記に変換
                  </button>
                </div>
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
            <button type="button" className="logoutButton passportSoundsToggle" aria-label="効果音" aria-pressed={soundsEnabled} onClick={togglePassportSounds}>
              効果音 {soundsEnabled ? "オン" : "オフ"}
            </button>
          </div>

          <div ref={passportTabsRef} className="ticketTabs" role="tablist" aria-label="パスポートのページ">{(["front", "back"] as const).map((side) =>
            <button type="button" role="tab" aria-selected={ticketSide === side} key={side} onClick={() => turnPassportPage(side)}>{side === "front" ? "訪問ページ · VISAS" : "旅先ノート · NOTES"}</button>)}</div>

          <PassportBook side={ticketSide} color={color} destination={destination} pages={[
            <IdentityPage key="01" {...spreadProps} />, <VisaPage key="02" {...spreadProps} stampVisible={isStamped} stampImpact={stampImpact} onStampLanded={finishStampImpact}
              onStampContact={() => passportSounds.current?.play("stamp")}
              onStampPress={canPressStamp && ticketSide === "front" ? () => {
                preparePassportSounds();
                void saveTicket();
              } : undefined} stampPressDisabled={saveDisabled} />,
            <DestinationNotesPage key="03" {...notesProps} />, <MyJourneyPage key="04" {...notesProps} />]} />

          {stampHint && <p className="passportStampHint">{stampHint}</p>}
          {!showSaveButton && (savingTicket || stampImpact) && <p className="passportStampHint" role="status">{savingTicket ? "パスポートに記録中…" : "スタンプを押しています…"}</p>}
          {/* 訪問ページではスタンプ欄をタッチして記録する。旅先ノート側（写真・実費の追記）ではボタンで記録し、訪問ページへめくってから押印する */}
          {showSaveButton && (
            <button className="collectionSaveButton" onClick={saveTicket} disabled={saveDisabled}>
              <Bookmark size={18} />{savingTicket ? "パスポートに記録中…" : canPressStamp ? "遠征の思い出を記録する" : editingId !== null ? "訪問ページを更新する" : "遠征の予定を保存する"}
            </button>
          )}
          {notice && <p className={`saveNotice ${notice.type}`} role="status">{notice.text}</p>}

          {/* PNG 保存用の見開き（画面の外に置く） */}
          <div className="ticketExportOnly" aria-hidden inert>
            <PassportSpread pageRef={ticketRef} {...spreadProps} />
          </div>
          <div className="ticketExportOnly" aria-hidden inert>
            <PassportNotes pageRef={backRef} {...notesProps} />
          </div>

          {ticketSide === "back" && status === "completed" && setlistFmId && (
            <section className="passportSetlist" aria-label="公演のセットリスト">
              <b>SETLIST / 公演のセットリスト</b>
              <SetlistSearch key={setlistFmId} artist={oshi} date={date} concertId={setlistFmId} />
            </section>
          )}

          <StayInsights key={`${destination}/${date}/${referenceYear}`} prefecture={destination} date={date} year={referenceYear} />
          {currentDataError && <p className="dataSourceNote" role="status">{currentDataError}<button type="button" onClick={() => { setPinnedBenchmark(null); setDataRefresh((value) => value + 1); }}>再試行</button></p>}
          <button className="downloadButton" onClick={downloadTicket} disabled={downloading}>
            <Download size={18} />{downloading ? "画像を作成中…" : `${ticketSide === "front" ? "訪問ページ" : "旅先ノート"}をPNGで保存`}</button>
          {storageError && <p className="formError" role="alert">{storageError}</p>}
          {mapError && <p className="note">地図データを読み込めませんでした。再読み込みしてください。</p>}
          <p className="note">個人の旅の記録として楽しむ、推し旅パスポートです。</p>
        </section>

      </div>
      <div className="journeySections" hidden={activeTab === "prepare"}>
        <section className="tripSupportPanel" id="tabpanel-venue" role="tabpanel" aria-labelledby="tab-venue" hidden={activeTab !== "venue"}>
          <div className="accountSectionHeading">
            <span className="collectionEyebrow">PLAN YOUR LIVE TRIP</span>
            <h2 id="tripSupportHeading">ライブ前後の寄り道・移動・宿泊</h2>
            <p>会場周辺のスポット、レンタカー、宿泊先をまとめてチェック。</p>
            {!hasCoordinates(venue) && <button type="button" className="tripSupportVenueLink" onClick={showPrepareForm}>「遠征を準備する」で会場を選ぶ</button>}
          </div>
          <NearbyMap venue={venue} />
          <LodgingInfo key={`${venue?.latitude}/${venue?.longitude}`} venue={venue} />
        </section>

        <div className="journeyPanel" id="tabpanel-gps" role="tabpanel" aria-labelledby="tab-gps" hidden={activeTab !== "gps"}>
          <JourneyGps tickets={savedTickets} onStatusChange={setGpsStatus} />
        </div>

        <section className="accountPage" id="tabpanel-account" role="tabpanel" aria-labelledby="tab-account" hidden={activeTab !== "account"}>
          <header className="accountPageHeading">
            <div>
              <span className="collectionEyebrow">YOUR PASSPORT</span>
              <h2 id="accountPageHeading">MY JOURNEYS</h2>
              <p>{username}さんの推し旅と訪問スタンプ</p>
            </div>
            <div className="accountJourneyCount">
              <strong>{savedTickets.length}</strong>
              <span>JOURNEYS</span>
            </div>
          </header>
          <PassportProgress records={savedTickets} onOpen={openSavedTicket} />
          <div className="collectionSection">
            <div className="collectionHeading">
              <div>
                <span className="collectionEyebrow">TRAVEL LOG</span>
                <h2>遠征の記録</h2>
              </div>
              <span className="collectionCount">{savedTickets.length} JOURNEYS</span>
            </div>
            <p className="collectionStorageNote">このブラウザに保存されます。予定の訪問ページを開くと、写真や実費を追記できます。</p>
            {/* 読み込み・削除の失敗はこのタブにも出す（準備タブにしか出さないと、記録が消えたように見える） */}
            {storageError && <p className="formError" role="alert">{storageError}</p>}
            {notice?.type === "error" && <p className="saveNotice error" role="status">{notice.text}</p>}
            <div className="collectionFilters" aria-label="コレクションの絞り込み">{(["all", "planned", "completed"] as const).map((filter) =>
              <button type="button" key={filter} aria-pressed={collectionFilter === filter} onClick={() => setCollectionFilter(filter)}>{filter === "all" ? "すべて" : filter === "planned" ? "遠征予定" : "遠征済み"}</button>)}</div>
            {visibleTickets.length === 0 ? <div className="collectionEmpty">
              <BookOpen size={30} />
              <p>まだ訪問ページがありません。</p>
              <span>次の遠征の予定から、記録を始めよう。</span>
            </div> : <div className="collectionGrid">{visibleTickets.map((ticket) =>
              <article className="collectionCard" key={ticket.id}>
                <button type="button" className="collectionOpen" onClick={() => openSavedTicket(ticket)} aria-label={`${ticket.event}の訪問ページを開く`}>
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
            <button type="button" className="newTripButton" onClick={() => { startNewTrip(); showPrepareForm(); }}>
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
            {selectedTicket.outfit && (
              <div className="ticketModalMemory">
                <span>服装</span>
                {selectedTicket.outfit.genre && (
                  <strong>
                    {artistGenres.includes(selectedTicket.outfit.genre) ? "アーティストのジャンル" : "以前の服装分類"} · {selectedTicket.outfit.genre}
                  </strong>
                )}
                {selectedTicket.outfit.details && <p>{selectedTicket.outfit.details}</p>}
              </div>
            )}
            {selectedTicket.setlist && selectedTicket.setlist.length > 0 && (
              <div className="ticketModalMemory">
                <span>セットリスト</span>
                <ol className="ticketSetlist">
                  {selectedTicket.setlist.map((song, index) => (
                    <li key={index}>{song}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
          {selectedSide === "back" && selectedTicket.setlistFmId && (
            <section className="passportSetlist" aria-label="公演のセットリスト">
              <b>SETLIST / 公演のセットリスト</b>
              <SetlistSearch key={selectedTicket.setlistFmId} artist={selectedTicket.oshi} date={selectedTicket.date} concertId={selectedTicket.setlistFmId} />
            </section>
          )}
          {selectedTicket.venue && <><p className="savedVenue"><MapPin size={15} />{selectedTicket.venue.name}</p><NearbyMap venue={selectedTicket.venue} /></>}{selectedTicket.status === "planned" && <button className="downloadButton" onClick={() => editTicket(selectedTicket, true)}>
            <Pencil size={16} />写真・実費を記録する</button>}<button className="ticketModalCloseButton" onClick={() => editTicket(selectedTicket)}>{selectedTicket.status === "planned" ? "予定の内容を編集する" : "記録を編集する"}</button>
          <button className="modalDismissButton" onClick={() => setSelectedTicket(null)}>閉じる</button>
        </div>
      </div>}
      <footer className="footer">OSHI PASSPORT · TRAVEL STORIES WITH PROJECT LINKS</footer>

    </main>
  );
}
