import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  refreshToken: string | null;
}

function loadPersistedRefreshToken(): string | null {
  try {
    return localStorage.getItem("huddle-refresh-token");
  } catch {
    return null;
  }
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: loadPersistedRefreshToken(),
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
