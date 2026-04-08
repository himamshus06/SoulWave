export type Song = {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArt: string | null;
  previewUrl: string | null;
  externalUrl: string | null;
};

export type Playlist = {
  id: string;
  name: string;
  songs: Song[];
};

export type MusicProvider = "itunes" | "lastfm" | "lastfm+itunes";
