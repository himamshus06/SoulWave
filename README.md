# Media Suggestions (iTunes MVP)

Simple iTunes-based recommendation app:
- Search songs
- Open details (song, artist, album art, preview link)
- View similar songs using Last.fm listener-behavior similarity + iTunes enrichment
- Share song pages using copy/share button
- Optional lyrics-mode lookup using Genius + iTunes mapping with lightweight theme scoring

## Setup

For basic iTunes search, no API keys are required.

For enhanced recommendations and lyrics mode, add in `.env.local`:

```env
LASTFM_API_KEY=your_lastfm_api_key
GENIUS_ACCESS_TOKEN=your_genius_api_token
```

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
