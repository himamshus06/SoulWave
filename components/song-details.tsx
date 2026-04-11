"use client";

import { useInfiniteSimilar } from "@/hooks/use-infinite-similar";
import { Song } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

function SimilarSkeletonRow() {
  return (
    <div
      className="neu-panel animate-pulse p-3 [contain-intrinsic-size:auto_3.25rem] [content-visibility:auto]"
      aria-hidden
    >
      <div className="h-4 w-[75%] max-w-[14rem] rounded bg-[var(--foreground)]/10" />
      <div className="mt-2 h-3 w-1/2 max-w-[10rem] rounded bg-[var(--foreground)]/10" />
    </div>
  );
}

export function SongDetails({ songId }: { songId: string }) {
  const [song, setSong] = useState<Song | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [musicAppMessage, setMusicAppMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const similar = useInfiniteSimilar(songId);

  useEffect(() => {
    async function loadSong() {
      setLoading(true);
      setError(null);
      try {
        const songRes = await fetch(`/api/songs/${songId}`);
        const songData = (await songRes.json()) as { song?: Song; error?: string };

        if (!songRes.ok) throw new Error(songData.error || "Failed to load song.");
        setSong(songData.song ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    void loadSong();
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
    const attempts = [
      { app: "Spotify", uri: `https://open.spotify.com/search/${encoded}` },
      { app: "Apple Music", uri: `https://music.apple.com/search?term=${encoded}` },
      { app: "YouTube Music", uri: `https://music.youtube.com/search?q=${encoded}` },
    ];
    const webFallback = `https://www.google.com/search?q=${encodeURIComponent(
      `${searchTerm} spotify OR "apple music" OR "youtube music"`,
    )}`;

    setMusicAppMessage("Trying installed music apps...");
    let cancelled = false;
    const attemptDelayMs = 700;
    const fallbackDelayMs = attempts.length * attemptDelayMs + 700;
    const timeoutIds: number[] = [];

    const cancelFlow = () => {
      if (cancelled) return;
      cancelled = true;
      for (const id of timeoutIds) window.clearTimeout(id);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", cancelFlow);
      window.removeEventListener("blur", cancelFlow);
      setMusicAppMessage(null);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        cancelFlow();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", cancelFlow);
    window.addEventListener("blur", cancelFlow);

    attempts.forEach((attempt, index) => {
      const id = window.setTimeout(() => {
        if (cancelled) return;
        setMusicAppMessage(`Trying ${attempt.app}...`);
        window.location.href = attempt.uri;
      }, index * attemptDelayMs);
      timeoutIds.push(id);
    });

    const fallbackId = window.setTimeout(() => {
      if (cancelled) return;
      setMusicAppMessage("Opening web results...");
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", cancelFlow);
      window.removeEventListener("blur", cancelFlow);
      window.location.href = webFallback;
    }, fallbackDelayMs);
    timeoutIds.push(fallbackId);

    const resetId = window.setTimeout(() => {
      cancelFlow();
    }, fallbackDelayMs + 1600);
    timeoutIds.push(resetId);
  }

  if (loading) return <p className="text-[var(--muted)]">Loading song details...</p>;
  if (error) return <p className="text-[#a33f2f]">{error}</p>;
  if (!song) return <p className="text-[var(--muted)]">Song not found.</p>;

  return (
    <div className="space-y-8">
      <Link href="/" className="text-sm text-[#9f5c34] hover:underline">
        Back to search
      </Link>

      <section className="neu-panel p-6">
        <div className="flex flex-col gap-5 sm:flex-row">
          {song.albumArt ? (
            <Image
              src={song.albumArt}
              alt={song.album}
              width={220}
              height={220}
              className="rounded-2xl object-cover"
            />
          ) : (
            <div className="neu-inset h-[220px] w-[220px] rounded-2xl" />
          )}

          <div className="space-y-3">
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">{song.name}</h1>
            <p className="text-[var(--foreground)]">{song.artist}</p>
            <p className="text-sm text-[var(--muted)]">Album: {song.album}</p>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={shareSong}
                className="neu-btn warm-btn px-4 py-2 text-sm font-medium"
              >
                Share this song
              </button>
              <button
                onClick={openInDefaultMusicAppSearch}
                className="neu-btn px-4 py-2 text-sm font-medium"
              >
                Open in music app
              </button>

              {song.previewUrl ? (
                <div className="neu-panel w-full p-3 sm:max-w-md">
                  <p className="mb-2 text-sm font-medium text-[var(--foreground)]">Listen preview</p>
                  <audio controls preload="none" className="w-full">
                    <source src={song.previewUrl} type="audio/mpeg" />
                    Your browser does not support audio playback.
                  </audio>
                </div>
              ) : null}

              {song.externalUrl ? (
                <a
                  href={song.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="neu-btn px-4 py-2 text-sm font-medium"
                >
                  Open in iTunes
                </a>
              ) : null}
            </div>
            {shareMessage ? <p className="text-sm text-[#9f5c34]">{shareMessage}</p> : null}
            {musicAppMessage ? <p className="text-sm text-[#9f5c34]">{musicAppMessage}</p> : null}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Similar songs</h2>
          {similar.meta.total != null && similar.meta.total > 0 ? (
            <p className="text-xs text-[var(--muted)]">{similar.items.length} of ~{similar.meta.total} in this wave</p>
          ) : null}
        </div>
        {similar.meta.lastFmError ? (
          <p className="mb-2 text-xs text-[var(--muted)]">Last.fm: {similar.meta.lastFmError}</p>
        ) : null}
        {similar.error ? <p className="mb-2 text-sm text-[#a33f2f]">{similar.error}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {similar.isInitialLoading
            ? Array.from({ length: 6 }, (_, i) => <SimilarSkeletonRow key={`sk-${i}`} />)
            : similar.items.map((similarSong) => (
                <Link
                  key={similarSong.id}
                  href={`/song/${similarSong.id}`}
                  className="neu-panel p-3 transition hover:translate-y-[-1px] [contain-intrinsic-size:auto_3.25rem] [content-visibility:auto]"
                >
                  <p className="font-medium text-[var(--foreground)]">{similarSong.name}</p>
                  <p className="text-sm text-[var(--muted)]">{similarSong.artist}</p>
                </Link>
              ))}
        </div>

        {similar.isLoadingMore ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <SimilarSkeletonRow />
            <SimilarSkeletonRow />
          </div>
        ) : null}

        <div ref={similar.sentinelRef} className="h-px w-full" aria-hidden />

        {!similar.hasMore && similar.items.length > 0 && similar.phase === "ready" ? (
          <p className="mt-4 text-center text-sm text-[var(--muted)]">
            You&apos;ve reached the end of this wave — search again or open another track to keep discovering.
          </p>
        ) : null}

        {!similar.isInitialLoading && similar.items.length === 0 && similar.phase === "ready" ? (
          <p className="text-sm text-[var(--muted)]">No similar songs found for this track.</p>
        ) : null}
      </section>
    </div>
  );
}
