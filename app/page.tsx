"use client";

import { Song } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [suggestions, setSuggestions] = useState<Song[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setIsAutocompleteOpen(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/songs/search?q=${encodeURIComponent(term)}&limit=6`,
        );
        const data = (await response.json()) as { songs?: Song[] };
        if (!response.ok) return;
        setSuggestions(data.songs ?? []);
        setIsAutocompleteOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [query]);

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/songs/search?q=${encodeURIComponent(query)}`);
      const data = (await response.json()) as { songs?: Song[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Search failed.");
      }
      setSongs(data.songs ?? []);
      setIsAutocompleteOpen(false);
    } catch (err) {
      setSongs([]);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden px-6 py-10">
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
            onFocus={() => setIsAutocompleteOpen(suggestions.length > 0)}
            placeholder="Try: Blinding Lights"
            className="neu-inset w-full px-4 py-3 text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[#d09a6e]"
          />
          {isAutocompleteOpen && suggestions.length > 0 ? (
            <div className="neu-panel absolute z-20 mt-2 w-full p-2">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setQuery(item.name);
                    setIsAutocompleteOpen(false);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left hover:bg-[#f1dfc8]"
                >
                  <p className="text-sm font-semibold text-[var(--foreground)]">{item.name}</p>
                  <p className="text-xs text-[var(--muted)]">{item.artist}</p>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="neu-btn warm-btn px-5 py-2.5 font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-[#a33f2f]">{error}</p> : null}

      <section className="mx-auto mt-8 grid w-full max-w-4xl gap-4 sm:grid-cols-2">
        {songs.map((song) => (
          <Link
            key={song.id}
            href={`/song/${song.id}`}
            className="neu-panel p-4 transition hover:translate-y-[-1px]"
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
              <div>
                <h2 className="font-semibold text-[var(--foreground)]">{song.name}</h2>
                <p className="text-sm text-[var(--muted)]">{song.artist}</p>
                <p className="text-xs text-[var(--muted)]">{song.album}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
