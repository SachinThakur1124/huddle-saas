import {
  createApi,
  fetchBaseQuery,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { Mutex } from "async-mutex";
import type { RootState } from "./store";
import { setCredentials, clearCredentials } from "../features/auth/authSlice";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

// A 15-minute access token WILL expire mid-session. On a 401, refresh once
// (behind a mutex — the backend's refresh-token rotation revokes the whole
// token family if two requests redeem the same refresh token in parallel,
// so concurrent 401s must not each trigger their own refresh) and retry
// the original request. If the refresh itself fails, log the user out.
const mutex = new Mutex();

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  apiCtx,
  extraOptions,
) => {
  await mutex.waitForUnlock();
  let result = await rawBaseQuery(args, apiCtx, extraOptions);

  if (result.error?.status === 401) {
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      try {
        const state = apiCtx.getState() as RootState;
        const refreshToken = state.auth.refreshToken;
        if (!refreshToken) {
          apiCtx.dispatch(clearCredentials());
          return result;
        }
        const refreshResult = await rawBaseQuery(
          { url: "/auth/refresh", method: "POST", body: { refreshToken } },
          apiCtx,
          extraOptions,
        );
        if (refreshResult.data) {
          const { accessToken, refreshToken: newRefreshToken } = refreshResult.data as {
            accessToken: string;
            refreshToken: string;
          };
          apiCtx.dispatch(
            setCredentials({
              user: state.auth.user ?? { id: "", email: "", name: "" },
              accessToken,
              refreshToken: newRefreshToken,
            }),
          );
          result = await rawBaseQuery(args, apiCtx, extraOptions);
        } else {
          apiCtx.dispatch(clearCredentials());
        }
      } finally {
        release();
      }
    } else {
      // Another request is already refreshing — wait for it, then retry
      // this one with whatever token it ends up with.
      await mutex.waitForUnlock();
      result = await rawBaseQuery(args, apiCtx, extraOptions);
    }
  }

  return result;
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Workspace", "Page", "Board", "List", "Card", "Channel", "Message"],
  endpoints: () => ({}),
});
