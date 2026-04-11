import { iTunesLookupSong, iTunesSimilarSongs } from "@/lib/itunes";
import { lastFmSimilarSongs } from "@/lib/lastfm";
import { rankCandidates, ScoredSong } from "@/lib/theme";
import { Song } from "@/lib/types";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ITUNES_ONLY_MATCH = 0.15;

function applyArtistDiversityCap(songs: Song[], limit: number, perArtistCap = 2): Song[] {
  const perArtistCounts = new Map<string, number>();
  const out: Song[] = [];

  for (const song of songs) {
    const key = song.artist.toLowerCase().trim();
    const count = perArtistCounts.get(key) ?? 0;
    if (count >= perArtistCap) continue;
    perArtistCounts.set(key, count + 1);
    out.push(song);
    if (out.length >= limit) return out;
  }

  for (const song of songs) {
    if (out.length >= limit) break;
    if (out.some((s) => s.id === song.id)) continue;
    out.push(song);
  }

  return out.slice(0, limit);
}

const DEFAULT_PAGE = 12;
const MAX_PAGE = 24;
/** Upper bound on diversified similar tracks returned across all pages (one ranked pass). */
const MAX_POOL = 96;

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);
  const limitRaw = parseInt(searchParams.get("limit") || String(DEFAULT_PAGE), 10);
  const limit = Math.min(Math.max(1, limitRaw || DEFAULT_PAGE), MAX_PAGE);

  try {
    const seed = await iTunesLookupSong(id);
    if (!seed) {
      return NextResponse.json({ songs: [], hasMore: false, total: 0, offset: 0, provider: "itunes", lastFmError: null });
    }

    const seedText = `${seed.name} ${seed.artist} ${seed.album}`;

    const [lfResult, itResult] = await Promise.allSettled([
      lastFmSimilarSongs(seed, 12),
      iTunesSimilarSongs(seed, 60),
    ]);

    let lastFmError: string | null = null;
    const scored: ScoredSong[] = [];

    if (lfResult.status === "fulfilled") {
      for (const { song, match } of lfResult.value) {
        scored.push({ song, lastFmMatch: match });
      }
    } else {
      lastFmError = lfResult.reason instanceof Error ? lfResult.reason.message : "Last.fm failed.";
      console.error("[similar] lastfm failed", { songId: id, error: lastFmError });
    }

    const lastFmIds = new Set(scored.map((s) => s.song.id));

    if (itResult.status === "fulfilled") {
      for (const song of itResult.value) {
        if (!lastFmIds.has(song.id)) {
          scored.push({ song, lastFmMatch: ITUNES_ONLY_MATCH });
        }
      }
    } else {
      const iTunesError = itResult.reason instanceof Error ? itResult.reason.message : "iTunes fallback failed.";
      console.error("[similar] itunes fallback failed", { songId: id, error: iTunesError });
    }

    const ranked = rankCandidates(scored, seed, seedText);
    const pool = applyArtistDiversityCap(ranked, MAX_POOL, 2);
    const total = pool.length;
    const songs = pool.slice(offset, offset + limit);
    const hasMore = offset + songs.length < total;
    const provider = lfResult.status === "fulfilled" && lfResult.value.length > 0 ? "lastfm+itunes" : "itunes";

    return NextResponse.json({ songs, hasMore, total, offset, limit, provider, lastFmError });
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
