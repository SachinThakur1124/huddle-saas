# Huddle Frontend Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline, no per-task subagent — same rationale as the backend plan: same-day deadline). Lighter-weight than the backend plan by explicit user choice (2026-09-24): file lists + concrete code for the hard parts (DnD, sockets, optimistic updates, offline queue), standard-pattern code for routine CRUD forms, TDD still followed in practice (test before implementation) but not transcribed step-by-step for every field.

**Goal:** A React + Vite + TypeScript frontend consuming the Huddle backend:
auth, workspaces, Pages, Boards (drag & drop), Chat (realtime + infinite
scroll), search, dark mode, error boundaries, a minimal offline shell.

**Architecture:** Feature-folder layout (`features/auth`, `features/pages`,
`features/boards`, `features/chat`), Redux Toolkit + RTK Query for all data
fetching/caching/optimistic updates, React Router for routes, React Hook Form
+ Zod for forms, `@dnd-kit` for board drag & drop, a thin Socket.io client
wrapper that dispatches into RTK Query's cache on realtime events.

**Tech Stack:** React 18, Vite 5, TypeScript 5, Redux Toolkit + RTK Query,
React Router 6, React Hook Form + Zod, `@dnd-kit/core` +
`@dnd-kit/sortable`, `socket.io-client`, `vite-plugin-pwa`, Vitest + React
Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-24-huddle-saas-design.md` (§5
Frontend architecture)

## Global Constraints

- TypeScript strict mode.
- Backend base URL from `VITE_API_URL` env var (default
  `http://localhost:4000`), never hardcoded elsewhere.
- Access token kept in Redux state only (not localStorage, to limit XSS
  blast radius); refresh token is the httpOnly-cookie-free raw string
  returned by the backend, stored in localStorage since this backend does
  not set a cookie — documented as a known simplification vs. the spec's
  httpOnly-cookie design (backend Task 2 issues the refresh token in the
  JSON body, not a cookie, so the frontend has no choice here; noted in the
  root README's Known Limitations).
- Every route past `/login` and `/register` is behind a `ProtectedRoute`
  that redirects to `/login` when there is no access token.
- Dark mode preference persisted to `localStorage`, applied via a `data-
  theme` attribute on `<html>`, defaulting to the OS preference.

## Task 1: Scaffold, shell, dark mode, error boundaries

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`,
  `frontend/tsconfig.json`, `frontend/index.html`
- Create: `frontend/src/main.tsx`, `frontend/src/App.tsx`
- Create: `frontend/src/app/store.ts` (Redux store)
- Create: `frontend/src/app/api.ts` (RTK Query base `createApi` with
  `baseQuery` pointed at `VITE_API_URL`, `prepareHeaders` attaching the
  Redux-stored access token as `Authorization: Bearer <token>`)
- Create: `frontend/src/components/ErrorBoundary.tsx`
- Create: `frontend/src/components/ThemeToggle.tsx` +
  `frontend/src/app/theme.ts` (get/set/apply dark-mode preference)
- Create: `frontend/src/layout/AppShell.tsx` (sidebar nav + top bar +
  `<Outlet/>`, one `ErrorBoundary` per major route region)
- Test: `frontend/tests/ErrorBoundary.test.tsx` — a component that throws
  renders the fallback UI, not a blank screen or an unhandled crash.

**Interfaces:**
- Produces: `store` (Redux store) and `RootState`/`AppDispatch` types from
  `app/store.ts` — every later feature slice/api is added to this store.
- Produces: `api` (the RTK Query base) from `app/api.ts` — every feature's
  `injectEndpoints` call extends this same instance, so all data stays in
  one shared cache.
- Produces: `<ErrorBoundary fallback={...}>` component — wrapped around
  each route's content in `AppShell.tsx`.

`app/api.ts` (the piece worth writing in full — the auth-token wiring is
what every later feature depends on):

```typescript
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { RootState } from "./store";

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ["Workspace", "Page", "Board", "List", "Card", "Channel", "Message"],
  endpoints: () => ({}),
});
```

`ErrorBoundary.tsx` (class component — React error boundaries require a
class; this is the one legitimate use of `class` in the codebase):

```tsx
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
```

Test (write first, watch it fail on the missing module, then implement):

```tsx
// frontend/tests/ErrorBoundary.test.tsx
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../src/components/ErrorBoundary";

