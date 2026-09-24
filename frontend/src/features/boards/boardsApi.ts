import { api } from "../../app/api";

export interface Board {
  _id: string;
  workspaceId: string;
  title: string;
}
export interface BoardList {
  _id: string;
  boardId: string;
  title: string;
  position: number;
}
export interface Card {
  _id: string;
  listId: string;
  title: string;
  description: string;
  position: number;
}
export interface BoardDetail {
  board: Board;
  lists: BoardList[];
  cards: Card[];
}

export const boardsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    listBoards: builder.query<Board[], { workspaceId: string }>({
      query: ({ workspaceId }) => `/workspaces/${workspaceId}/boards`,
      providesTags: ["Board"],
    }),
    createBoard: builder.mutation<Board, { workspaceId: string; title: string }>({
      query: ({ workspaceId, title }) => ({
        url: `/workspaces/${workspaceId}/boards`,
        method: "POST",
        body: { title },
      }),
      invalidatesTags: ["Board"],
    }),
    getBoard: builder.query<BoardDetail, { workspaceId: string; boardId: string }>({
      query: ({ workspaceId, boardId }) => `/workspaces/${workspaceId}/boards/${boardId}`,
      providesTags: [{ type: "Board", id: "CURRENT" }],
    }),
    createList: builder.mutation<BoardList, { workspaceId: string; boardId: string; title: string }>({
      query: ({ workspaceId, boardId, title }) => ({
        url: `/workspaces/${workspaceId}/boards/${boardId}/lists`,
        method: "POST",
        body: { title },
      }),
      invalidatesTags: [{ type: "Board", id: "CURRENT" }],
    }),
    createCard: builder.mutation<
      Card,
      { workspaceId: string; boardId: string; listId: string; title: string }
    >({
      query: ({ workspaceId, boardId, listId, title }) => ({
        url: `/workspaces/${workspaceId}/boards/${boardId}/lists/${listId}/cards`,
        method: "POST",
        body: { title },
      }),
      invalidatesTags: [{ type: "Board", id: "CURRENT" }],
    }),
    moveCard: builder.mutation<
      { ok: true },
      { workspaceId: string; boardId: string; cardId: string; toListId: string; toPosition: number }
    >({
      query: ({ workspaceId, cardId, toListId, toPosition }) => ({
        url: `/workspaces/${workspaceId}/boards/cards/${cardId}/move`,
        method: "POST",
        body: { toListId, toPosition },
      }),
      async onQueryStarted(
        { workspaceId, boardId, cardId, toListId, toPosition },
        { dispatch, queryFulfilled },
      ) {
        const patch = dispatch(
          boardsApi.util.updateQueryData("getBoard", { workspaceId, boardId }, (draft) => {
            const card = draft.cards.find((c) => c._id === cardId);
            if (card) {
              card.listId = toListId;
              card.position = toPosition;
            }
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
  useListBoardsQuery,
  useCreateBoardMutation,
  useGetBoardQuery,
  useCreateListMutation,
  useCreateCardMutation,
  useMoveCardMutation,
} = boardsApi;
