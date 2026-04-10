import { lyricsSearchViaGenius } from "@/lib/genius";
import { iTunesSearchSongs } from "@/lib/itunes";
import { Song } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

function looksLikeLyrics(query: string) {
  const cleaned = query.trim().toLowerCase();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 7) return true;
  if (cleaned.includes(",") || cleaned.includes("!") || cleaned.includes("?")) return true;
  if (cleaned.includes("  ")) return true;
  return false;
}

function mergeSongs(primary: Song[], secondary: Song[], limit: number) {
  const merged = new Map<string, Song>();
  for (const song of primary) merged.set(song.id, song);
  for (const song of secondary) {
    if (!merged.has(song.id)) merged.set(song.id, song);
  }
  return [...merged.values()].slice(0, limit);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const mode = request.nextUrl.searchParams.get("mode")?.trim();
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 12;
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 25) : 12;
  if (!query) {
    return NextResponse.json({ songs: [] });
  }

  try {
    let songs;
    if (mode === "lyrics") {
      const [lyricsSongs, normalSongs] = await Promise.all([
        lyricsSearchViaGenius(query, safeLimit).catch(() => []),
        iTunesSearchSongs(query, safeLimit),
      ]);
      songs = mergeSongs(lyricsSongs, normalSongs, safeLimit);
    } else if (mode === "song") {
      const [normalSongs, lyricsSongs] = await Promise.all([
        iTunesSearchSongs(query, safeLimit),
        lyricsSearchViaGenius(query, safeLimit).catch(() => []),
      ]);
      songs = mergeSongs(normalSongs, lyricsSongs, safeLimit);
    } else {
      const likelyLyrics = looksLikeLyrics(query);
      if (likelyLyrics) {
        const [lyricsSongs, normalSongs] = await Promise.all([
          lyricsSearchViaGenius(query, safeLimit).catch(() => []),
          iTunesSearchSongs(query, safeLimit),
        ]);
        songs = mergeSongs(lyricsSongs, normalSongs, safeLimit);
      } else {
        const [normalSongs, lyricsSongs] = await Promise.all([
          iTunesSearchSongs(query, safeLimit),
          lyricsSearchViaGenius(query, safeLimit).catch(() => []),
        ]);
        songs = mergeSongs(normalSongs, lyricsSongs, safeLimit);
      }
    }

    return NextResponse.json({ songs, provider: "itunes" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed." },
      { status: 500 },
    );
  }
}
