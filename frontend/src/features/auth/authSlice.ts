import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

type AuthStatus = "refreshing" | "ready";

interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  // "refreshing" only while a persisted refresh token is being redeemed
  // for a fresh access token on app boot (see main.tsx's bootstrapAuth) —
  // ProtectedRoute shows a loading state instead of bouncing to /login
  // during that window.
  status: AuthStatus;
}

function loadPersistedRefreshToken(): string | null {
  try {
    return localStorage.getItem("huddle-refresh-token");
  } catch {
    return null;
  }
}

const initialRefreshToken = loadPersistedRefreshToken();

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: initialRefreshToken,
  status: initialRefreshToken ? "refreshing" : "ready",
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{ user: PublicUser; accessToken: string; refreshToken: string }>,
    ) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.status = "ready";
      try {
        localStorage.setItem("huddle-refresh-token", action.payload.refreshToken);
      } catch {
        // best-effort persistence only
      }
    },
    clearCredentials(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.status = "ready";
      try {
        localStorage.removeItem("huddle-refresh-token");
      } catch {
        // best-effort
      }
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export const authReducer = authSlice.reducer;

export function selectAccessToken(state: { auth: AuthState }): string | null {
  return state.auth.accessToken;
}

export function selectCurrentUser(state: { auth: AuthState }): PublicUser | null {
  return state.auth.user;
}

export function selectAuthStatus(state: { auth: AuthState }): AuthStatus {
  return state.auth.status;
}
