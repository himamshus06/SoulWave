"use client";

import { Song } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    } catch (err) {
      setSongs([]);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Media Suggestions</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Search songs with iTunes and discover similar tracks.
      </p>

      <form onSubmit={onSearch} className="mt-8 flex gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try: Blinding Lights"
          className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2.5 outline-none ring-indigo-500 focus:ring-2"
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="rounded-md bg-indigo-600 px-5 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:bg-indigo-300"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {songs.map((song) => (
          <Link
            key={song.id}
            href={`/song/${song.id}`}
            className="rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-indigo-300"
          >
            <div className="flex items-center gap-4">
              {song.albumArt ? (
                <Image
                  src={song.albumArt}
                  alt={song.album}
                  width={72}
                  height={72}
                  className="rounded-md object-cover"
                />
              ) : (
                <div className="h-[72px] w-[72px] rounded-md bg-zinc-200" />
              )}
              <div>
                <h2 className="font-semibold">{song.name}</h2>
                <p className="text-sm text-zinc-600">{song.artist}</p>
                <p className="text-xs text-zinc-500">{song.album}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
