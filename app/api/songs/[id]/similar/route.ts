import { iTunesLookupSong, iTunesSimilarSongs } from "@/lib/itunes";
import { lastFmSimilarSongs } from "@/lib/lastfm";
import { rankSongsByTheme } from "@/lib/theme";
import { Song } from "@/lib/types";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;

  try {
    const seed = await iTunesLookupSong(id);
    if (!seed) return NextResponse.json({ songs: [] });

    let lastFmSongs: Song[] = [];
    let lastFmError: string | null = null;
    try {
      lastFmSongs = await lastFmSimilarSongs(seed, 12);
    } catch (error) {
      lastFmError = error instanceof Error ? error.message : "Last.fm failed.";
      console.error("[similar] lastfm failed", { songId: id, error: lastFmError });
      lastFmSongs = [];
    }

    let iTunesSongs: Song[] = [];
    try {
      iTunesSongs = await iTunesSimilarSongs(seed, 20);
    } catch (error) {
      const iTunesError = error instanceof Error ? error.message : "iTunes fallback failed.";
      console.error("[similar] itunes fallback failed", { songId: id, error: iTunesError });
      iTunesSongs = [];
    }

    const merged = new Map<string, Song>();
    for (const song of lastFmSongs) merged.set(song.id, song);
    for (const song of iTunesSongs) {
      if (!merged.has(song.id)) merged.set(song.id, song);
    }

    const songs = rankSongsByTheme([...merged.values()], `${seed.name} ${seed.artist}`).slice(0, 10);
    const provider = lastFmSongs.length > 0 ? "lastfm+itunes" : "itunes";
    return NextResponse.json({ songs, provider, lastFmError });
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
