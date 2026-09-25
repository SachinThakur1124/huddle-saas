import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Provider, useDispatch, useSelector } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { store, AppDispatch, RootState } from "./app/store";
import { applyTheme, getPreferredTheme } from "./app/theme";
import { setCredentials, clearCredentials, selectAccessToken } from "./features/auth/authSlice";
import { authApi } from "./features/auth/authApi";
import { connectSocket, disconnectSocket } from "./features/chat/socket";
import { chatApi } from "./features/chat/chatApi";
import { pagesApi } from "./features/pages/pagesApi";
import { boardsApi } from "./features/boards/boardsApi";
import { flushQueue, QueuedAction } from "./app/offlineQueue";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { App } from "./App";
import "./index.css";

applyTheme(getPreferredTheme());

// Module-level (not component-state) so React StrictMode's deliberate
// double-invoke of effects in dev — and any accidental remount — can only
// ever trigger ONE real /auth/refresh call. Redeeming the same refresh
// token twice in parallel trips the backend's reuse-detection and revokes
// the whole token family (see authService.ts refresh()).
let bootstrapPromise: Promise<void> | null = null;

function bootstrapAuth(dispatch: AppDispatch, getState: () => RootState) {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const { refreshToken } = getState().auth;
      if (!refreshToken) {
        dispatch(clearCredentials());
        return;
      }
      try {
        const result = await dispatch(
          authApi.endpoints.refresh.initiate({ refreshToken }),
        ).unwrap();
        // Apply the new token pair BEFORE fetching /auth/me — api.ts reads
        // state.auth.accessToken for the Authorization header, and the old
        // refresh token has already been rotated/revoked server-side by
        // the call above, so anything that reads state.auth before this
        // dispatch would still see the stale (now-dead) refresh token.
        dispatch(
          setCredentials({
            user: getState().auth.user ?? { id: "", email: "", name: "" },
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          }),
        );
        const user = await dispatch(authApi.endpoints.me.initiate(undefined, { forceRefetch: true }))
          .unwrap()
          .catch(() => null);
        if (user) {
          dispatch(setCredentials({ user, accessToken: result.accessToken, refreshToken: result.refreshToken }));
        }
      } catch {
        dispatch(clearCredentials());
      }
    })();
  }
  return bootstrapPromise;
}

function AuthAndSocketLifecycle() {
  const dispatch = useDispatch<AppDispatch>();
  const accessToken = useSelector(selectAccessToken);

  useEffect(() => {
    bootstrapAuth(dispatch, store.getState);
  }, [dispatch]);

  useEffect(() => {
    if (accessToken) connectSocket(dispatch, accessToken);
    else disconnectSocket();
  }, [accessToken, dispatch]);

  useEffect(() => {
    function handleOnline() {
      flushQueue({
        message: (a: Extract<QueuedAction, { kind: "message" }>) =>
          dispatch(
            chatApi.endpoints.sendMessage.initiate({
              workspaceId: a.workspaceId,
              channelId: a.channelId,
              body: a.body,
            }),
          ).unwrap(),
        page: (a: Extract<QueuedAction, { kind: "page" }>) =>
          dispatch(pagesApi.endpoints.createPage.initiate({ workspaceId: a.workspaceId, title: a.title })).unwrap(),
        board: (a: Extract<QueuedAction, { kind: "board" }>) =>
          dispatch(boardsApi.endpoints.createBoard.initiate({ workspaceId: a.workspaceId, title: a.title })).unwrap(),
        channel: (a: Extract<QueuedAction, { kind: "channel" }>) =>
          dispatch(chatApi.endpoints.createChannel.initiate({ workspaceId: a.workspaceId, name: a.name })).unwrap(),
        card: (a: Extract<QueuedAction, { kind: "card" }>) =>
          dispatch(
            boardsApi.endpoints.createCard.initiate({
              workspaceId: a.workspaceId,
              boardId: a.boardId,
              listId: a.listId,
              title: a.title,
            }),
          ).unwrap(),
      }).catch(() => {
        // best-effort: whatever's left stays queued for the next `online` event
      });
    }
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [dispatch]);

  return <App />;
}

function RootFallback() {
  return (
    <div className="error-fallback">
      <h2>Something went wrong.</h2>
      <p>Try reloading the page.</p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary fallback={<RootFallback />}>
      <Provider store={store}>
        <BrowserRouter>
          <AuthAndSocketLifecycle />
        </BrowserRouter>
      </Provider>
    </ErrorBoundary>
  </StrictMode>,
);
