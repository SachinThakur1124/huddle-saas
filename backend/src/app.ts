import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { authRoutes } from "./routes/authRoutes";
import { workspaceRoutes } from "./routes/workspaceRoutes";
import { pageRoutes } from "./routes/pageRoutes";
import { boardRoutes } from "./routes/boardRoutes";
import { chatRoutes } from "./routes/chatRoutes";

export function createApp(): Express {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/auth", authRoutes);
  app.use("/workspaces", workspaceRoutes);
  app.use("/workspaces/:workspaceId/pages", pageRoutes);
  app.use("/workspaces/:workspaceId/boards", boardRoutes);
  app.use("/workspaces/:workspaceId/channels", chatRoutes);

  return app;
}
