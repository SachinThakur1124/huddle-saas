import { api } from "../../app/api";
import type { RootState } from "../../app/store";

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

/**
 * `before` unset means this is the newest page (a fresh mount or a
 * reopened channel), not a "load older" continuation — replace rather
 * than prepend, or reopening a channel you'd already scrolled through
 * stacks the newest page above stale history. Exported standalone (rather
 * than inlined in the endpoint config) so it's directly unit-testable —
 * RTK Query doesn't expose an injected endpoint's `merge` option at
 * runtime for tests to call.
 */
export function mergeMessagePage(current: MessagePage, incoming: MessagePage, before?: string) {
  if (!before) {
    current.messages = incoming.messages;
    current.nextCursor = incoming.nextCursor;
    return;
  }
  const existingIds = new Set(current.messages.map((m) => m._id));
  const newOnes = incoming.messages.filter((m) => !existingIds.has(m._id));
  current.messages = [...newOnes, ...current.messages];
  current.nextCursor = incoming.nextCursor;
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
      merge: (current, incoming, { arg }) => mergeMessagePage(current, incoming, arg.before),
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.before !== previousArg?.before,
    }),
    sendMessage: builder.mutation<Message, { workspaceId: string; channelId: string; body: string }>({
      query: ({ workspaceId, channelId, body }) => ({
        url: `/workspaces/${workspaceId}/channels/${channelId}/messages`,
        method: "POST",
        body: { body },
      }),
      async onQueryStarted({ workspaceId, channelId, body }, { dispatch, getState, queryFulfilled }) {
        const optimisticId = `optimistic-${Date.now()}`;
        const currentUserId = (getState() as RootState).auth.user?.id ?? "me";
        const patch = dispatch(
          chatApi.util.updateQueryData("listMessages", { workspaceId, channelId }, (draft) => {
            draft.messages.push({
              _id: optimisticId,
              channelId,
              authorId: currentUserId,
              body,
              createdAt: new Date().toISOString(),
            });
          }),
        );
        try {
          const { data: saved } = await queryFulfilled;
          // Replace the optimistic placeholder with the server's real
          // message so its id is real by the time the socket broadcast
          // for it arrives (socket.ts skips ids it's already seen).
          dispatch(
            chatApi.util.updateQueryData("listMessages", { workspaceId, channelId }, (draft) => {
              const index = draft.messages.findIndex((m) => m._id === optimisticId);
              if (index !== -1) draft.messages[index] = saved;
            }),
          );
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
