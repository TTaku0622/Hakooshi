type ArtistResult = { artistId?: unknown; artistName?: unknown; primaryGenreName?: unknown; };

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query || query.length > 100) {
    return Response.json({ error: "検索するアーティスト名を1〜100文字で入力してください。" }, { status: 400 });
  }
  const upstream = new URL("https://itunes.apple.com/search");
  upstream.search = new URLSearchParams({ term: query, country: "JP", media: "music", entity: "musicArtist", attribute: "artistTerm", limit: "8", lang: "ja_jp" }).toString();
  try {
    const response = await fetch(upstream, { signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } });
    if (!response.ok) throw new Error("Artist search unavailable");
    const data: { results?: ArtistResult[]; } = await response.json();
    if (!Array.isArray(data.results)) throw new Error("Invalid artist search response");
    const artists = data.results
      .filter((artist) => typeof artist.artistId === "number" && typeof artist.artistName === "string")
      .map((artist) => ({ id: artist.artistId, name: artist.artistName, genre: typeof artist.primaryGenreName === "string" ? artist.primaryGenreName : "" }));
    return Response.json({ artists, source: "Apple iTunes Search API" });
  } catch {
    return Response.json({ error: "アーティスト検索に接続できませんでした。名前を手入力して続けられます。" }, { status: 502 });
  }
}
