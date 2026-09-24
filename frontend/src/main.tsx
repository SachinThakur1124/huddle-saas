import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Provider, useDispatch } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { store, AppDispatch } from "./app/store";
import { applyTheme, getPreferredTheme } from "./app/theme";
import { setCredentials } from "./features/auth/authSlice";
import { authApi } from "./features/auth/authApi";
import { connectSocket, disconnectSocket } from "./features/chat/socket";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { App } from "./App";
import "./index.css";

applyTheme(getPreferredTheme());

function SilentRefreshAndSocket() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const state = store.getState();
      if (state.auth.accessToken || !state.auth.refreshToken) return;
      try {
        const result = await dispatch(
          authApi.endpoints.refresh.initiate({ refreshToken: state.auth.refreshToken }),
        ).unwrap();
        if (cancelled) return;
        dispatch(
          setCredentials({
            user: state.auth.user ?? { id: "", email: "", name: "" },
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          }),
        );
      } catch {
        // stale/expired refresh token — user stays logged out, ProtectedRoute redirects
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    return store.subscribe(() => {
      const token = store.getState().auth.accessToken;
      if (token) connectSocket(store);
      else disconnectSocket();
    });
  }, []);

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
          <SilentRefreshAndSocket />
        </BrowserRouter>
      </Provider>
    </ErrorBoundary>
  </StrictMode>,
);
