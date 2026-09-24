import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { socketAuthMiddleware } from "./auth";
import { env } from "../config/env";

let io: Server | null = null;

export function attachSockets(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    socket.on("workspace:join", (workspaceId: string) => {
      socket.join(`workspace:${workspaceId}`);
    });
  });

  return io;
}

export function emitToWorkspace(workspaceId: string, event: string, payload: unknown) {
  io?.to(`workspace:${workspaceId}`).emit(event, payload);
}
