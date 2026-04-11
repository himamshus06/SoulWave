import { Song } from "@/lib/types";

type Theme =
  | "love"
  | "melancholy"
  | "energy"
  | "nostalgia"
  | "confidence"
  | "party"
  | "healing"
  | "rebellion"
  | "nature"
  | "journey";

/** Prefix stems (length ≥ 4) so e.g. "heart" matches "heartbreak", "danc" matches "dance"/"dancing". Short tokens use exact match. */
const THEME_STEMS: Record<Theme, string[]> = {
  love: ["love", "heart", "kiss", "roma", "baby", "darl", "forev", "honey", "soul"],
  melancholy: ["alon", "tear", "cry", "brok", "sad", "lone", "goodb", "hurt", "pain", "empt", "miss"],
  energy: ["fire", "danc", "run", "nigh", "beat", "wild", "powe", "elec", "puls", "rush", "loud"],
  nostalgia: ["memor", "yeste", "summe", "home", "again", "remem", "child", "past", "old", "back"],
  confidence: ["stron", "boss", "fearl", "unsto", "queen", "king", "champ", "crown", "win"],
  party: ["party", "club", "drink", "frida", "weeken", "light", "toast", "dj"],
  healing: ["breat", "rise", "heal", "calm", "peace", "light", "hope", "soft", "warm"],
  rebellion: ["rebel", "fight", "riot", "chaos", "break", "rage", "anarc", "punk", "war"],
  nature: ["rain", "wind", "sky", "star", "moon", "ocean", "tree", "flow", "sun", "storm", "bird"],
  journey: ["road", "mile", "driv", "leav", "path", "dest", "world", "fly", "train", "home"],
};

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(text: string) {
  return normalize(text).split(" ").filter(Boolean);
}

function tokenMatchesStem(token: string, stem: string) {
  if (stem.length >= 4) return token.startsWith(stem);
  return token === stem;
}

export function inferThemes(text: string) {
  const tokens = tokenize(text);
  const scored = Object.entries(THEME_STEMS)
    .map(([theme, stems]) => {
      let score = 0;
      for (const token of tokens) {
        for (const stem of stems) {
          if (tokenMatchesStem(token, stem)) score += 1;
        }
      }
      return { theme: theme as Theme, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((item) => item.theme);
}

function themeJaccard(seedText: string, candidateText: string) {
  const a = new Set(inferThemes(seedText));
  const b = new Set(inferThemes(candidateText));
  if (a.size === 0 && b.size === 0) return 0.5;
  if (a.size === 0 || b.size === 0) return 0.2;
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

function genreCompatibility(seedGenre: string | null | undefined, songGenre: string | null | undefined) {
  if (!seedGenre?.trim() || !songGenre?.trim()) return 0.5;
  const s = seedGenre.toLowerCase();
  const t = songGenre.toLowerCase();
  if (s === t) return 1;
  if (s.includes(t) || t.includes(s)) return 0.75;
  return 0.2;
}

export type ScoredSong = {
  song: Song;
  /** Last.fm match 0–1, or baseline (e.g. 0.15) for iTunes-only candidates */
  lastFmMatch: number;
};

/**
 * Composite ranking: 50% Last.fm-style match, 30% theme overlap (Jaccard on inferred themes), 20% genre fit.
 */
export function rankCandidates(items: ScoredSong[], seed: Song, seedText: string): Song[] {
  if (items.length === 0) return [];
  const seedGenre = seed.genre;
  const ranked = items.map((item) => {
    const candidateText = `${item.song.name} ${item.song.artist} ${item.song.album}`;
    const themeScore = themeJaccard(seedText, candidateText);
    const genreScore = genreCompatibility(seedGenre, item.song.genre);
    const match = Math.min(1, Math.max(0, item.lastFmMatch));
    const composite = 0.5 * match + 0.3 * themeScore + 0.2 * genreScore;
    return { song: item.song, composite };
  });
  ranked.sort((a, b) => b.composite - a.composite);
  return ranked.map((r) => r.song);
}

export function rankSongsByTheme(songs: Song[], seedText: string) {
  const seedThemes = inferThemes(seedText);
  if (seedThemes.length === 0) return songs;

  const topSeedThemes = new Set(seedThemes.slice(0, 2));
  return [...songs].sort((a, b) => {
    const aThemes = inferThemes(`${a.name} ${a.artist} ${a.album}`);
    const bThemes = inferThemes(`${b.name} ${b.artist} ${b.album}`);
    const aScore = aThemes.reduce((sum, t) => sum + Number(topSeedThemes.has(t)), 0);
    const bScore = bThemes.reduce((sum, t) => sum + Number(topSeedThemes.has(t)), 0);
    return bScore - aScore;
  });
}
