# Huddle Frontend

React + Vite + TypeScript client for Huddle. See the root README for the
full project overview and architecture.

## Local dev

1. `cp .env.example .env` and point `VITE_API_URL` at the running backend
   (defaults to `http://localhost:4000`).
2. `npm install`
3. `npm run dev` — serves at `http://localhost:5173`

## Tests

- `npm test` — Vitest + React Testing Library

## Build

- `npm run build` — type-checks then produces a production build in `dist/`

## Known limitations

- The access token lives only in Redux (not persisted) to limit XSS
  exposure; the refresh token is persisted to `localStorage` because the
  backend returns it in the JSON response body rather than an httpOnly
  cookie (see the backend's Known Limitations). On page reload, a silent
  refresh runs once using the stored refresh token.
- Offline support is an app-shell cache (via `vite-plugin-pwa`) plus an
  IndexedDB queue for outbound chat messages sent while offline — not a
  full offline-first data sync.
- Page content is a plain text field, not a rich block editor.
- `react-router-dom`'s current release line has an open npm-audit advisory
  (open-redirect via a backslash in `<Link>`/`useNavigate` targets) with no
  patched 6.x release available — only 7.x, a breaking upgrade not done
  given the timeline. The app never passes user-controlled input as a
  route target, so this isn't considered exploitable here, but it's worth
  revisiting on the next dependency bump.
