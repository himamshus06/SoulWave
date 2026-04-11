import { iTunesSearchSongs } from "@/lib/itunes";
import { Song } from "@/lib/types";

type LastFmSimilarTrack = {
  name?: string;
  match?: string;
  artist?: { name?: string };
};

type LastFmResponse = {
  similartracks?: {
    track?: LastFmSimilarTrack[] | LastFmSimilarTrack;
  };
};

function getLastFmApiKey() {
  const key = process.env.LASTFM_API_KEY;
  if (!key) {
    throw new Error("Missing LASTFM_API_KEY. Add it to .env.local.");
  }
  return key;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export type LastFmEnrichedTrack = { song: Song; match: number };

export async function lastFmSimilarSongs(seed: Song, limit = 10): Promise<LastFmEnrichedTrack[]> {
  const apiKey = getLastFmApiKey();
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "track.getsimilar");
  url.searchParams.set("artist", seed.artist);
  url.searchParams.set("track", seed.name);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(Math.max(limit * 3, 30)));
  url.searchParams.set("autocorrect", "1");

  const response = await fetch(url, { next: { revalidate: 900 } });
  if (!response.ok) throw new Error(`Last.fm recommendations failed (${response.status}).`);

  const data = (await response.json()) as LastFmResponse;
  const rawTracks = data.similartracks?.track;
  const candidates = Array.isArray(rawTracks) ? rawTracks : rawTracks ? [rawTracks] : [];

  const enriched = await Promise.all(
    candidates.map(async (item): Promise<LastFmEnrichedTrack | null> => {
      const track = item.name?.trim();
      const artist = item.artist?.name?.trim();
      if (!track || !artist) return null;

      const mapped = await iTunesSearchSongs(`${track} ${artist}`, 2).catch(() => []);
      const first = mapped[0];
      if (!first) return null;

      const score = Number(item.match ?? "0");
      const sameTrack =
        normalize(first.name) === normalize(seed.name) && normalize(first.artist) === normalize(seed.artist);
      if (sameTrack) return null;

      return { song: first, match: Number.isFinite(score) ? score : 0 };
    }),
  );

  const ok = enriched.filter((x): x is LastFmEnrichedTrack => x !== null);

  const deduped = new Map<string, LastFmEnrichedTrack>();
  for (const item of ok) {
    const existing = deduped.get(item.song.id);
    if (!existing || item.match > existing.match) deduped.set(item.song.id, item);
  }

  return [...deduped.values()].sort((a, b) => b.match - a.match).slice(0, limit);
}
