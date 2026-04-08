import { Song } from "@/lib/types";

type ITunesTrack = {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackViewUrl?: string;
};

type ITunesSearchResponse = {
  results: ITunesTrack[];
};

function mapITunesTrack(track: ITunesTrack): Song {
  return {
    id: `itunes:${track.trackId}`,
    name: track.trackName,
    artist: track.artistName,
    album: track.collectionName,
    albumArt: track.artworkUrl100?.replace("100x100", "600x600") ?? null,
    previewUrl: track.previewUrl ?? null,
    externalUrl: track.trackViewUrl ?? null,
  };
}

export async function iTunesSearchSongs(query: string, limit = 12) {
  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}`,
    { next: { revalidate: 60 } },
  );
  if (!response.ok) throw new Error(`iTunes search failed (${response.status}).`);

  const data = (await response.json()) as ITunesSearchResponse;
  return data.results.map(mapITunesTrack);
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

export async function iTunesSimilarSongs(seedSong: Song, limit = 10) {
  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(seedSong.artist)}&entity=song&limit=30`,
    { next: { revalidate: 60 } },
  );
  if (!response.ok) throw new Error(`iTunes recommendations failed (${response.status}).`);

  const data = (await response.json()) as ITunesSearchResponse;
  return data.results
    .map(mapITunesTrack)
    .filter((song) => song.id !== seedSong.id)
    .slice(0, limit);
}
