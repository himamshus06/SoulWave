"use client";

import { Song } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export function SongDetails({ songId }: { songId: string }) {
  const [song, setSong] = useState<Song | null>(null);
  const [similarSongs, setSimilarSongs] = useState<Song[]>([]);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSongData() {
      setLoading(true);
      setError(null);
      try {
        const [songRes, similarRes] = await Promise.all([
          fetch(`/api/songs/${songId}`),
          fetch(`/api/songs/${songId}/similar`),
        ]);

        const songData = (await songRes.json()) as { song?: Song; error?: string };
        const similarData = (await similarRes.json()) as {
          songs?: Song[];
          error?: string;
        };

        if (!songRes.ok) throw new Error(songData.error || "Failed to load song.");
        if (!similarRes.ok) throw new Error(similarData.error || "Failed to load similar songs.");

        setSong(songData.song ?? null);
        setSimilarSongs(similarData.songs ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    void loadSongData();
  }, [songId]);

  async function shareSong() {
    if (!song || typeof window === "undefined") return;
    const shareUrl = `${window.location.origin}/song/${song.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${song.name} - ${song.artist}`,
          text: "Check out this song recommendation",
          url: shareUrl,
        });
        setShareMessage("Shared.");
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage("Link copied to clipboard.");
    } catch {
      setShareMessage("Could not share this song.");
    }
  }

  function openInDefaultMusicAppSearch() {
    if (!song || typeof window === "undefined") return;
    const searchTerm = `${song.name} ${song.artist}`.trim();
    const encoded = encodeURIComponent(searchTerm);
    const appUri = `music://music.apple.com/search?term=${encoded}`;
    const webUrl = `https://music.apple.com/us/search?term=${encoded}`;

    // Try app deep link first; if unavailable, use web search.
    const fallbackTimer = window.setTimeout(() => {
      window.location.href = webUrl;
    }, 900);

    window.location.href = appUri;

    window.setTimeout(() => {
      window.clearTimeout(fallbackTimer);
    }, 1200);
  }

  if (loading) return <p className="text-zinc-600">Loading song details...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!song) return <p className="text-zinc-600">Song not found.</p>;

  return (
    <div className="space-y-8">
      <Link href="/" className="text-sm text-indigo-700 hover:underline">
        Back to search
      </Link>

      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-5 sm:flex-row">
          {song.albumArt ? (
            <Image
              src={song.albumArt}
              alt={song.album}
              width={220}
              height={220}
              className="rounded-lg object-cover"
            />
          ) : (
            <div className="h-[220px] w-[220px] rounded-lg bg-zinc-200" />
          )}

          <div className="space-y-3">
            <h1 className="text-2xl font-semibold">{song.name}</h1>
            <p className="text-zinc-700">{song.artist}</p>
            <p className="text-sm text-zinc-500">Album: {song.album}</p>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={shareSong}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
              >
                Share this song
              </button>
              <button
                onClick={openInDefaultMusicAppSearch}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium"
              >
                Search in Music app
              </button>

              {song.previewUrl ? (
                <a
                  href={song.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium"
                >
                  Listen preview
                </a>
              ) : null}

              {song.externalUrl ? (
                <a
                  href={song.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium"
                >
                  Open in iTunes
                </a>
              ) : null}
            </div>
            {shareMessage ? <p className="text-sm text-indigo-700">{shareMessage}</p> : null}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Similar songs</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {similarSongs.map((similarSong) => (
            <Link
              key={similarSong.id}
              href={`/song/${similarSong.id}`}
              className="rounded-lg border border-zinc-200 bg-white p-3"
            >
              <p className="font-medium">{similarSong.name}</p>
              <p className="text-sm text-zinc-600">{similarSong.artist}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
