"use client";

import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { LocateFixed, MapPin, Play, Square, Trash2, TriangleAlert, ZoomIn, ZoomOut } from "lucide-react";
import type { SavedTicket } from "./trip-data";

const MAX_TRACK_ACCURACY_METERS = 100;
const TRACK_RECORD_INTERVAL_MS = 30000;
const MAX_GPS_FIX_AGE_MS = 45000;
const TRACK_GAP_WARNING_MS = 120000;

type GpsJourney = {
  id: number;
  ticketId: number;
  event: string;
  date: string;
  origin: string;
  destination: string;
  venueName: string | null;
  startedAt: number;
  endedAt: number | null;
  pointCount: number;
  lastCapturedAt: number | null;
};

type GpsPoint = {
  id: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: number;
  kind: "track" | "checkin";
  verified: number | null;
  distanceMeters: number | null;
};

type GpsDetails = { journey: GpsJourney; points: GpsPoint[] };
type CheckinResult = { sessionId: number; verified: boolean; distanceMeters: number | null; reason: string | null };
type GpsPosition = { latitude: number; longitude: number; accuracy: number };
type WakeLockSentinel = { release: () => Promise<void>; addEventListener: (type: "release", listener: () => void) => void };
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> } };
type MapTile = { url: string; x: number; y: number; key: string };

function splitTrackSegments(points: GpsPoint[]) {
  const track = points.filter((point) => point.kind === "track");
  const segments: GpsPoint[][] = [];
  for (const point of track) {
    const current = segments.at(-1);
    const previous = current?.at(-1);
    if (point.accuracy > MAX_TRACK_ACCURACY_METERS) {
      if (current?.length) segments.push([]);
      continue;
    }
    if (!current || !previous || point.capturedAt - previous.capturedAt > TRACK_GAP_WARNING_MS) {
      segments.push([point]);
    } else {
      current.push(point);
    }
  }
  return segments.filter((segment) => segment.length > 0);
}

