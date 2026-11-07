import railways from "../data/railway.json";
import ferry from "../data/ferry.json";
import { prefectures } from "./trip-data";

export type RailwayFact = { id: string; name: string; jurisdiction: string; year: number; kilometers: number };
export { railways };
export function ferryRegion(prefecture: string) {
  const code = prefectures.indexOf(prefecture) + 1;
  if (!code) return null;
  if (code === 1) return "北海道";
  if (code <= 7) return "東北";
  if (code <= 14) return "関東";
  if (code <= 24) return "中部";
  if (code <= 30) return "近畿";
  if (code <= 35) return "中国";
  if (code <= 39) return "四国";
  return "九州";
}
export function ferryFacts(prefecture: string) {
  const region = ferryRegion(prefecture);
  const connections = ferry.connections.filter((r) => r.from === region || r.to === region);
  return { region, connections, samples: connections.reduce((total, r) => total + r.samples, 0), sourceUrl: ferry.sourceUrl, period: ferry.period };
}
