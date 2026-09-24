import { io, Socket } from "socket.io-client";
import type { AppDispatch, RootState } from "../../app/store";
import { chatApi } from "./chatApi";
import { boardsApi } from "../boards/boardsApi";

let socket: Socket | null = null;
let joinedWorkspaceId: string | null = null;

const SOCKET_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export function connectSocket(store: { dispatch: AppDispatch; getState: () => RootState }) {
  const accessToken = store.getState().auth.accessToken;
  if (!accessToken) return;

  if (socket) socket.disconnect();

  socket = io(SOCKET_URL, { auth: { token: accessToken }, transports: ["websocket"] });

  socket.on(
    "message:new",
    (message: { _id: string; channelId: string; authorId: string; body: string; createdAt: string }) => {
      store.dispatch(
        chatApi.util.updateQueryData(
          "listMessages",
          { workspaceId: joinedWorkspaceId ?? "", channelId: message.channelId },
          (draft) => {
            draft.messages.push(message);
          },
        ),
      );
    },
  );

  socket.on(
    "card:moved",
    (payload: { cardId: string; toListId: string; toPosition: number }) => {
      store.dispatch(
        boardsApi.util.invalidateTags([{ type: "Board", id: "CURRENT" }]),
      );
      void payload; // full optimistic patch on the remote event is out of scope for today
    },
  );
}

export function joinWorkspace(workspaceId: string) {
  joinedWorkspaceId = workspaceId;
  socket?.emit("workspace:join", workspaceId);
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  joinedWorkspaceId = null;
}
