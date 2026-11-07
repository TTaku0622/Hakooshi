import { distanceMeters, nearbySpots, type SightseeingSpot } from "../../map-utils";
import venues from "../../../data/venues.json";

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
  const query = `[out:json][timeout:10];nwr(around:2000,${latitude},${longitude})["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|theme_park|aquarium)$"]["name"];out body center;`;
  try {
    const response = await fetch(`https://maps.mail.ru/osm/tools/overpass/api/interpreter?${new URLSearchParams({ data: query })}`, {
      headers: { "User-Agent": "Hakooshi/0.1 (https://github.com/TTaku0622/Hakooshi)" },
      signal: AbortSignal.timeout(35000), next: { revalidate: 3600 },
    });
    if (!response.ok) throw new Error("Nearby search unavailable");
    const data = await response.json();
    if (!Array.isArray(data.elements) || data.remark) throw new Error("Incomplete nearby data");
    return Response.json({ spots: nearbySpots(data.elements, { latitude, longitude }), radius: 2000, source: "OpenStreetMap / Overpass API" }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    const cultural: SightseeingSpot[] = [];
    const candidates = venues.filter((venue) => venue.cultural)
      .map((venue) => ({ ...venue, distance: distanceMeters({ latitude, longitude }, venue) }))
      .filter((venue) => venue.distance > 30 && venue.distance <= 2000).sort((a, b) => a.distance - b.distance);
    for (const venue of candidates) {
      if (cultural.some((other) => other.id === venue.id || (other.name === venue.name && distanceMeters(other, venue) < 80))) continue;
      const [osmType, osmId] = venue.id.split("/");
      cultural.push({ id: venue.id, name: venue.name, latitude: venue.latitude, longitude: venue.longitude, category: "劇場・文化施設", distance: Math.round(venue.distance), osmType: osmType as SightseeingSpot["osmType"], osmId: Number(osmId) });
      if (cultural.length === 15) break;
    }
    if (cultural.length) return Response.json({ spots: cultural, radius: 2000, kind: "cultural", source: "OpenStreetMap / provided raibu.csv", notice: "観光スポットの検索に接続できないため、提供CSVから周辺の劇場・文化施設を表示しています。" });
    return Response.json({ error: "周辺スポットを取得できませんでした。少し待って再試行してください。" }, { status: 502 });
  }
}
