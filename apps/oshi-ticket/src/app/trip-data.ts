import tourism from "../data/links-tourism.json";
import type { Venue } from "./map-utils";
import type { TravelMode } from "./passport-spread";

export const prefectures = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

export type TripType = "daytrip" | "overnight";
export type TripStatus = "planned" | "completed";
export type TicketSide = "front" | "back";
export type CostAverages = {
  total: number | null;
  package: number | null;
  accommodation: number | null;
  food: number | null;
  transportation: number | null;
  entertainment: number | null;
  shopping: number | null;
  other: number | null;
};
export type TourismData = {
  prefecture: string;
  prefectureCode: number;
  year: number;
  tripType: TripType;
  averages: CostAverages;
  guestCount: number | null;
  sourceName: string;
  sourceUrl: string;
  availableYears: number[];
};

export const tourismYears = tourism.years;

export function findTourismData(prefecture: string, tripType: TripType, year: number): TourismData | null {
  const prefectureCode = prefectures.indexOf(prefecture) + 1;
  const record = tourism.records.find((r) => r.prefectureCode === prefectureCode && r.tripType === tripType && r.year === year);
  if (!record) return null;
  const { total, package: packageCost, accommodation, food, transportation, entertainment, shopping, other } = record;
  return {
    prefecture, prefectureCode, year, tripType,
    averages: { total, package: packageCost, accommodation, food, transportation, entertainment, shopping, other },
    guestCount: tourism.guestCounts.find((r) => r.prefectureCode === prefectureCode && r.year === year)?.total ?? null,
    sourceName: tourism.dataset,
    sourceUrl: tourism.sourceUrl,
    availableYears: tourism.years,
  };
}

export function yen(value: number | null) {
  return value === null ? "データなし" : `¥${value.toLocaleString("ja-JP")}`;
}

export function parseActualTotal(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d+$/.test(value.trim())) throw new Error("実費は0円以上の整数で入力してください。");
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) throw new Error("実費の金額を確認してください。");
  return amount;
}

export const artistGenres = [
  "J-POP",
  "ロック・バンド",
  "アイドル",
  "K-POP",
  "ダンス＆ボーカル",
  "ヒップホップ・R&B",
  "アニソン・声優",
  "その他",
];

export type SavedTicket = {
  id: number;
  oshi: string;
  event: string;
  origin: string;
  destination: string;
  date: string;
  color: string;
  memory: string;
  outfit?: { genre: string; details: string };
  setlist?: string[];
  setlistFmId?: string;
  setlistSource?: string;
  image: string;
  photo?: string;
  venue?: Venue;
  travelMode?: TravelMode;
  railwayId?: string;
  ferryRoute?: string;
  format?: "passport";
  backImage?: string;
  status?: TripStatus;
  tripType?: TripType;
  actualTotal?: string;
  benchmark?: TourismData;
};
