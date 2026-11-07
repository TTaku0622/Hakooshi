import { getCurrentUserOrNull } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Position = { latitude: number; longitude: number; accuracy: number };
type JourneyInput = {
  ticketId: number;
  event: string;
  date: string;
  origin: string;
  destination: string;
  venueName: string | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
};

const noStore = { "Cache-Control": "no-store" };
const MAX_POINTS_PER_JOURNEY = 10000;
const MIN_POINT_INTERVAL_MS = 10000;
const CHECKIN_RADIUS_METERS = 100;

function validPosition(value: unknown): value is Position {
  if (!value || typeof value !== "object") return false;
  const position = value as Record<string, unknown>;
  return typeof position.latitude === "number" && Number.isFinite(position.latitude)
    && position.latitude >= -90 && position.latitude <= 90
    && typeof position.longitude === "number" && Number.isFinite(position.longitude)
    && position.longitude >= -180 && position.longitude <= 180
    && typeof position.accuracy === "number" && Number.isFinite(position.accuracy)
    && position.accuracy >= 0 && position.accuracy <= 10000;
}

function validId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function validJourneyInput(value: unknown): value is JourneyInput {
  if (!value || typeof value !== "object") return false;
  const journey = value as Record<string, unknown>;
  const validVenueCoordinates = journey.venueLatitude === null && journey.venueLongitude === null
    || typeof journey.venueLatitude === "number" && Number.isFinite(journey.venueLatitude)
      && journey.venueLatitude >= -90 && journey.venueLatitude <= 90
      && typeof journey.venueLongitude === "number" && Number.isFinite(journey.venueLongitude)
      && journey.venueLongitude >= -180 && journey.venueLongitude <= 180;
  return Number.isSafeInteger(journey.ticketId) && (journey.ticketId as number) > 0
    && typeof journey.event === "string" && journey.event.length <= 100
    && typeof journey.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(journey.date)
    && typeof journey.origin === "string" && journey.origin.length <= 60
    && typeof journey.destination === "string" && journey.destination.length <= 60
    && (journey.venueName === null || typeof journey.venueName === "string" && journey.venueName.length <= 200)
    && validVenueCoordinates;
}

