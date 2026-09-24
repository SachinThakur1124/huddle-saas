import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { Types } from "mongoose";
import { socketAuthMiddleware } from "./auth";
import { env } from "../config/env";
import { Membership } from "../models/Membership";

let io: Server | null = null;

type JoinAck = (response: { ok: true } | { ok: false; error: string }) => void;

export function attachSockets(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    socket.on("workspace:join", async (workspaceId: string, ack?: JoinAck) => {
      if (!Types.ObjectId.isValid(workspaceId)) {
        return ack?.({ ok: false, error: "Invalid workspaceId" });
      }
      const membership = await Membership.exists({
        userId: socket.data.userId,
        workspaceId,
      });
      if (!membership) {
        return ack?.({ ok: false, error: "Not a member of this workspace" });
      }
      socket.join(`workspace:${workspaceId}`);
      ack?.({ ok: true });
    });
  });

  return io;
}

export function emitToWorkspace(workspaceId: string, event: string, payload: unknown) {
  io?.to(`workspace:${workspaceId}`).emit(event, payload);
}
