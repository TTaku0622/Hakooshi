export type Coordinates = { latitude: number; longitude: number };
export type Venue = {
  id?: string;
  name: string;
  address?: string;
  prefecture?: string;
  latitude?: number;
  longitude?: number;
  source: "manual" | "musicbrainz" | "osm";
};
export type SightseeingSpot = Coordinates & {
  id: string;
  name: string;
  category: string;
  distance: number;
  osmType: "node" | "way" | "relation";
  osmId: number;
};
type Position = [number, number];
export type PrefectureGeometry =
  | { type: "Polygon"; coordinates: Position[][] }
  | { type: "MultiPolygon"; coordinates: Position[][][] };
export type PrefectureFeature = { properties: { N03_001: string }; geometry: PrefectureGeometry };

export function hasCoordinates(value: Venue | null): value is Venue & Coordinates {
  return !!value && typeof value.latitude === "number" && typeof value.longitude === "number"
    && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
    && Math.abs(value.latitude) <= 85 && Math.abs(value.longitude) <= 180;
}

export function distanceMeters(a: Coordinates, b: Coordinates) {
  const radians = Math.PI / 180;
  const deltaLat = (b.latitude - a.latitude) * radians;
  const deltaLon = (b.longitude - a.longitude) * radians;
  const h = Math.sin(deltaLat / 2) ** 2
    + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(deltaLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function toWorldPixel(point: Coordinates, zoom: number) {
  const size = 256 * 2 ** zoom;
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, point.latitude));
  const sin = Math.sin(latitude * Math.PI / 180);
  return {
    x: (point.longitude + 180) / 360 * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

export function fromWorldPixel(x: number, y: number, zoom: number): Coordinates {
  const size = 256 * 2 ** zoom;
  return {
    longitude: ((x / size * 360) % 360 + 360) % 360 - 180,
    latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * y / size))) * 180 / Math.PI,
  };
}

function inRing(point: Coordinates, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > point.latitude) !== (yj > point.latitude)
      && point.longitude < (xj - xi) * (point.latitude - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function prefectureAt(point: Coordinates, features: PrefectureFeature[]) {
  for (const feature of features) {
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    if (polygons.some(([outer, ...holes]) => outer && inRing(point, outer) && !holes.some((hole) => inRing(point, hole)))) {
      return feature.properties.N03_001;
    }
  }
  return null;
}

const categories: Record<string, string> = {
  attraction: "観光スポット", museum: "博物館・美術館", gallery: "ギャラリー",
  viewpoint: "展望スポット", zoo: "動物園", theme_park: "テーマパーク", aquarium: "水族館",
  hotel: "ホテル", guest_house: "ゲストハウス", hostel: "ホステル", ryokan: "旅館", motel: "モーテル",
};
type OsmElement = {
  type?: string; id?: number; lat?: number; lon?: number;
  center?: { lat?: number; lon?: number }; tags?: Record<string, string>;
};

export function nearbySpots(elements: OsmElement[], center: Coordinates, radius = 2000): SightseeingSpot[] {
  const candidates: SightseeingSpot[] = [];
  for (const element of elements) {
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    const tags = element.tags ?? {};
    const name = tags["name:ja"] || tags.name;
    const category = categories[tags.tourism];
    if (!name || !category || typeof latitude !== "number" || typeof longitude !== "number"
      || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 85 || Math.abs(longitude) > 180
      || !["node", "way", "relation"].includes(element.type ?? "") || !Number.isSafeInteger(element.id) || (element.id ?? 0) <= 0) continue;
    const distance = distanceMeters(center, { latitude, longitude });
    if (distance > radius) continue;
    candidates.push({ id: `${element.type}/${element.id}`, osmType: element.type as SightseeingSpot["osmType"], osmId: element.id!, name, category, latitude, longitude, distance: Math.round(distance) });
  }
  const result: SightseeingSpot[] = [];
  for (const spot of candidates.sort((a, b) => a.distance - b.distance)) {
    if (result.some((other) => other.id === spot.id || (other.name === spot.name && distanceMeters(other, spot) < 80))) continue;
    result.push(spot);
    if (result.length === 15) break;
  }
  return result;
}

export function osmLocation(point: Coordinates) {
  return `https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=16/${point.latitude}/${point.longitude}`;
}
