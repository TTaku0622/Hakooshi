import { Award, MapPinned, MoonStar, Ship, TrainFront, Trophy, type LucideIcon } from "lucide-react";
import type { SavedTicket } from "./trip-data";

export type JourneyBadge = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  progress: number;
  target: number;
};

function completedTrips(records: SavedTicket[]) {
  return records.filter((record) => (record.status ?? "completed") === "completed");
}

function venueVisits(records: SavedTicket[]) {
  const visits = new Map<string, number>();
  for (const record of completedTrips(records)) {
    const name = record.venue?.name?.normalize("NFKC").toLocaleLowerCase().replace(/[\s・･_-]/g, "");
    if (name) visits.set(name, (visits.get(name) ?? 0) + 1);
  }
  return visits;
}

export function getJourneyBadges(records: SavedTicket[]): JourneyBadge[] {
  const completed = completedTrips(records);
  const visited = new Set(completed.map((record) => record.destination));
  const venues = venueVisits(records);
  const mostVisitedVenue = Math.max(0, ...venues.values());
  const overnightTrips = completed.filter((record) => record.tripType === "overnight").length;
  const trainTrips = completed.filter((record) => record.travelMode === "train").length;
  const ferryTrips = completed.filter((record) => record.travelMode === "ferry").length;

  return [
    { id: "first-journey", name: "はじめての遠征", description: "遠征済みの記録を1件保存", icon: Award, progress: completed.length, target: 1 },
    { id: "five-journeys", name: "遠征の旅人", description: "遠征済みの記録を5件保存", icon: Trophy, progress: completed.length, target: 5 },
    { id: "ten-journeys", name: "推し旅マスター", description: "遠征済みの記録を10件保存", icon: Trophy, progress: completed.length, target: 10 },
    { id: "twenty-five-journeys", name: "伝説の遠征者", description: "遠征済みの記録を25件保存", icon: Trophy, progress: completed.length, target: 25 },
    { id: "three-prefectures", name: "旅するひと", description: "3つの都道府県を訪問", icon: MapPinned, progress: visited.size, target: 3 },
    { id: "ten-prefectures", name: "全国めぐり", description: "10の都道府県を訪問", icon: MapPinned, progress: visited.size, target: 10 },
    { id: "all-prefectures", name: "47都道府県制覇", description: "47都道府県すべてを訪問", icon: MapPinned, progress: visited.size, target: 47 },
    { id: "same-venue-twice", name: "またこの場所で", description: "同じライブ会場を2回訪問", icon: MapPinned, progress: mostVisitedVenue, target: 2 },
    { id: "same-venue-five", name: "ホームグラウンド", description: "同じライブ会場を5回訪問", icon: MapPinned, progress: mostVisitedVenue, target: 5 },
    { id: "three-overnights", name: "泊まりがけの旅", description: "宿泊を伴う遠征を3回記録", icon: MoonStar, progress: overnightTrips, target: 3 },
    { id: "five-train-trips", name: "鉄道遠征", description: "鉄道での遠征を5回記録", icon: TrainFront, progress: trainTrips, target: 5 },
    { id: "first-ferry-trip", name: "海を越えて", description: "船・フェリーでの遠征を記録", icon: Ship, progress: ferryTrips, target: 1 },
  ];
}

export function getEarnedJourneyBadges(records: SavedTicket[]) {
  return getJourneyBadges(records).filter((badge) => badge.progress >= badge.target);
}
