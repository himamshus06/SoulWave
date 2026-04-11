"use client";

import { Song } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

const PAGE_SIZE = 12;

export type SimilarApiResponse = {
  songs?: Song[];
  hasMore?: boolean;
  total?: number;
  offset?: number;
  provider?: string;
  lastFmError?: string | null;
  error?: string;
};

async function fetchSimilarPage(songId: string, offset: number, limit: number): Promise<SimilarApiResponse> {
  const res = await fetch(
    `/api/songs/${encodeURIComponent(songId)}/similar?offset=${offset}&limit=${limit}`,
  );
  const data = (await res.json()) as SimilarApiResponse;
  if (!res.ok) {
    throw new Error(data.error || "Failed to load similar songs.");
  }
  return data;
}

export function useInfiniteSimilar(seedId: string | null) {
  const [items, setItems] = useState<Song[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [phase, setPhase] = useState<"idle" | "initial" | "ready" | "loadingMore" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ provider?: string; lastFmError?: string | null; total?: number }>({});

  const busy = useRef(false);
  const hasMoreRef = useRef(true);
  const seedRef = useRef<string | null>(null);
  const itemsRef = useRef<Song[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const loadMore = useCallback(async () => {
    const id = seedRef.current;
    if (!id || busy.current || !hasMoreRef.current) return;
    const offset = itemsRef.current.length;
    busy.current = true;
    setPhase((p) => (p === "ready" ? "loadingMore" : p));
    setError(null);
    try {
      const data = await fetchSimilarPage(id, offset, PAGE_SIZE);
      if (seedRef.current !== id) return;

      const batch = data.songs ?? [];
      if (batch.length === 0) {
        setHasMore(false);
        hasMoreRef.current = false;
        setPhase("ready");
        return;
      }

      setItems((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        const merged = [...prev];
        for (const s of batch) {
          if (!seen.has(s.id)) {
            seen.add(s.id);
            merged.push(s);
          }
        }
        return merged;
      });

      const more = data.hasMore ?? false;
      setHasMore(more);
      hasMoreRef.current = more;
      setMeta((m) => ({
        ...m,
        provider: data.provider ?? m.provider,
        lastFmError: data.lastFmError ?? m.lastFmError,
        total: data.total ?? m.total,
      }));
      setPhase("ready");
    } catch (e) {
      if (seedRef.current === id) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setPhase("error");
      }
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    seedRef.current = seedId;
    if (!seedId) {
      setItems([]);
      itemsRef.current = [];
      setHasMore(true);
      hasMoreRef.current = true;
      setPhase("idle");
      setError(null);
      setMeta({});
      busy.current = false;
      return;
    }

    let cancelled = false;
    busy.current = true;
    setPhase("initial");
    setError(null);
    setItems([]);
    itemsRef.current = [];
    setHasMore(true);
    hasMoreRef.current = true;
    setMeta({});

    const startedFor = seedId;
    (async () => {
      try {
        const data = await fetchSimilarPage(startedFor, 0, PAGE_SIZE);
        if (cancelled || seedRef.current !== startedFor) return;

        const first = data.songs ?? [];
        setItems(first);
        itemsRef.current = first;
        const more = first.length > 0 ? (data.hasMore ?? false) : false;
        setHasMore(more);
        hasMoreRef.current = more;
        setMeta({
          provider: data.provider,
          lastFmError: data.lastFmError ?? null,
          total: data.total,
        });
        setPhase("ready");
      } catch (e) {
        if (!cancelled && seedRef.current === startedFor) {
          setError(e instanceof Error ? e.message : "Something went wrong.");
          setPhase("error");
          setHasMore(false);
          hasMoreRef.current = false;
        }
      } finally {
        if (!cancelled) busy.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [seedId]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!seedId || !node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (busy.current || !hasMoreRef.current) return;
        void loadMore();
      },
      { root: null, rootMargin: "320px", threshold: 0 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [seedId, loadMore]);

  return {
    items,
    hasMore,
    phase,
    error,
    meta,
    sentinelRef,
    isInitialLoading: phase === "initial",
    isLoadingMore: phase === "loadingMore",
  };
}
