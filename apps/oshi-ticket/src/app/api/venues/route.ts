import { readFile } from "node:fs/promises";
import path from "node:path";
import { prefectureAt, type PrefectureFeature, type Venue } from "../../map-utils";
import localVenues from "../../../data/venues.json";

let features: Promise<PrefectureFeature[]> | undefined;
let nextRequestAt = 0;
const cache = new Map<string, { expires: number; venues: Venue[] }>();

function prefectures() {
  features ??= readFile(path.join(process.cwd(), "public/data/prefectures.geojson"), "utf8")
    .then((raw) => (JSON.parse(raw) as { features: PrefectureFeature[] }).features)
    .catch((error) => { features = undefined; throw error; });
  return features;
}

type Place = { id?: string; name?: string; address?: string; coordinates?: { latitude?: string; longitude?: string }; "life-span"?: { ended?: boolean } };

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query || query.length > 100) return Response.json({ error: "会場名を1〜100文字で入力してください。" }, { status: 400 });
  const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/[\s・･_-]/g, "");
  const term = normalize(query);
  if (!term) return Response.json({ error: "会場名を入力してください。" }, { status: 400 });
  const local = localVenues.filter((venue) => [venue.name, ...venue.aliases].some((name) => normalize(name).includes(term)))
    .sort((a, b) => Number(normalize(b.name) === term) - Number(normalize(a.name) === term) || a.name.localeCompare(b.name, "ja"));
  if (local.length) {
    const seen = new Set<string>();
    const venues = local.filter((venue) => { const key = `${venue.name}/${Math.round(venue.latitude * 1000)}/${Math.round(venue.longitude * 1000)}`; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 8);
    return Response.json({ venues, source: "OpenStreetMap / supplied raibu.csv" }, { headers: { "Cache-Control": "public, max-age=3600" } });
  }
  const key = query.toLocaleLowerCase();
  const saved = cache.get(key);
  if (saved && saved.expires > Date.now()) return Response.json({ venues: saved.venues, source: "MusicBrainz" });
  const delay = Math.max(0, nextRequestAt - Date.now());
  if (delay > 2200) return Response.json({ error: "会場検索が混み合っています。少し待ってから再検索してください。" }, { status: 429 });
  nextRequestAt = Date.now() + delay + 1100;
  try {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    const url = new URL("https://musicbrainz.org/ws/2/place/");
    const escaped = query.replace(/[+\-!(){}\[\]^"~*?:\\/|&]/g, "\\$&");
    url.search = new URLSearchParams({ query: `(${escaped}) AND (type:venue OR type:stadium)`, fmt: "json", limit: "12" }).toString();
    const response = await fetch(url, { headers: { "User-Agent": "Hakooshi/0.1 (https://github.com/TTaku0622/Hakooshi)", Accept: "application/json" }, signal: AbortSignal.timeout(10000), next: { revalidate: 86400 } });
    if (!response.ok) throw new Error("Venue service unavailable");
    const data: { places?: Place[] } = await response.json();
    if (!Array.isArray(data.places)) throw new Error("Invalid venue data");
    const boundaries = await prefectures();
    const venues: Venue[] = [];
    for (const place of data.places) {
      if (!place.name || !place.id || !/^[\da-f-]{36}$/i.test(place.id) || place["life-span"]?.ended) continue;
      const latitude = Number(place.coordinates?.latitude);
      const longitude = Number(place.coordinates?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 20 || latitude > 46 || longitude < 122 || longitude > 154) continue;
      const prefecture = prefectureAt({ latitude, longitude }, boundaries);
      if (!prefecture) continue;
      venues.push({ id: place.id, name: place.name, address: place.address ?? "", latitude, longitude, prefecture, source: "musicbrainz" });
      if (venues.length === 8) break;
    }
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + 3600000, venues });
    return Response.json({ venues, source: "MusicBrainz" }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return Response.json({ error: "会場検索に接続できませんでした。会場名は手入力で保存できます。" }, { status: 502 });
  }
}
