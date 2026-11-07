import { findTourismData, tourismYears } from "../../trip-data";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const prefecture = params.get("prefecture") ?? "";
  const tripType = params.get("type") ?? "daytrip";
  const year = Number(params.get("year") ?? tourismYears[0]);
  if ((tripType !== "daytrip" && tripType !== "overnight") || !tourismYears.includes(year)) {
    return Response.json({ error: "旅行種別または統計年を確認してください。" }, { status: 400 });
  }
  const data = findTourismData(prefecture, tripType, year);
  if (!data) return Response.json({ error: "この都道府県のデータは見つかりませんでした。" }, { status: 404 });
  return Response.json(data, { headers: { "Cache-Control": "public, max-age=3600" } });
}
