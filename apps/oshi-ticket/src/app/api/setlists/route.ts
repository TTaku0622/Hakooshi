import { getCurrentUser } from "@/lib/auth";

type Setlist = {
  id: string;
  eventDate: string;
  artist?: { name?: string };
  venue?: { name?: string; city?: { name?: string } };
  tour?: { name?: string };
  url?: string;
  sets?: { set?: { song?: { name?: string; tape?: boolean }[] }[] };
};

export async function GET(request: Request) {
  await getCurrentUser();
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const artist = params.get("artist")?.trim() ?? "";
  const date = params.get("date") ?? "";
  if (id !== null && !/^[a-f0-9]{1,16}$/i.test(id)) {
    return Response.json({ error: "公演IDが無効です。" }, { status: 400 });
  }
  if (id === null && (!artist || artist.length > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    return Response.json({ error: "推しの名前と公演日を入力してください。" }, { status: 400 });
  }

  const key = process.env.SETLIST_FM_API_KEY?.trim();
  if (!key) {
    return Response.json({ error: "setlist.fmのAPIキーが未設定です。" }, { status: 503 });
  }

  const upstream = new URL(id ? `setlist/${id}` : "search/setlists", "https://api.setlist.fm/rest/1.0/");
  if (!id) {
    upstream.search = new URLSearchParams({
      artistName: artist,
      date: date.split("-").reverse().join("-"),
    }).toString();
  }

  try {
    const response = await fetch(upstream, {
      headers: { Accept: "application/json", "x-api-key": key },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 404) return Response.json({ concerts: [] });
    if (response.status === 429) {
      return Response.json({ error: "検索が混み合っています。少し待ってからお試しください。" }, { status: 429 });
    }
    if (response.status === 401 || response.status === 403) {
      return Response.json({ error: "setlist.fmのAPIキーが認証されませんでした。" }, { status: 502 });
    }
    if (!response.ok) throw new Error("Setlist search failed");

    const data: Setlist & { setlist?: Setlist[] } = await response.json();
    const results = id ? [data] : data.setlist;
    if (!Array.isArray(results) || results.some((item) => typeof item.id !== "string")) {
      throw new Error("Invalid setlist response");
    }

    const concerts = results.map((item) => ({
      id: item.id,
      artist: item.artist?.name,
      date: item.eventDate,
      venue: item.venue?.name,
      city: item.venue?.city?.name,
      tour: item.tour?.name,
      url: item.url?.startsWith("https://www.setlist.fm/") ? item.url : "https://www.setlist.fm/",
      songs: (item.sets?.set ?? []).flatMap((set) =>
        (set.song ?? []).filter((song) => !song.tape && song.name).map((song) => song.name),
      ),
    }));
    return Response.json({ concerts, pngImportEnabled: process.env.SETLIST_FM_EXPORT_ALLOWED === "true" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "setlist.fmに接続できませんでした。" }, { status: 502 });
  }
}
