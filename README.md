# PlaylistSorter

SvelteKit app that sorts playlists by genre, with a small Express proxy for Spotify API calls.

## Local development
- Install deps: `npm install`
- Start proxy: `npm run start` (listens on http://127.0.0.1:10000)
- Start app: `npm run dev` (default http://127.0.0.1:5173)
- `.env.local` already has `VITE_API_BASE=http://127.0.0.1:10000`

## Backend proxy on Render
- Create a Web Service from this repo (or a backend-only copy)
- Runtime: Node 18+; Start command: `npm start`; Build command: leave empty or `npm install`
- Env: `ALLOWED_ORIGINS=https://<yourusername>.github.io`
- Note the deployed URL, e.g. `https://your-service.onrender.com`

## GitHub Pages deployment
- Base path is preconfigured as `/PlaylistSorter` in production
- Set repository secret `VITE_API_BASE` to your Render URL
- Workflow: `.github/workflows/gh-pages.yml` builds and deploys the static `build/` output to Pages
- Spotify redirect URI for production: `https://<yourusername>.github.io/PlaylistSorter/callback`

## Spotify app settings (required)
- Add both redirect URIs in the Spotify dashboard:
	- Local: `http://127.0.0.1:5173/callback`
	- GitHub Pages: `https://<yourusername>.github.io/PlaylistSorter/callback`
- Client ID is already in the app code; ensure the app is set to public in the dashboard.