function Bomb(): never {
  throw new Error("boom");
}

it("renders the fallback instead of crashing when a child throws", () => {
  render(
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <Bomb />
    </ErrorBoundary>,
  );
  expect(screen.getByText("Something went wrong")).toBeInTheDocument();
});
```

Run `npm create vite@latest frontend -- --template react-ts` equivalent
setup manually (write the config files directly rather than via the
interactive CLI), `cd frontend && npm install`, then
`npm install @reduxjs/toolkit react-redux react-router-dom react-hook-form
zod @hookform/resolvers @dnd-kit/core @dnd-kit/sortable socket.io-client
vite-plugin-pwa` and `npm install -D vitest @testing-library/react
@testing-library/jest-dom jsdom @vitejs/plugin-react`.

**Commit:** `feat(frontend): scaffold Vite+React+TS app, store, dark mode, error boundaries`

## Task 2: Auth feature (login/register/logout, protected routes)

**Files:**
- Create: `frontend/src/features/auth/authSlice.ts` (Redux slice holding
  `accessToken`, `refreshToken`, `user`; `login`/`logout` reducers)
- Create: `frontend/src/features/auth/authApi.ts` (`injectEndpoints` on
  `api`: `register`, `login`, `refresh`, `logout` mutations)
- Create: `frontend/src/features/auth/LoginPage.tsx`,
  `RegisterPage.tsx` (React Hook Form + Zod resolver)
- Create: `frontend/src/features/auth/ProtectedRoute.tsx`
- Test: `frontend/tests/authSlice.test.ts` — `login` reducer stores the
  token pair; `logout` clears them.

**Interfaces:**
- Consumes: `api` from Task 1.
- Produces: `authSlice.actions.{setCredentials, clearCredentials}`,
  `selectAccessToken(state)` — consumed by `app/api.ts`'s
  `prepareHeaders` (Task 1, wired here) and by every feature's
  `ProtectedRoute` usage.

Zod schema + form pattern (the pattern every later CRUD form in this plan
reuses — write it once, correctly, here):

```tsx
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
type FormValues = z.infer<typeof schema>;

const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
  resolver: zodResolver(schema),
});
```

On successful login/register, dispatch `setCredentials({ user, accessToken,
refreshToken })` and navigate to `/workspaces`. `ProtectedRoute` reads
`selectAccessToken`; if falsy, `<Navigate to="/login" replace />`.

**Commit:** `feat(frontend): auth feature with login/register and protected routes`

## Task 3: Workspaces + Pages

**Files:**
- Create: `frontend/src/features/workspaces/workspacesApi.ts`
  (`listWorkspaces`, `createWorkspace`)
- Create: `frontend/src/features/workspaces/WorkspaceListPage.tsx`,
  `WorkspaceSwitcher.tsx` (in `AppShell`'s top bar)
- Create: `frontend/src/features/pages/pagesApi.ts` (`listPages`,
  `getPage`, `createPage`, `updatePage`, `deletePage`, tagged `Page` for
  cache invalidation on mutation)
- Create: `frontend/src/features/pages/PagesListPage.tsx`,
  `PageDetailPage.tsx` (title input + a plain `<textarea>` bound to
  `contentJson.text` — a full block editor is out of scope for today,
  documented as a Known Limitation)
- Test: `frontend/tests/pagesApi.test.ts` — mock fetch, assert
  `createPage` invalidates the `Page` list tag (cache actually refetches).

**Interfaces:**
- Consumes: `api` (Task 1), `ProtectedRoute` (Task 2).
- Produces: `useListWorkspacesQuery`, `useCreateWorkspaceMutation`,
  `useListPagesQuery`, `useCreatePageMutation`, etc. — the RTK Query hook
  naming convention every later feature (Boards, Chat) follows exactly.

**Commit:** `feat(frontend): workspaces and Pages CRUD`

## Task 4: Boards — drag & drop with optimistic move

**Files:**
- Create: `frontend/src/features/boards/boardsApi.ts` (`listBoards`,
  `createBoard`, `createList`, `createCard`, `moveCard` — `moveCard` uses
  `onQueryStarted` to optimistically patch the card's `listId`/`position`
  into the cached board data before the request resolves, rolling back on
  failure)
- Create: `frontend/src/features/boards/BoardPage.tsx` (lists rendered as
  `@dnd-kit` sortable columns, cards as sortable items within each)
- Test: `frontend/tests/boardsApi.test.ts` — dispatching `moveCard` updates
  the cached card's list immediately (before the mocked request resolves),
  and rolls back if the request rejects.

**Interfaces:**
- Consumes: `boardsApi` cache tags from Task 1's `tagTypes`.
- Produces: `useMoveCardMutation` — the optimistic-update pattern this task
  establishes; Task 5's chat "send message" optimistic update mirrors it.

The optimistic-update pattern (concrete code, since this is the trickiest
piece in the frontend and the plan must not hand-wave it):

```typescript
moveCard: builder.mutation<
  { ok: true },
  { workspaceId: string; boardId: string; cardId: string; toListId: string; toPosition: number }
