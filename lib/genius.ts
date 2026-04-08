import { iTunesSearchSongs } from "@/lib/itunes";
import { rankSongsByTheme } from "@/lib/theme";
import { Song } from "@/lib/types";

type GeniusHit = {
  result?: {
    title?: string;
    primary_artist?: {
      name?: string;
    };
  };
};

type GeniusSearchResponse = {
  response?: {
    hits?: GeniusHit[];
  };
};

function getGeniusToken() {
  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Missing GENIUS_ACCESS_TOKEN. Add it to .env.local.");
  }
  return token;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function rankByArtistTitleMatch(candidates: Song[], title: string, artist: string) {
  const targetTitle = normalize(title);
  const targetArtist = normalize(artist);
  return [...candidates].sort((a, b) => {
    const aTitle = normalize(a.name);
    const bTitle = normalize(b.name);
    const aArtist = normalize(a.artist);
    const bArtist = normalize(b.artist);

    const aScore = Number(aTitle.includes(targetTitle)) + Number(aArtist.includes(targetArtist));
    const bScore = Number(bTitle.includes(targetTitle)) + Number(bArtist.includes(targetArtist));
    return bScore - aScore;
  });
}

export async function lyricsSearchViaGenius(lyrics: string, limit = 12) {
  const token = getGeniusToken();
  const response = await fetch(
    `https://api.genius.com/search?q=${encodeURIComponent(lyrics)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Genius search failed (${response.status}): ${details}`);
  }

  const data = (await response.json()) as GeniusSearchResponse;
  const hits = data.response?.hits ?? [];
  const topHits = hits.slice(0, 6);

  const pooled: Song[] = [];
  for (const hit of topHits) {
    const title = hit.result?.title?.trim();
    const artist = hit.result?.primary_artist?.name?.trim();
    if (!title || !artist) continue;

    const candidates = await iTunesSearchSongs(`${title} ${artist}`, 5);
    const ranked = rankByArtistTitleMatch(candidates, title, artist);
    pooled.push(...ranked.slice(0, 2));
  }

  const deduped = new Map<string, Song>();
  for (const song of pooled) deduped.set(song.id, song);
  const themed = rankSongsByTheme([...deduped.values()], lyrics);
  return themed.slice(0, limit);
}
