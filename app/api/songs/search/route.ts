import { iTunesSearchSongs } from "@/lib/itunes";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ songs: [] });
  }

  try {
    const songs = await iTunesSearchSongs(query, 12);
    return NextResponse.json({ songs, provider: "itunes" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed." },
      { status: 500 },
    );
  }
}