function RouteSketch({ points }: { points: GpsPoint[] }) {
  const segments = splitTrackSegments(points);
  const drawable = segments.filter((segment) => segment.length >= 2);
  const [tileError, setTileError] = useState(false);
  const [zoomOffset, setZoomOffset] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);
  if (!drawable.length) {
    return <p className="gpsRouteEmpty">地図上に線を描くには、精度100m以内の記録地点が2つ以上必要です。</p>;
  }

  const routePoints = drawable.flat();
  const width = 600;
  const height = 220;
  const padding = 40;
  const projectWorld = (latitude: number, longitude: number, zoom: number) => {
    const worldSize = 256 * 2 ** zoom;
    const clampedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
    const sinLatitude = Math.sin(clampedLatitude * Math.PI / 180);
    return {
      x: (longitude + 180) / 360 * worldSize,
      y: (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * worldSize,
    };
  };
  let fitZoom = 18;
  let worldPoints = routePoints.map((point) => projectWorld(point.latitude, point.longitude, fitZoom));
  for (; fitZoom > 3; fitZoom--) {
    worldPoints = routePoints.map((point) => projectWorld(point.latitude, point.longitude, fitZoom));
    const rangeX = Math.max(...worldPoints.map((point) => point.x)) - Math.min(...worldPoints.map((point) => point.x));
    const rangeY = Math.max(...worldPoints.map((point) => point.y)) - Math.min(...worldPoints.map((point) => point.y));
    if (rangeX <= width - padding * 2 && rangeY <= height - padding * 2) break;
  }
  worldPoints = routePoints.map((point) => projectWorld(point.latitude, point.longitude, fitZoom));
  const fitCenterX = (Math.min(...worldPoints.map((point) => point.x)) + Math.max(...worldPoints.map((point) => point.x))) / 2;
  const fitCenterY = (Math.min(...worldPoints.map((point) => point.y)) + Math.max(...worldPoints.map((point) => point.y))) / 2;
  const zoom = Math.max(3, Math.min(19, fitZoom + zoomOffset));
  const zoomScale = 2 ** (zoom - fitZoom);
  const originX = fitCenterX * zoomScale - width / 2 - pan.x;
  const originY = fitCenterY * zoomScale - height / 2 - pan.y;
  const project = (point: Pick<GpsPoint, "latitude" | "longitude">) => {
    const world = projectWorld(point.latitude, point.longitude, zoom);
    return { x: world.x - originX, y: world.y - originY };
  };

  const firstTileX = Math.floor(originX / 256);
  const lastTileX = Math.floor((originX + width) / 256);
  const firstTileY = Math.floor(originY / 256);
  const lastTileY = Math.floor((originY + height) / 256);
  const tileCount = 2 ** zoom;
  const tiles: MapTile[] = [];
  for (let tileY = firstTileY; tileY <= lastTileY; tileY++) {
    if (tileY < 0 || tileY >= tileCount) continue;
    for (let tileX = firstTileX; tileX <= lastTileX; tileX++) {
      const wrappedX = (tileX % tileCount + tileCount) % tileCount;
      tiles.push({
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`,
        x: tileX * 256 - originX,
        y: tileY * 256 - originY,
        key: `${zoom}/${wrappedX}/${tileY}`,
      });
    }
  }

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setZoomOffset((current) => Math.max(3 - fitZoom, Math.min(19 - fitZoom, current + (event.deltaY < 0 ? 1 : -1))));
  };
  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const activeDrag = drag.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setPan({
      x: activeDrag.panX + (event.clientX - activeDrag.x) * width / bounds.width,
      y: activeDrag.panY + (event.clientY - activeDrag.y) * height / bounds.height,
    });
  };
  const changeZoom = (change: number) => {
    setZoomOffset((current) => Math.max(3 - fitZoom, Math.min(19 - fitZoom, current + change)));
  };

  return <div className="gpsRoute">
    <div className="gpsMapViewport" onWheel={onWheel}>
    <svg className={drag.current ? "isDragging" : ""} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="記録できたGPS地点をつないだ地図。ドラッグで移動できます。"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }}>
      <rect className="gpsMapWater" x="1" y="1" width={width - 2} height={height - 2} rx="12" />
      {tiles.map((tile) => <image
        key={tile.key}
        href={tile.url}
        x={tile.x}
        y={tile.y}
        width="256"
        height="256"
        preserveAspectRatio="none"
        onError={() => setTileError(true)}
      />)}
      {drawable.map((segment, index) => {
        const coordinates = segment.map(project);
        const start = coordinates[0];
        const end = coordinates[coordinates.length - 1];
        return <g key={`${segment[0].id}-${index}`}>
          {coordinates.length > 1 && <polyline points={coordinates.map(({ x, y }) => `${x},${y}`).join(" ")} />}
          <circle className="gpsRouteStart" cx={start.x} cy={start.y} r="6" />
          <circle className="gpsRouteEnd" cx={end.x} cy={end.y} r="5" />
        </g>;
      })}
    </svg>
    <div className="gpsMapControls" aria-label="地図操作">
      <button type="button" aria-label="地図を拡大" title="拡大" disabled={zoom >= 19} onClick={() => changeZoom(1)}><ZoomIn size={17} /></button>
      <button type="button" aria-label="地図を縮小" title="縮小" disabled={zoom <= 3} onClick={() => changeZoom(-1)}><ZoomOut size={17} /></button>
      <button type="button" aria-label="経路全体を表示" title="経路全体を表示" onClick={() => { setZoomOffset(0); setPan({ x: 0, y: 0 }); }}><LocateFixed size={16} /></button>
      <span>ズーム {zoom}</span>
    </div>
    </div>
    <p className="gpsMapHelp">地図をドラッグして移動 · ＋／−またはホイールで拡大・縮小</p>
    <div className="gpsRouteLegend"><span><i className="gpsRouteStart" />記録開始側</span><span><i className="gpsRouteEnd" />記録終了側</span><small>{drawable.length > 1 ? `${drawable.length}区間。間の空白は記録が途切れた区間です。` : "地図データ © OpenStreetMap contributors"}</small></div>
    <a className="gpsMapAttribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
    {tileError && <p className="gpsTileError" role="status">地図タイルを読み込めませんでした。通信環境を確認してください。GPS記録地点は一覧で確認できます。</p>}
  </div>;
}

async function responseJson<T>(response: Response): Promise<T> {
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "GPS記録を処理できませんでした。");
  return data;
}

function getCurrentPosition(): Promise<GpsPosition> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(new Error("GPS記録にはHTTPS接続が必要です。"));
      return;
    }
    if (!navigator.geolocation) {
      reject(new Error("このブラウザは位置情報に対応していません。"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
      (error) => reject(new Error(error.code === error.PERMISSION_DENIED
        ? "位置情報の利用が許可されていません。ブラウザの設定を確認してください。"
        : error.code === error.TIMEOUT ? "現在地を取得できませんでした。電波状況を確認して再試行してください。" : "位置情報を取得できませんでした。")),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  });
}

// 別のタブを見ている間も、記録中か・注意が出ているかをタブに出すための状態
export type GpsStatus = "idle" | "tracking" | "alert";

export function JourneyGps({ tickets, onStatusChange }: { tickets: SavedTicket[]; onStatusChange?: (status: GpsStatus) => void }) {
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [journeys, setJourneys] = useState<GpsJourney[]>([]);
  const [details, setDetails] = useState<GpsDetails | null>(null);
  const [tracking, setTracking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [trackingWarning, setTrackingWarning] = useState("");
  const [screenWarning, setScreenWarning] = useState("");
  const [lastPositionAt, setLastPositionAt] = useState<number | null>(null);
  const watchId = useRef<number | null>(null);
  const recordInterval = useRef<number | null>(null);
  const latestPosition = useRef<GpsPosition | null>(null);
  const latestFixAt = useRef(0);
  const lastPersistedAt = useRef(0);
  const savingPoint = useRef(false);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const activeJourney = journeys.find((journey) => String(journey.ticketId) === selectedTicketId && journey.endedAt === null);
  const selectedTicket = tickets.find((ticket) => String(ticket.id) === selectedTicketId);
  // エラーは記録が止まったとき（tracking=false）にも出す。画面点灯の注意は常に出るブラウザがあるので含めない
  const status: GpsStatus = error || (tracking && trackingWarning) ? "alert" : tracking ? "tracking" : "idle";

  useEffect(() => { onStatusChange?.(status); }, [status, onStatusChange]);

  const refreshJourneys = async () => {
    const data = await responseJson<{ journeys: GpsJourney[] }>(await fetch("/api/gps", { cache: "no-store" }));
    setJourneys(data.journeys);
  };

  useEffect(() => {
    void fetch("/api/gps", { cache: "no-store" })
      .then(responseJson<{ journeys: GpsJourney[] }>)
      .then((data) => setJourneys(data.journeys))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "GPS記録を読み込めませんでした。"));
  }, []);

  useEffect(() => () => {
    if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
    if (recordInterval.current !== null) window.clearInterval(recordInterval.current);
    void wakeLock.current?.release();
  }, []);

  useEffect(() => {
    if (!tracking) return;
    const screenWakeLock = (navigator as WakeLockNavigator).wakeLock;
    let disposed = false;

    const requestWakeLock = async () => {
      if (document.visibilityState !== "visible") return;
      if (!screenWakeLock) {
        setScreenWarning("このブラウザは画面点灯の維持に対応していません。画面が消えると記録が中断する場合があります。");
        return;
      }
      try {
        const sentinel = await screenWakeLock.request("screen");
        if (disposed) {
          await sentinel.release();
          return;
        }
        wakeLock.current = sentinel;
        sentinel.addEventListener("release", () => {
          if (!disposed && document.visibilityState === "visible") {
            wakeLock.current = null;
            setScreenWarning("画面点灯の維持が解除されました。記録が中断していないか確認してください。");
          }
        });
        setScreenWarning("");
      } catch {
        setScreenWarning("画面点灯を維持できませんでした。画面が消えると記録が中断する場合があります。");
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setScreenWarning("アプリがバックグラウンドになりました。ブラウザの制限で記録が止まる場合があります。");
        void wakeLock.current?.release();
        wakeLock.current = null;
        return;
      }
      if (Date.now() - lastPersistedAt.current > TRACK_GAP_WARNING_MS) {
        setTrackingWarning("前回の記録から2分以上空いています。この間の経路は記録されていない可能性があります。");
      }
      void requestWakeLock();
    };

    void requestWakeLock();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void wakeLock.current?.release();
      wakeLock.current = null;
    };
  }, [tracking]);

  useEffect(() => {
    if (!tracking) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastPersistedAt.current > TRACK_GAP_WARNING_MS) {
        setTrackingWarning("2分以上、新しい位置を保存できていません。GPS精度や通信状況を確認してください。");
      }
    }, 15000);
    return () => window.clearInterval(interval);
  }, [tracking]);

  const clearWatch = () => {
    if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
    if (recordInterval.current !== null) window.clearInterval(recordInterval.current);
    watchId.current = null;
    recordInterval.current = null;
    setTracking(false);
  };

  const journeyInput = (ticket: SavedTicket) => ({
    ticketId: ticket.id,
    event: ticket.event,
    date: ticket.date,
    origin: ticket.origin,
    destination: ticket.destination,
    venueName: ticket.venue?.name ?? null,
    venueLatitude: ticket.venue?.latitude ?? null,
    venueLongitude: ticket.venue?.longitude ?? null,
  });

  const postPoint = async (sessionId: number, position: GpsPosition) => {
    await responseJson(await fetch("/api/gps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "point", sessionId, position }),
    }));
  };

  const beginTracking = async () => {
    if (!selectedTicket || busy || tracking) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const position = await getCurrentPosition();
      const result = await responseJson<{ sessionId: number }>(await fetch("/api/gps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activeJourney
          ? { action: "point", sessionId: activeJourney.id, position }
          : { action: "start", journey: journeyInput(selectedTicket), position }),
      }));
      const sessionId = activeJourney?.id ?? result.sessionId;
      const startedAt = Date.now();
      lastPersistedAt.current = startedAt;
      latestPosition.current = position;
      latestFixAt.current = startedAt;
      setLastPositionAt(startedAt);
      setTrackingWarning(position.accuracy > MAX_TRACK_ACCURACY_METERS
        ? `現在のGPS精度は約${Math.round(position.accuracy)}mです。精度が100mを超える地点は軌跡表示から除外します。`
        : "");
      const watch = navigator.geolocation.watchPosition(
        ({ coords }) => {
          latestPosition.current = { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy };
          latestFixAt.current = Date.now();
        },
        (cause) => {
          clearWatch();
          setError(cause.code === cause.PERMISSION_DENIED
            ? "位置情報の利用が許可されていません。記録を再開するにはブラウザの設定を確認してください。"
            : "GPS位置を取得できなくなりました。記録を再開してください。");
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 },
      );
      watchId.current = watch;
      recordInterval.current = window.setInterval(() => {
        const now = Date.now();
        const latest = latestPosition.current;
        if (document.visibilityState !== "visible") return;
        if (!latest || now - latestFixAt.current > MAX_GPS_FIX_AGE_MS) {
          setTrackingWarning("新しいGPS位置を取得できていないため、この回は保存できませんでした。位置取得が戻るまでお待ちください。");
          return;
        }
        if (latest.accuracy > MAX_TRACK_ACCURACY_METERS) {
          setTrackingWarning(`GPS精度が約${Math.round(latest.accuracy)}mのため、この回は保存しません。精度が100m以内に戻るまでお待ちください。`);
          return;
        }
        if (savingPoint.current) return;
        savingPoint.current = true;
        void postPoint(sessionId, latest)
          .then(() => {
            lastPersistedAt.current = now;
            setLastPositionAt(now);
            setTrackingWarning("");
            void refreshJourneys().catch(() => setTrackingWarning("位置は保存されましたが、履歴の表示を更新できませんでした。"));
          })
          .catch((cause: unknown) => {
            setTrackingWarning(cause instanceof Error ? cause.message : "GPS位置を保存できませんでした。");
          })
          .finally(() => { savingPoint.current = false; });
      }, TRACK_RECORD_INTERVAL_MS);
      setTracking(true);
      setNotice("GPS記録中です。新しいGPS位置を30秒ごとに保存します。");
      await refreshJourneys();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "GPS記録を開始できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const stopTracking = async () => {
    if (!activeJourney || busy) return;
    setBusy(true);
    setError("");
    clearWatch();
    try {
      await responseJson(await fetch("/api/gps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", sessionId: activeJourney.id }),
      }));
      setNotice("GPS記録を停止しました。");
      setTrackingWarning("");
      setScreenWarning("");
      await refreshJourneys();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "GPS記録を停止できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const checkIn = async () => {
    if (!selectedTicket || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const position = await getCurrentPosition();
      const result = await responseJson<CheckinResult>(await fetch("/api/gps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkin", journey: journeyInput(selectedTicket), position }),
      }));
      setNotice(result.verified
        ? `会場付近でチェックインしました（会場まで約${Math.round(result.distanceMeters ?? 0)}m）。`
        : `チェックイン位置を記録しました。${result.reason ?? "会場付近であることを確認できませんでした。"}`);
      await refreshJourneys();
      const data = await responseJson<GpsDetails>(await fetch(`/api/gps?sessionId=${result.sessionId}`, { cache: "no-store" }));
      setDetails(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "チェックインを記録できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const openDetails = async (journey: GpsJourney) => {
    setError("");
    try {
      const data = await responseJson<GpsDetails>(await fetch(`/api/gps?sessionId=${journey.id}`, { cache: "no-store" }));
      setDetails(details?.journey.id === journey.id ? null : data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "GPS記録を読み込めませんでした。");
    }
  };

  const deleteJourney = async (journey: GpsJourney) => {
    if (!window.confirm(`${journey.event}のGPS記録と位置情報を削除しますか？`)) return;
    setError("");
    if (activeJourney?.id === journey.id) clearWatch();
    try {
      await responseJson(await fetch(`/api/gps?sessionId=${journey.id}`, { method: "DELETE" }));
      if (details?.journey.id === journey.id) setDetails(null);
      await refreshJourneys();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "GPS記録を削除できませんでした。");
    }
  };

  return <section className="gpsPanel" id="gps-tracking" aria-labelledby="gpsHeading">
    <div className="gpsPanelHeading">
      <span className="gpsPanelIcon"><MapPin size={18} /></span>
      <div><h2 id="gpsHeading">GPSで旅の軌跡を記録</h2><p>位置情報は記録中のみ取得し、アカウントに保存します。</p></div>
    </div>
    {tickets.length > 0 ? <>
      <label className="gpsSelectLabel" htmlFor="gpsTicket">記録する遠征</label>
      <select id="gpsTicket" className="gpsSelect" value={selectedTicketId} disabled={tracking || busy} onChange={(event) => { setSelectedTicketId(event.target.value); setError(""); setNotice(""); }}>
        <option value="">訪問ページを選択</option>
        {tickets.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.event} · {ticket.date || "日付未設定"}</option>)}
      </select>
      <div className="gpsActions">
        <button type="button" className="gpsActionButton" onClick={beginTracking} disabled={!selectedTicket || busy || tracking}>
          <Play size={15} />{busy ? "位置を取得中…" : activeJourney ? "記録を再開" : "軌跡の記録を開始"}
        </button>
        <button type="button" className="gpsActionButton secondary" onClick={checkIn} disabled={!selectedTicket || busy}>
          <MapPin size={15} />到着チェックイン
        </button>
        {activeJourney && <button type="button" className="gpsActionButton stop" onClick={stopTracking} disabled={busy}>
          <Square size={14} />記録を停止
        </button>}
      </div>
      {tracking && <p className="gpsLiveStatus" role="status"><span />GPS記録中</p>}
      {tracking && <p className="gpsLastPosition">最後に保存した位置：{lastPositionAt || activeJourney?.lastCapturedAt ? new Date(lastPositionAt ?? activeJourney?.lastCapturedAt ?? 0).toLocaleTimeString("ja-JP") : "取得待ち"}</p>}
      {trackingWarning && <p className="gpsTrackingWarning" role="status"><TriangleAlert size={15} />{trackingWarning}</p>}
      {tracking && screenWarning && <p className="gpsTrackingWarning" role="status"><TriangleAlert size={15} />{screenWarning}</p>}
      <p className="gpsPrivacyNote">画面点灯に対応するブラウザでは、記録中に画面が消えにくくなるようにします（電池を消費します）。到着確認は登録会場から100m以内かつGPS精度100m以内で判定します。GPS記録は端末の位置情報に基づくもので、改ざんできない証明ではありません。</p>
      <p className="gpsLimitNote">新しいGPS位置を30秒ごとに保存します。位置取得が止まった場合や精度が100mを超える場合は、その回を保存せずお知らせします。Webアプリは画面ロック中やバックグラウンドで動作が止まることがあるため、記録中は画面を開いたままにし、復帰後に最終保存時刻をご確認ください。未記録の区間を推測でつなぐことはしません。</p>
    </> : <p className="gpsPrivacyNote">先に遠征の訪問ページを保存すると、GPS記録を始められます。</p>}
    {notice && <p className="gpsNotice" role="status">{notice}</p>}
    {error && <p className="gpsError" role="alert">{error}</p>}
    <div className="gpsHistory">
      <h3>アカウントのGPS記録</h3>
      {journeys.length === 0 ? <p className="gpsEmpty">まだGPS記録はありません。</p> : journeys.map((journey) => <article className="gpsRecord" key={journey.id}>
        <div className="gpsRecordHeader">
          <button type="button" className="gpsRecordOpen" onClick={() => void openDetails(journey)}>
            <strong>{journey.event || "イベント名未設定"}</strong>
            <span>{journey.origin} → {journey.destination} · {journey.date}</span>
            <small>{new Date(journey.startedAt).toLocaleString("ja-JP")} · {journey.pointCount}地点{journey.endedAt === null ? ` · ${tracking && selectedTicketId === String(journey.ticketId) ? "記録中" : "再開待ち"}` : ""}{journey.lastCapturedAt ? ` · 最終位置 ${new Date(journey.lastCapturedAt).toLocaleTimeString("ja-JP")}` : ""}</small>
          </button>
          <button type="button" className="gpsDeleteButton" onClick={() => void deleteJourney(journey)} aria-label={`${journey.event}のGPS記録を削除`}><Trash2 size={15} /></button>
        </div>
        {details?.journey.id === journey.id && <>
          <RouteSketch points={details.points} />
          <p className="gpsRouteSummary">{details.points.filter((point) => point.kind === "track").length}地点を保存 · 精度100m以内の連続地点だけを線で表示</p>
          <ol className="gpsPointList">
          {details.points.map((point, index) => {
            const previousTrack = details.points.slice(0, index).reverse().find((candidate) => candidate.kind === "track");
            const currentIsTrack = point.kind === "track" && point.accuracy <= MAX_TRACK_ACCURACY_METERS;
            const timeGap = previousTrack ? point.capturedAt - previousTrack.capturedAt : 0;
            const gap = currentIsTrack && previousTrack
              && (timeGap > TRACK_GAP_WARNING_MS || previousTrack.accuracy > MAX_TRACK_ACCURACY_METERS);
            return <li key={point.id}>
            {gap && <span className="gpsGapMarker">{timeGap > TRACK_GAP_WARNING_MS ? `記録の空白（${Math.round(timeGap / 60000)}分）` : "GPS精度不足による空白"} —この区間の経路は表示していません</span>}
            <span className="gpsPointKind">{point.kind === "checkin" ? "チェックイン" : "軌跡"}</span>
            <time>{new Date(point.capturedAt).toLocaleString("ja-JP")}</time>
            <span>{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)} · 精度±{Math.round(point.accuracy)}m</span>
            {point.kind === "track" && point.accuracy > MAX_TRACK_ACCURACY_METERS && <strong className="unverified">精度が低いため経路図から除外</strong>}
            {point.kind === "checkin" && <strong className={point.verified === 1 ? "verified" : "unverified"}>
              {point.verified === 1 ? `会場付近（約${Math.round(point.distanceMeters ?? 0)}m）` : point.verified === null ? "会場位置なし・未確認" : "会場付近を確認できず"}
            </strong>}
          </li>;
          })}
          </ol>
        </>}
      </article>)}
    </div>
  </section>;
}
