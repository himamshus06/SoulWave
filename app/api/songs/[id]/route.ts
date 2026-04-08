import { iTunesLookupSong } from "@/lib/itunes";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;

  try {
    const song = await iTunesLookupSong(id);
    if (!song) {
      return NextResponse.json({ error: "Song not found." }, { status: 404 });
    }
    return NextResponse.json({ song, provider: "itunes" });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load song details.",
      },
      { status: 500 },
    );
  }
}
