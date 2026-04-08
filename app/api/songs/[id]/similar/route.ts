import { iTunesLookupSong, iTunesSimilarSongs } from "@/lib/itunes";
import { lastFmSimilarSongs } from "@/lib/lastfm";
import { rankSongsByTheme } from "@/lib/theme";
import { Song } from "@/lib/types";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;

  try {
    const seed = await iTunesLookupSong(id);
    if (!seed) return NextResponse.json({ songs: [] });

    const [lastFmSongs, iTunesSongs] = await Promise.all([
      lastFmSimilarSongs(seed, 12).catch(() => []),
      iTunesSimilarSongs(seed, 20).catch(() => []),
    ]);

    const merged = new Map<string, Song>();
    for (const song of lastFmSongs) merged.set(song.id, song);
    for (const song of iTunesSongs) {
      if (!merged.has(song.id)) merged.set(song.id, song);
    }

    const songs = rankSongsByTheme([...merged.values()], `${seed.name} ${seed.artist}`).slice(0, 10);
    const provider = lastFmSongs.length > 0 ? "lastfm+itunes" : "itunes";
    return NextResponse.json({ songs, provider });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load similar songs.",
      },
      { status: 500 },
    );
  }
}
