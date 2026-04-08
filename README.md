# Media Suggestions (iTunes MVP)

Simple iTunes-based recommendation app:
- Search songs
- Open details (song, artist, album art, preview link)
- View similar songs (artist-based)
- Share song pages using copy/share button
- Optional lyrics-mode lookup using Genius + iTunes mapping

## Setup

No API keys required for standard mode.

For lyrics mode, add in `.env.local`:

```env
GENIUS_ACCESS_TOKEN=your_genius_api_token
```

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