function haversineMeters(a: Position, latitude: number, longitude: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLatitude = radians(latitude - a.latitude);
  const deltaLongitude = radians(longitude - a.longitude);
  const value = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

async function authenticatedUser() {
  const user = await getCurrentUserOrNull();
  if (!user) return null;
  return user;
}

export async function GET(request: Request) {
  const user = await authenticatedUser();
  if (!user) return Response.json({ error: "ログインしてください。" }, { status: 401, headers: noStore });

  const params = new URL(request.url).searchParams;
  const sessionIdParam = params.get("sessionId");
  const db = getDb();

  if (sessionIdParam) {
    const sessionId = Number(sessionIdParam);
    if (!Number.isSafeInteger(sessionId) || sessionId <= 0) {
      return Response.json({ error: "GPS記録を確認してください。" }, { status: 400, headers: noStore });
    }
    const journey = db.prepare(
      `SELECT j.id, j.ticket_id AS ticketId, j.event, j.journey_date AS date, j.origin, j.destination,
        j.venue_name AS venueName, j.venue_latitude AS venueLatitude, j.venue_longitude AS venueLongitude,
        j.started_at AS startedAt, j.ended_at AS endedAt, COUNT(p.id) AS pointCount,
        MAX(p.captured_at) AS lastCapturedAt
       FROM gps_journeys j LEFT JOIN gps_points p ON p.journey_id = j.id
       WHERE j.id = ? AND j.user_id = ? GROUP BY j.id`
    ).get(sessionId, user.id);
    if (!journey) return Response.json({ error: "GPS記録が見つかりません。" }, { status: 404, headers: noStore });
    const points = db.prepare(
      `SELECT id, latitude, longitude, accuracy, captured_at AS capturedAt, kind,
        verified, distance_meters AS distanceMeters
       FROM gps_points WHERE journey_id = ? ORDER BY captured_at, id`
    ).all(sessionId);
    return Response.json({ journey, points }, { headers: noStore });
  }

  const journeys = db.prepare(
    `SELECT j.id, j.ticket_id AS ticketId, j.event, j.journey_date AS date, j.origin, j.destination,
      j.venue_name AS venueName, j.started_at AS startedAt, j.ended_at AS endedAt,
      COUNT(p.id) AS pointCount, MAX(p.captured_at) AS lastCapturedAt
     FROM gps_journeys j LEFT JOIN gps_points p ON p.journey_id = j.id
     WHERE j.user_id = ? GROUP BY j.id ORDER BY j.started_at DESC LIMIT 100`
  ).all(user.id);
  return Response.json({ journeys }, { headers: noStore });
}

export async function POST(request: Request) {
  const user = await authenticatedUser();
  if (!user) return Response.json({ error: "ログインしてください。" }, { status: 401, headers: noStore });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "送信データを読み取れませんでした。" }, { status: 400, headers: noStore });
  }

  const db = getDb();
  const now = Date.now();

  if (body.action === "start") {
    if (!validJourneyInput(body.journey) || !validPosition(body.position)) {
      return Response.json({ error: "遠征情報またはGPS位置を確認してください。" }, { status: 400, headers: noStore });
    }
    const input = body.journey;
    const existing = db.prepare(
      "SELECT id FROM gps_journeys WHERE user_id = ? AND ticket_id = ? AND ended_at IS NULL"
    ).get(user.id, input.ticketId) as { id: number } | undefined;
    let journeyId = existing?.id;
    if (!journeyId) {
      const result = db.prepare(
        `INSERT INTO gps_journeys
         (user_id, ticket_id, event, journey_date, origin, destination, venue_name, venue_latitude, venue_longitude, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(user.id, input.ticketId, input.event, input.date, input.origin, input.destination,
        input.venueName, input.venueLatitude, input.venueLongitude, now);
      journeyId = Number(result.lastInsertRowid);
    }
    const point = body.position as Position;
    db.prepare(
      "INSERT INTO gps_points (journey_id, latitude, longitude, accuracy, captured_at, kind) VALUES (?, ?, ?, ?, ?, 'track')"
    ).run(journeyId, point.latitude, point.longitude, point.accuracy, now);
    return Response.json({ sessionId: journeyId }, { headers: noStore });
  }

  if (body.action === "point") {
    const sessionId = body.sessionId;
    const position = body.position;
    if (!validId(sessionId) || !validPosition(position)) {
      return Response.json({ error: "GPS位置を確認してください。" }, { status: 400, headers: noStore });
    }
    const journey = db.prepare(
      "SELECT id FROM gps_journeys WHERE id = ? AND user_id = ? AND ended_at IS NULL"
    ).get(sessionId, user.id) as { id: number } | undefined;
    if (!journey) return Response.json({ error: "記録中の遠征が見つかりません。" }, { status: 404, headers: noStore });
    const count = db.prepare("SELECT COUNT(*) AS count FROM gps_points WHERE journey_id = ?").get(journey.id) as { count: number };
    if (count.count >= MAX_POINTS_PER_JOURNEY) {
      return Response.json({ error: "この遠征のGPS記録上限に達しました。記録を停止してください。" }, { status: 429, headers: noStore });
    }
    const latest = db.prepare(
      "SELECT captured_at AS capturedAt FROM gps_points WHERE journey_id = ? AND kind = 'track' ORDER BY captured_at DESC LIMIT 1"
    ).get(journey.id) as { capturedAt: number } | undefined;
    if (latest && now - latest.capturedAt < MIN_POINT_INTERVAL_MS) {
      return Response.json({ error: "GPS位置の記録間隔が短すぎます。" }, { status: 429, headers: noStore });
    }
    db.prepare(
      "INSERT INTO gps_points (journey_id, latitude, longitude, accuracy, captured_at, kind) VALUES (?, ?, ?, ?, ?, 'track')"
    ).run(journey.id, position.latitude, position.longitude, position.accuracy, now);
    return Response.json({ recorded: true }, { headers: noStore });
  }

  if (body.action === "stop") {
    const sessionId = body.sessionId;
    if (!validId(sessionId)) {
      return Response.json({ error: "GPS記録を確認してください。" }, { status: 400, headers: noStore });
    }
    const result = db.prepare(
      "UPDATE gps_journeys SET ended_at = ? WHERE id = ? AND user_id = ? AND ended_at IS NULL"
    ).run(now, sessionId, user.id);
    if (!result.changes) return Response.json({ error: "記録中の遠征が見つかりません。" }, { status: 404, headers: noStore });
    return Response.json({ stopped: true }, { headers: noStore });
  }

  if (body.action === "checkin") {
    const position = body.position;
    if (!validJourneyInput(body.journey) || !validPosition(position)) {
      return Response.json({ error: "遠征情報またはGPS位置を確認してください。" }, { status: 400, headers: noStore });
    }
    const input = body.journey;
    const row = db.prepare(
      "SELECT id FROM gps_journeys WHERE user_id = ? AND ticket_id = ? ORDER BY started_at DESC LIMIT 1"
    ).get(user.id, input.ticketId) as { id: number } | undefined;
    let journeyId = row?.id;
    if (!journeyId) {
      const result = db.prepare(
        `INSERT INTO gps_journeys
         (user_id, ticket_id, event, journey_date, origin, destination, venue_name, venue_latitude, venue_longitude, started_at, ended_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(user.id, input.ticketId, input.event, input.date, input.origin, input.destination,
        input.venueName, input.venueLatitude, input.venueLongitude, now, now);
      journeyId = Number(result.lastInsertRowid);
    } else {
      db.prepare(
        "UPDATE gps_journeys SET venue_name = ?, venue_latitude = ?, venue_longitude = ? WHERE id = ? AND user_id = ?"
      ).run(input.venueName, input.venueLatitude, input.venueLongitude, journeyId, user.id);
    }
    const venue = input.venueLatitude !== null && input.venueLongitude !== null
      ? { latitude: input.venueLatitude, longitude: input.venueLongitude }
      : null;
    const distanceMeters = venue
      ? haversineMeters(position, venue.latitude, venue.longitude)
      : null;
    const verified = distanceMeters !== null && distanceMeters <= CHECKIN_RADIUS_METERS && position.accuracy <= CHECKIN_RADIUS_METERS;
    db.prepare(
      `INSERT INTO gps_points (journey_id, latitude, longitude, accuracy, captured_at, kind, verified, distance_meters)
       VALUES (?, ?, ?, ?, ?, 'checkin', ?, ?)`
    ).run(journeyId, position.latitude, position.longitude, position.accuracy,
      now, venue ? Number(verified) : null, distanceMeters);
    return Response.json(
      { sessionId: journeyId, verified, distanceMeters, reason: !venue ? "会場位置が登録されていません。" : !verified ? "登録会場から100m以内であることを確認できませんでした。" : null },
      { headers: noStore }
    );
  }

  return Response.json({ error: "GPS操作を確認してください。" }, { status: 400, headers: noStore });
}

export async function DELETE(request: Request) {
  const user = await authenticatedUser();
  if (!user) return Response.json({ error: "ログインしてください。" }, { status: 401, headers: noStore });

  const sessionId = Number(new URL(request.url).searchParams.get("sessionId"));
  if (!Number.isSafeInteger(sessionId) || sessionId <= 0) {
    return Response.json({ error: "GPS記録を確認してください。" }, { status: 400, headers: noStore });
  }
  const result = getDb().prepare("DELETE FROM gps_journeys WHERE id = ? AND user_id = ?").run(sessionId, user.id);
  if (!result.changes) return Response.json({ error: "GPS記録が見つかりません。" }, { status: 404, headers: noStore });
  return Response.json({ deleted: true }, { headers: noStore });
}
