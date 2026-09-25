# Huddle Frontend

React + Vite + TypeScript client for Huddle. See the root README for the
full project overview and architecture.

## Local dev

1. `cp .env.example .env` and point `VITE_API_URL` at the running backend
   (defaults to `http://localhost:4000`).
2. `npm install`
3. `npm run dev` — serves at `http://localhost:5173`

## Tests

- `npm test` — Vitest + React Testing Library (7 tests)
- `npm run lint` — same check CI runs

## Build

- `npm run build` — type-checks then produces a production build in `dist/`

## Auth session handling

The access token lives only in Redux (not persisted) to limit XSS exposure
and expires after 15 minutes; the refresh token is persisted to
`localStorage` because the backend returns it in the JSON response body
rather than an httpOnly cookie (see the backend's Known Limitations).
- On page reload, `main.tsx` redeems the persisted refresh token once
  (guarded against React StrictMode's double-invoke) before rendering any
  protected route, showing a loading state in the meantime.
- Once logged in, `app/api.ts`'s `baseQueryWithReauth` transparently
  refreshes on any 401 and retries the original request, so a session
  doesn't silently break mid-use when the access token expires.

## Known limitations
- Offline support is an app-shell cache (via `vite-plugin-pwa`) plus an
  IndexedDB queue covering chat messages and page/board/card/channel
  creation while offline, replayed in queued order on the `online` event
  — not a full offline-first data sync (edits to existing content, board
  moves, etc. still require a live connection).
- Page content is a plain text field, not a rich block editor.
- `react-router-dom`'s current release line has an open npm-audit advisory
  (open-redirect via a backslash in `<Link>`/`useNavigate` targets) with no
  patched 6.x release available — only 7.x, a breaking upgrade not done
  given the timeline. The app never passes user-controlled input as a
  route target, so this isn't considered exploitable here, but it's worth
  revisiting on the next dependency bump.
