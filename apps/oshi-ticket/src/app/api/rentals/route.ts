import { readFile } from "node:fs/promises";
import path from "node:path";
import { distanceMeters, type Coordinates } from "../../map-utils";

type RentalLocation = Coordinates & {
  id: string;
  city: string;
  averageDailyPrice: number;
  recordCount: number;
  distance: number;
};

function parseCsvRow(line: string) {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      field += '"';
      index++;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

function rentalLocations(csv: string, center: Coordinates, radius: number): RentalLocation[] {
  const groups = new Map<string, {
    latitude: number;
    longitude: number;
    city: string;
    priceSum: number;
    count: number;
  }>();

  for (const line of csv.replace(/^\uFEFF/, "").split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const row = parseCsvRow(line);
    const latitude = Number(row[4]);
    const longitude = Number(row[5]);
    const price = Number(row[10]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(price)
      || latitude < 20 || latitude > 46 || longitude < 122 || longitude > 154 || price <= 0) continue;

    const distance = distanceMeters(center, { latitude, longitude });
    if (distance > radius) continue;

    const id = `${latitude.toFixed(4)}/${longitude.toFixed(4)}`;
    const group = groups.get(id) ?? {
      latitude,
      longitude,
      city: row[2] || row[3] || "所在地不明",
      priceSum: 0,
      count: 0,
    };
    group.priceSum += price;
    group.count++;
    groups.set(id, group);
  }

  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      latitude: group.latitude,
      longitude: group.longitude,
      city: group.city,
      averageDailyPrice: Math.round(group.priceSum / group.count),
      recordCount: group.count,
      distance: Math.round(distanceMeters(center, group)),
    }))
    .sort((a, b) => a.distance - b.distance);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = params.get("lat");
  const lon = params.get("lon");
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!lat?.trim() || !lon?.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < 20 || latitude > 46 || longitude < 122 || longitude > 154) {
    return Response.json({ error: "日本国内の会場位置を指定してください。" }, { status: 400 });
  }

  try {
    const csv = await readFile(path.join(process.cwd(), "src/data/fee_per_day_cleaned-3.csv"), "utf8");
    const nearbyRadius = 5000;
    const expandedRadius = 30000;
    const nearbyRentals = rentalLocations(csv, { latitude, longitude }, nearbyRadius);
    const expanded = nearbyRentals.length === 0;
    return Response.json({
      rentals: expanded ? rentalLocations(csv, { latitude, longitude }, expandedRadius) : nearbyRentals,
      radius: expanded ? expandedRadius : nearbyRadius,
      expanded,
      source: "提供レンタカー料金CSV",
    }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return Response.json({ error: "レンタカー料金データを読み込めませんでした。" }, { status: 500 });
  }
}
