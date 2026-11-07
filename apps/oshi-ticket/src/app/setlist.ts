const artistTitles = new Map([
  ["mrs green apple", new Map([
    ["ao to natsu", "青と夏"],
    ["lilac", "ライラック"],
    ["watashi wa saikyou", "私は最強"],
    ["que sera sera", "ケセラセラ"],
    ["darling", "ダーリン"],
    ["columbus", "コロンブス"],
    ["froliginal", "フロリジナル"],
    ["a priori", "ア・プリオリ"],
    ["tengoku", "天国"],
  ])],
  ["the oral cigarettes", new Map([
    ["mr. phantom", "Mr.ファントム"],
    ["kyouran hey kids!!", "狂乱 Hey Kids!!"],
    ["kantan na koto", "カンタンナコト"],
  ])],
]);

export function parseSetlist(text: string) {
  return text.split(/\r?\n/)
    .map((line) => line.trim().replace(/^\d+(?:[.)]\s+|[、．）]\s*)/, "").trim())
    .filter(Boolean);
}

export function officialSongTitle(artist: string, song: string) {
  const artistKey = artist.normalize("NFKC").toLowerCase()
    .replaceAll(".", "").replace(/\s+/g, " ").trim();
  const key = song.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
  return artistTitles.get(artistKey)?.get(key) ?? song;
}

export function normalizeSetlist(artist: string, text: string) {
  return parseSetlist(text).map((song) => officialSongTitle(artist, song)).join("\n");
}
