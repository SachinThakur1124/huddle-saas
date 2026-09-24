import { io, Socket } from "socket.io-client";
import type { AppDispatch } from "../../app/store";
import { chatApi } from "./chatApi";
import { boardsApi } from "../boards/boardsApi";

let socket: Socket | null = null;
let currentToken: string | null = null;
let currentWorkspaceId: string | null = null;

const SOCKET_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export function connectSocket(dispatch: AppDispatch, accessToken: string) {
  // Only (re)connect when the token actually changes — callers that fire
  // on every store update would otherwise tear down and reopen the
  // socket on every unrelated Redux action, and workspace:join would
  // never survive past the first one.
  if (socket && currentToken === accessToken) return;

  socket?.disconnect();
  currentToken = accessToken;

  socket = io(SOCKET_URL, { auth: { token: accessToken }, transports: ["websocket"] });

  // Re-join on every connect, not just the first — this is what makes
  // reconnects (network blips, server restarts) actually resume realtime
  // instead of silently going quiet in the joined room.
  socket.on("connect", () => {
    if (currentWorkspaceId) socket?.emit("workspace:join", currentWorkspaceId);
  });

  socket.on(
    "message:new",
    (message: { _id: string; channelId: string; authorId: string; body: string; createdAt: string }) => {
      dispatch(
        chatApi.util.updateQueryData(
          "listMessages",
          { workspaceId: currentWorkspaceId ?? "", channelId: message.channelId },
          (draft) => {
            // Drop the optimistic placeholder for a message we just sent
            // ourselves, and never append the same server message twice.
            const optimisticIndex = draft.messages.findIndex(
              (m) => m._id.startsWith("optimistic-") && m.body === message.body && m.channelId === message.channelId,
            );
            if (optimisticIndex !== -1) draft.messages.splice(optimisticIndex, 1);
            if (draft.messages.some((m) => m._id === message._id)) return;
            draft.messages.push(message);
          },
        ),
      );
    },
  );

  socket.on("card:moved", () => {
    dispatch(boardsApi.util.invalidateTags([{ type: "Board", id: "CURRENT" }]));
  });
}

export function joinWorkspace(workspaceId: string) {
  currentWorkspaceId = workspaceId;
  socket?.emit("workspace:join", workspaceId);
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  currentToken = null;
  currentWorkspaceId = null;
}
