import { iTunesSearchSongs } from "@/lib/itunes";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 12;
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 25) : 12;
  if (!query) {
    return NextResponse.json({ songs: [] });
  }

  try {
    const songs = await iTunesSearchSongs(query, safeLimit);
    return NextResponse.json({ songs, provider: "itunes" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed." },
      { status: 500 },
    );
  }
}
