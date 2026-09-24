import { api } from "../../app/api";

export interface SearchResult {
  type: "page" | "card" | "message";
  id: string;
  workspaceId: string;
  title: string;
  score: number;
}

export const searchApi = api.injectEndpoints({
  endpoints: (builder) => ({
    search: builder.query<SearchResult[], { workspaceId: string; q: string }>({
      query: ({ workspaceId, q }) => ({
        url: `/workspaces/${workspaceId}/search`,
        params: { q },
      }),
    }),
  }),
});

export const { useLazySearchQuery } = searchApi;
