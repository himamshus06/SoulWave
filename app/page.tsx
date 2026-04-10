"use client";

import { Song } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [similarLoadingId, setSimilarLoadingId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [previewSongId, setPreviewSongId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.src = "";
        previewAudioRef.current = null;
      }
    };
  }, []);

  async function shareSong(song: Song) {
    if (typeof window === "undefined") return;
    const shareUrl = `${window.location.origin}/song/${song.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${song.name} - ${song.artist}`,
          text: "Check out this song recommendation",
          url: shareUrl,
        });
        setActionMessage("Shared.");
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setActionMessage("Link copied to clipboard.");
    } catch {
      setActionMessage("Could not share this song.");
    }
  }

  function openInDefaultMusicAppSearch(song: Song) {
    if (typeof window === "undefined") return;
    const searchTerm = `${song.name} ${song.artist}`.trim();
    const encoded = encodeURIComponent(searchTerm);
    const attempts = [
      { app: "Spotify", uri: `spotify:search:${searchTerm}` },
      { app: "Apple Music", uri: `music://music.apple.com/search?term=${encoded}` },
      { app: "YouTube Music", uri: `youtubemusic://search?query=${encoded}` },
    ];
    const webFallback = `https://www.google.com/search?q=${encodeURIComponent(
      `${searchTerm} spotify OR "apple music" OR "youtube music"`,
    )}`;

    setActionMessage("Trying installed music apps...");
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
      setActionMessage(null);
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
        setActionMessage(`Trying ${attempt.app}...`);
        window.location.href = attempt.uri;
      }, index * attemptDelayMs);
      timeoutIds.push(id);
    });

    const fallbackId = window.setTimeout(() => {
      if (cancelled) return;
      setActionMessage("Opening web results...");
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

  async function togglePreview(song: Song) {
    if (!song.previewUrl) return;

    setActionMessage(null);

    const existing = previewAudioRef.current;
    if (existing && previewSongId === song.id) {
      existing.pause();
      setPreviewSongId(null);
      return;
    }

    if (existing) {
      existing.pause();
      existing.src = "";
      previewAudioRef.current = null;
    }

    const audio = new Audio(song.previewUrl);
    audio.preload = "none";
    previewAudioRef.current = audio;
    setPreviewSongId(song.id);

    audio.onended = () => {
      if (previewAudioRef.current === audio) {
        setPreviewSongId(null);
      }
    };
    audio.onerror = () => {
      if (previewAudioRef.current === audio) {
        setPreviewSongId(null);
        setActionMessage("Preview unavailable.");
      }
    };

    try {
      await audio.play();
    } catch {
      if (previewAudioRef.current === audio) {
        setPreviewSongId(null);
      }
      setActionMessage("Tap Preview to play (browser blocked autoplay).");
    }
  }

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setActionMessage(null);
    setLoading(true);

    try {
      const response = await fetch(
        `/api/songs/search?q=${encodeURIComponent(query)}`,
      );
      const data = (await response.json()) as { songs?: Song[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Search failed.");
      }
      setSongs(data.songs ?? []);
      setPreviewSongId(null);
    } catch (err) {
      setSongs([]);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSimilarSongs(seedSong: Song) {
    setError(null);
    setActionMessage(null);
    setSimilarLoadingId(seedSong.id);
    setPreviewSongId(null);

    try {
      const response = await fetch(`/api/songs/${encodeURIComponent(seedSong.id)}/similar`);
      const data = (await response.json()) as { songs?: Song[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to load similar songs.");
      }
      setSongs(data.songs ?? []);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSimilarLoadingId(null);
    }
  }

  function startVoiceInput() {
    if (typeof window === "undefined") return;
    const Ctor = (
      window as Window & {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
      }
    ).SpeechRecognition ||
      (
        window as Window & {
          webkitSpeechRecognition?: SpeechRecognitionCtor;
        }
      ).webkitSpeechRecognition;

    if (!Ctor) {
      setError("Voice input is not supported in this browser.");
      return;
    }

    setError(null);
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setQuery(transcript);
      }
    };
    recognition.onerror = () => {
      setError("Could not capture voice input.");
    };
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  return (
    <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-x-hidden px-4 py-10 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -left-10 h-52 w-52 rounded-[28%] bg-gradient-to-br from-[#f8c88a] via-[#e89a65] to-[#d06d4f] opacity-45 blur-[2px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-20 right-[-4.5rem] h-56 w-56 rotate-12 rounded-[24%] bg-gradient-to-br from-[#f6ddb6] via-[#efb476] to-[#c97745] opacity-50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-8 left-[24%] h-40 w-40 rotate-45 rounded-[20%] bg-gradient-to-br from-[#efc18f] via-[#e08f57] to-[#bb6741] opacity-35"
      />

      <section className="relative z-10 mx-auto mt-4 flex min-h-[34vh] w-full max-w-3xl flex-col items-center justify-center text-center">
        <h1 className="text-5xl font-black tracking-tight text-[var(--foreground)] sm:text-6xl">
          SoulWave
        </h1>
        <p className="mt-3 text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
          warm sonic discovery
        </p>
        <p className="mt-3 max-w-xl text-sm text-[var(--muted)]">
          Search songs with iTunes and discover similar tracks in a clean, shareable flow.
        </p>
      </section>

      <form onSubmit={onSearch} className="mx-auto mt-8 flex w-full max-w-3xl gap-3">
        <div className="relative w-full">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try: Blinding Lights"
            className="neu-inset w-full px-4 py-3 text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[#d09a6e]"
          />
        </div>
        <button
          type="button"
          onClick={startVoiceInput}
          className="neu-btn px-4 py-2.5 font-medium"
          title="Voice to text input"
        >
          {listening ? "Listening..." : "Voice"}
        </button>
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="neu-btn warm-btn px-5 py-2.5 font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-[#a33f2f]">{error}</p> : null}
      {actionMessage ? <p className="mt-2 text-sm text-[#9f5c34]">{actionMessage}</p> : null}

      <section className="mx-auto mt-8 grid w-full max-w-4xl min-w-0 gap-4 sm:grid-cols-2">
        {songs.map((song) => (
          <div
            key={song.id}
            className="neu-panel w-full min-w-0 max-w-full p-4 transition hover:translate-y-[-1px]"
          >
            <div className="flex items-center gap-4">
              {song.albumArt ? (
                <Image
                  src={song.albumArt}
                  alt={song.album}
                  width={72}
                  height={72}
                  className="rounded-xl object-cover"
                />
              ) : (
                <div className="neu-inset h-[72px] w-[72px] rounded-xl" />
              )}
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-[var(--foreground)]">{song.name}</h2>
                <p className="truncate text-sm text-[var(--muted)]">{song.artist}</p>
                <p className="truncate text-xs text-[var(--muted)]">{song.album}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 max-[500px]:grid-cols-1 sm:flex sm:flex-wrap">
              {song.previewUrl ? (
                <button
                  type="button"
                  onClick={() => togglePreview(song)}
                  className="neu-btn w-full px-3 py-2 text-sm font-medium sm:w-auto"
                >
                  {previewSongId === song.id ? "Pause preview" : "Preview"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => openInDefaultMusicAppSearch(song)}
                className="neu-btn w-full px-3 py-2 text-sm font-medium sm:w-auto"
              >
                Open with app
              </button>
              <button
                type="button"
                onClick={() => loadSimilarSongs(song)}
                disabled={similarLoadingId === song.id}
                className="neu-btn warm-btn w-full px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {similarLoadingId === song.id ? "Loading..." : "Similar songs"}
              </button>
              <button
                type="button"
                onClick={() => shareSong(song)}
                className="neu-btn w-full px-3 py-2 text-sm font-medium sm:w-auto"
              >
                Share
              </button>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
