import { Song } from "@/lib/types";

type Theme =
  | "love"
  | "melancholy"
  | "energy"
  | "nostalgia"
  | "confidence"
  | "party"
  | "healing";

const THEME_KEYWORDS: Record<Theme, string[]> = {
  love: ["love", "heart", "kiss", "romance", "baby", "darling", "forever"],
  melancholy: ["alone", "tears", "cry", "broken", "sad", "lonely", "goodbye", "hurt"],
  energy: ["fire", "dance", "run", "night", "beat", "wild", "power", "electric"],
  nostalgia: ["memories", "old", "yesterday", "summer", "home", "again", "back", "remember"],
  confidence: ["strong", "boss", "win", "fearless", "unstoppable", "queen", "king"],
  party: ["party", "club", "drink", "friday", "weekend", "dj", "lights"],
  healing: ["breathe", "rise", "heal", "calm", "peace", "light", "hope"],
};

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(text: string) {
  return normalize(text).split(" ").filter(Boolean);
}

export function inferThemes(text: string) {
  const tokens = new Set(tokenize(text));
  const scored = Object.entries(THEME_KEYWORDS)
    .map(([theme, words]) => {
      const score = words.reduce((sum, word) => sum + Number(tokens.has(word)), 0);
      return { theme: theme as Theme, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((item) => item.theme);
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
