import { nearbySpots } from "../../map-utils";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = params.get("lat"); const lon = params.get("lon");
  const latitude = Number(lat); const longitude = Number(lon);
  if (!lat?.trim() || !lon?.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < 20 || latitude > 46 || longitude < 122 || longitude > 154) {
    return Response.json({ error: "日本国内の会場位置を指定してください。" }, { status: 400 });
  }
  const query = `[out:json][timeout:10];nwr(around:3000,${latitude},${longitude})["tourism"~"^(hotel|guest_house|hostel|ryokan|motel)$"]["name"];out body center;`;
  try {
    const response = await fetch(`https://maps.mail.ru/osm/tools/overpass/api/interpreter?${new URLSearchParams({ data: query })}`, {
      headers: { "User-Agent": "Hakooshi/0.1 (https://github.com/TTaku0622/Hakooshi)" }, signal: AbortSignal.timeout(35000), next: { revalidate: 3600 },
    });
    if (!response.ok) throw new Error("Lodging search unavailable");
    const data = await response.json();
    if (!Array.isArray(data.elements) || data.remark) throw new Error("Incomplete lodging results");
    return Response.json({ lodgings: nearbySpots(data.elements, { latitude, longitude }, 3000).slice(0, 8), source: "OpenStreetMap / Overpass API", radius: 3000 }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return Response.json({ error: "宿泊施設の情報を取得できませんでした。少し待って再試行してください。" }, { status: 502 });
  }
}
