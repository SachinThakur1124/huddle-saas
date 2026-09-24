import { api } from "../../app/api";

export interface Channel {
  _id: string;
  workspaceId: string;
  name: string;
}
export interface Message {
  _id: string;
  channelId: string;
  authorId: string;
  body: string;
  createdAt: string;
}
interface MessagePage {
  messages: Message[];
  nextCursor: string | null;
}

export const chatApi = api.injectEndpoints({
  endpoints: (builder) => ({
    listChannels: builder.query<Channel[], { workspaceId: string }>({
      query: ({ workspaceId }) => `/workspaces/${workspaceId}/channels`,
      providesTags: ["Channel"],
    }),
    createChannel: builder.mutation<Channel, { workspaceId: string; name: string }>({
      query: ({ workspaceId, name }) => ({
        url: `/workspaces/${workspaceId}/channels`,
        method: "POST",
        body: { name },
      }),
      invalidatesTags: ["Channel"],
    }),
    listMessages: builder.query<
      MessagePage,
      { workspaceId: string; channelId: string; before?: string }
    >({
      query: ({ workspaceId, channelId, before }) => ({
        url: `/workspaces/${workspaceId}/channels/${channelId}/messages`,
        params: before ? { before } : undefined,
      }),
      serializeQueryArgs: ({ queryArgs }) => `${queryArgs.workspaceId}/${queryArgs.channelId}`,
      merge: (current, incoming) => {
        current.messages = [...incoming.messages, ...current.messages];
        current.nextCursor = incoming.nextCursor;
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.before !== previousArg?.before,
    }),
    sendMessage: builder.mutation<Message, { workspaceId: string; channelId: string; body: string }>({
      query: ({ workspaceId, channelId, body }) => ({
        url: `/workspaces/${workspaceId}/channels/${channelId}/messages`,
        method: "POST",
        body: { body },
      }),
      async onQueryStarted({ workspaceId, channelId, body }, { dispatch, queryFulfilled }) {
        const optimisticId = `optimistic-${Date.now()}`;
        const patch = dispatch(
          chatApi.util.updateQueryData("listMessages", { workspaceId, channelId }, (draft) => {
            draft.messages.push({
              _id: optimisticId,
              channelId,
              authorId: "me",
              body,
              createdAt: new Date().toISOString(),
            });
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
  }),
});

export const {
  useListChannelsQuery,
  useCreateChannelMutation,
  useListMessagesQuery,
  useSendMessageMutation,
} = chatApi;
