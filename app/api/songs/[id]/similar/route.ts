import { iTunesLookupSong, iTunesSimilarSongs } from "@/lib/itunes";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;

  try {
    const seed = await iTunesLookupSong(id);
    if (!seed) return NextResponse.json({ songs: [] });
    const songs = await iTunesSimilarSongs(seed, 10);
    return NextResponse.json({ songs, provider: "itunes" });
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
