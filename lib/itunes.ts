import { Song } from "@/lib/types";

type ITunesTrack = {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  primaryGenreName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackViewUrl?: string;
};

type ITunesSearchResponse = {
  results: ITunesTrack[];
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function bigrams(value: string) {
  const normalized = normalize(value).replace(/\s+/g, " ");
  if (normalized.length < 2) return [normalized];
  const grams: string[] = [];
  for (let i = 0; i < normalized.length - 1; i += 1) {
    grams.push(normalized.slice(i, i + 2));
  }
  return grams;
}

function diceSimilarity(a: string, b: string) {
  const aGrams = bigrams(a);
  const bGrams = bigrams(b);
  const used = new Set<number>();
  let overlap = 0;

  for (const gram of aGrams) {
    const matchIndex = bGrams.findIndex((candidate, index) => candidate === gram && !used.has(index));
    if (matchIndex !== -1) {
      used.add(matchIndex);
      overlap += 1;
    }
  }

  return (2 * overlap) / (aGrams.length + bGrams.length || 1);
}

function fuzzyScore(track: ITunesTrack, query: string) {
  const q = normalize(query);
  const title = normalize(track.trackName);
  const artist = normalize(track.artistName);
  const album = normalize(track.collectionName);
  const joined = `${title} ${artist} ${album}`;

  let score = diceSimilarity(q, title) * 0.65 + diceSimilarity(q, joined) * 0.35;
  if (title.includes(q)) score += 0.35;
  if (joined.includes(q)) score += 0.15;
  return score;
}

async function rawITunesSearch(term: string, limit: number) {
  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}`,
    { next: { revalidate: 60 } },
  );
  if (!response.ok) throw new Error(`iTunes search failed (${response.status}).`);
  return (await response.json()) as ITunesSearchResponse;
}

async function rawITunesSearchWithAttribute(term: string, attribute: string, limit: number) {
  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&attribute=${encodeURIComponent(
      attribute,
    )}&limit=${limit}`,
    { next: { revalidate: 60 } },
  );
  if (!response.ok) throw new Error(`iTunes search failed (${response.status}).`);
  return (await response.json()) as ITunesSearchResponse;
}

function mapITunesTrack(track: ITunesTrack): Song {
  return {
    id: `itunes:${track.trackId}`,
    name: track.trackName,
    artist: track.artistName,
    album: track.collectionName,
    albumArt: track.artworkUrl100?.replace("100x100", "600x600") ?? null,
    previewUrl: track.previewUrl ?? null,
    externalUrl: track.trackViewUrl ?? null,
    genre: track.primaryGenreName ?? null,
  };
}

export async function iTunesSearchSongs(query: string, limit = 12) {
  const expandedLimit = Math.max(limit * 4, 24);
  const [primary, tokenFallback] = await Promise.all([
    rawITunesSearch(query, expandedLimit),
    query.includes(" ")
      ? rawITunesSearch(query.split(/\s+/).filter(Boolean).join(" "), expandedLimit)
      : Promise.resolve({ results: [] as ITunesTrack[] }),
  ]);

  const deduped = new Map<number, ITunesTrack>();
  for (const track of [...primary.results, ...tokenFallback.results]) {
    deduped.set(track.trackId, track);
  }

  return [...deduped.values()]
    .sort((a, b) => fuzzyScore(b, query) - fuzzyScore(a, query))
    .slice(0, limit)
    .map(mapITunesTrack);
}

export async function iTunesSearchSongsByArtist(artistQuery: string, limit = 12) {
  const expandedLimit = Math.max(limit * 4, 24);
  const [primary, tokenFallback] = await Promise.all([
    rawITunesSearchWithAttribute(artistQuery, "artistTerm", expandedLimit),
    artistQuery.includes(" ")
      ? rawITunesSearchWithAttribute(
          artistQuery.split(/\s+/).filter(Boolean).join(" "),
          "artistTerm",
          expandedLimit,
        )
      : Promise.resolve({ results: [] as ITunesTrack[] }),
  ]);

  const deduped = new Map<number, ITunesTrack>();
  for (const track of [...primary.results, ...tokenFallback.results]) {
    deduped.set(track.trackId, track);
  }

  const q = normalize(artistQuery);
  return [...deduped.values()]
    .sort((a, b) => diceSimilarity(q, normalize(b.artistName)) - diceSimilarity(q, normalize(a.artistName)))
    .slice(0, limit)
    .map(mapITunesTrack);
}

export async function iTunesLookupSong(songId: string) {
  const numericId = songId.replace("itunes:", "");
  const response = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(numericId)}`, {
    next: { revalidate: 60 },
  });
  if (!response.ok) throw new Error(`iTunes lookup failed (${response.status}).`);

  const data = (await response.json()) as ITunesSearchResponse;
  const track = data.results[0];
  return track ? mapITunesTrack(track) : null;
}

/**
 * Broad iTunes candidate pool (artist + title + optional genre). No per-artist cap — callers rank then diversify.
 */
export async function iTunesSimilarSongs(seedSong: Song, maxCandidates = 60) {
  const genreTerm = seedSong.genre?.trim();
  const [byArtist, byTitle, byGenre] = await Promise.all([
    fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(seedSong.artist)}&entity=song&limit=35`,
      { next: { revalidate: 60 } },
    ),
    fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(seedSong.name)}&entity=song&limit=35`,
      { next: { revalidate: 60 } },
    ),
    genreTerm
      ? fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(genreTerm)}&entity=song&limit=35`,
          { next: { revalidate: 60 } },
        )
      : Promise.resolve(null as Response | null),
  ]);

  if (!byArtist.ok && !byTitle.ok && !(byGenre?.ok)) {
    throw new Error(`iTunes recommendations failed (${byArtist.status || byTitle.status}).`);
  }

  const artistData = byArtist.ok
    ? ((await byArtist.json()) as ITunesSearchResponse)
    : ({ results: [] } as ITunesSearchResponse);
  const titleData = byTitle.ok
    ? ((await byTitle.json()) as ITunesSearchResponse)
    : ({ results: [] } as ITunesSearchResponse);
  const genreData =
    byGenre && byGenre.ok ? ((await byGenre.json()) as ITunesSearchResponse) : ({ results: [] } as ITunesSearchResponse);

  const seen = new Set<number>();
  const candidates: Song[] = [];
  for (const track of [...artistData.results, ...titleData.results, ...genreData.results]) {
    if (seen.has(track.trackId)) continue;
    seen.add(track.trackId);
    const song = mapITunesTrack(track);
    if (song.id === seedSong.id) continue;
    candidates.push(song);
    if (candidates.length >= maxCandidates) break;
  }

  return candidates;
}
