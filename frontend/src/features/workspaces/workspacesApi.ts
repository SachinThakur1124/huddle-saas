import { api } from "../../app/api";

export interface Workspace {
  _id: string;
  name: string;
  slug: string;
}

export const workspacesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    listWorkspaces: builder.query<Workspace[], void>({
      query: () => "/workspaces",
      providesTags: ["Workspace"],
    }),
    createWorkspace: builder.mutation<Workspace, { name: string }>({
      query: (body) => ({ url: "/workspaces", method: "POST", body }),
      invalidatesTags: ["Workspace"],
    }),
  }),
});

export const { useListWorkspacesQuery, useCreateWorkspaceMutation } = workspacesApi;
