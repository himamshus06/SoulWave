# SoulWave

Song discovery app built on iTunes, with optional Last.fm + Genius enrichment.

## Features

- **Song search (iTunes)**: fast search results with album art, artist, and album.
- **Voice input**: dictate your search query from the home page.
- **Inline preview (no player controls)**: play/pause a track preview directly in the results list (only one preview plays at a time).
- **Result actions always visible**:
  - **Preview** (inline play/pause)
  - **Open with app** (tries Spotify / Apple Music / YouTube Music, with web fallback)
  - **Similar songs** (refreshes the results grid in-place; no navigation)
  - **Share** (Web Share API when available, otherwise copies a link)
- **Song pages**: `/song/[id]` shows the song details and a similar-songs section.
- **Similar-song recommendations**:
  - Uses **Last.fm** similarity when configured
  - Falls back to **iTunes** with diversification to avoid “same artist only” lists
- **Optional lyrics-mode search** (Genius): lyrics-driven lookup when configured.

## Setup

For basic iTunes search, no API keys are required.

For enhanced recommendations and lyrics mode, add these to `.env.local`:

```env
LASTFM_API_KEY=your_lastfm_api_key
GENIUS_ACCESS_TOKEN=your_genius_api_token
```

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying on Vercel

- Add the same environment variables in **Vercel → Project Settings → Environment Variables** (for **Production** and **Preview**) and redeploy.
- If you update env vars, **redeploy** so the functions pick up the changes.