>({
  query: ({ workspaceId, boardId, cardId, ...body }) => ({
    url: `/workspaces/${workspaceId}/boards/cards/${cardId}/move`,
    method: "POST",
    body,
  }),
  async onQueryStarted({ workspaceId, boardId, cardId, toListId, toPosition }, { dispatch, queryFulfilled }) {
    const patch = dispatch(
      boardsApi.util.updateQueryData("getBoard", { workspaceId, boardId }, (draft) => {
        const card = draft.cards.find((c) => c._id === cardId);
        if (card) {
          card.listId = toListId;
          card.position = toPosition;
        }
      }),
    );
    try {
      await queryFulfilled;
    } catch {
      patch.undo();
    }
  },
}),
```

DnD wiring uses `@dnd-kit/core`'s `DndContext` + `onDragEnd`, calling
`moveCard` with the drop target's list id and computed index — standard
`@dnd-kit` sortable-across-containers pattern, implemented directly against
this API shape.

**Commit:** `feat(frontend): Boards with drag-and-drop and optimistic card moves`

## Task 5: Chat — realtime + infinite scroll

**Files:**
- Create: `frontend/src/features/chat/chatApi.ts` (`listChannels`,
  `createChannel`, `listMessages` with `{before, limit}` args,
  `sendMessage` with an optimistic append)
- Create: `frontend/src/features/chat/socket.ts` (thin wrapper: connects
  with the Redux access token, `workspace:join`, dispatches
  `chatApi.util.updateQueryData` on `message:new` and `card:moved`)
- Create: `frontend/src/features/chat/ChatPage.tsx` (message list with a
  top `IntersectionObserver` sentinel that calls `listMessages` with
  `before: oldestMessageId` when it scrolls into view; message composer)
- Test: `frontend/tests/socket.test.ts` — a `message:new` event received
  from a mocked socket results in the message appearing in the RTK Query
  cache for that channel (assert via `store.getState()`, not a UI render).

**Interfaces:**
- Consumes: `boardsApi` optimistic-update pattern (Task 4) — `sendMessage`
  mirrors it. Consumes `api` cache (Task 1).
- Produces: `connectSocket(store)` — called once from `App.tsx` after
  login, disconnected on logout.

**Commit:** `feat(frontend): Chat with Socket.io realtime and infinite scroll`

## Task 6: Search, offline shell, polish

**Files:**
- Create: `frontend/src/features/search/SearchBar.tsx` +
  `searchApi.ts` (debounced query against `/workspaces/:id/search`)
- Modify: `frontend/vite.config.ts` (add `vite-plugin-pwa` with a minimal
  `manifest` + `workbox` config caching the app shell only — no attempt at
  full offline data sync, documented as a Known Limitation per the spec's
  Tier 3 scope)
- Create: `frontend/src/app/offlineQueue.ts` (IndexedDB-backed queue: when
  `sendMessage` fails with a network error, queue `{channelId, body}` in
  IndexedDB via the `idb` package; flush the queue on the browser's
  `online` event)
- Test: `frontend/tests/offlineQueue.test.ts` — enqueue then flush calls
  the provided send function once per queued item and clears the queue.

**Commit:** `feat(frontend): search, offline queue, PWA shell`

## Task 7: Wrap-up

- [ ] Run `npm run build` in `frontend/` — confirm a production build
      succeeds with no TypeScript errors.
- [ ] Run `npm test` — confirm all frontend tests pass.
- [ ] Write `frontend/README.md` (dev server, env vars, build).
- [ ] Commit: `docs(frontend): add frontend README`
