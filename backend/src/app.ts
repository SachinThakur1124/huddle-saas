import "express-async-errors";
import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import swaggerUi from "swagger-ui-express";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { swaggerSpec } from "./docs/swagger";
import { logger } from "./lib/logger";
import { errorHandler } from "./middleware/errorHandler";
import { authRoutes } from "./routes/authRoutes";
import { workspaceRoutes } from "./routes/workspaceRoutes";
import { pageRoutes } from "./routes/pageRoutes";
import { boardRoutes } from "./routes/boardRoutes";
import { chatRoutes } from "./routes/chatRoutes";
import { searchRoutes } from "./routes/searchRoutes";
import { uploadRoutes } from "./routes/uploadRoutes";

export function createApp(): Express {
  const app = express();
  // Behind Render/any reverse proxy, express-rate-limit needs the real
  // client IP from X-Forwarded-For, not the proxy's — otherwise every
  // client shares one rate-limit bucket.
  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use("/auth", authRoutes);
  app.use("/workspaces", workspaceRoutes);
  app.use("/workspaces/:workspaceId/pages", pageRoutes);
  app.use("/workspaces/:workspaceId/boards", boardRoutes);
  app.use("/workspaces/:workspaceId/channels", chatRoutes);
  app.use("/workspaces/:workspaceId/search", searchRoutes);
  app.use("/workspaces/:workspaceId/uploads", uploadRoutes);
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.use(errorHandler);

  return app;
}
