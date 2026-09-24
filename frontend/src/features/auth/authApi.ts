import { api } from "../../app/api";
import type { PublicUser } from "./authSlice";

interface TokenPair {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    register: builder.mutation<TokenPair, { email: string; password: string; name: string }>({
      query: (body) => ({ url: "/auth/register", method: "POST", body }),
    }),
    login: builder.mutation<TokenPair, { email: string; password: string }>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
    }),
    refresh: builder.mutation<
      { accessToken: string; refreshToken: string },
      { refreshToken: string }
    >({
      query: (body) => ({ url: "/auth/refresh", method: "POST", body }),
    }),
    logout: builder.mutation<void, { refreshToken: string }>({
      query: (body) => ({ url: "/auth/logout", method: "POST", body }),
    }),
    me: builder.query<PublicUser, void>({
      query: () => "/auth/me",
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useRefreshMutation,
  useLogoutMutation,
  useMeQuery,
} = authApi;
