import { api } from "../../app/api";

export interface Page {
  _id: string;
  workspaceId: string;
  parentId: string | null;
  title: string;
  contentJson: { text?: string } | unknown;
}

export const pagesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    listPages: builder.query<Page[], { workspaceId: string }>({
      query: ({ workspaceId }) => `/workspaces/${workspaceId}/pages`,
      providesTags: ["Page"],
    }),
    getPage: builder.query<Page, { workspaceId: string; pageId: string }>({
      query: ({ workspaceId, pageId }) => `/workspaces/${workspaceId}/pages/${pageId}`,
      providesTags: (_r, _e, { pageId }) => [{ type: "Page", id: pageId }],
    }),
    createPage: builder.mutation<Page, { workspaceId: string; title: string }>({
      query: ({ workspaceId, title }) => ({
        url: `/workspaces/${workspaceId}/pages`,
        method: "POST",
        body: { title, contentJson: { text: "" } },
      }),
      invalidatesTags: ["Page"],
    }),
    updatePage: builder.mutation<
      Page,
      { workspaceId: string; pageId: string; title?: string; contentJson?: unknown }
    >({
      query: ({ workspaceId, pageId, ...patch }) => ({
        url: `/workspaces/${workspaceId}/pages/${pageId}`,
        method: "PATCH",
        body: patch,
      }),
      invalidatesTags: (_r, _e, { pageId }) => [{ type: "Page", id: pageId }, "Page"],
    }),
    deletePage: builder.mutation<void, { workspaceId: string; pageId: string }>({
      query: ({ workspaceId, pageId }) => ({
        url: `/workspaces/${workspaceId}/pages/${pageId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Page"],
    }),
  }),
});

export const {
  useListPagesQuery,
  useGetPageQuery,
  useCreatePageMutation,
  useUpdatePageMutation,
  useDeletePageMutation,
} = pagesApi;
