import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { HttpError } from "../lib/httpError";

function resolveStatus(err: Error & { name?: string; status?: number; statusCode?: number }): number {
  if (err instanceof HttpError) return err.status;
  if (err.name === "CastError") return 400; // malformed ObjectId reaching Mongoose
  // body-parser / other middleware errors that already carry a 4xx status
  const candidate = err.status ?? err.statusCode;
  if (typeof candidate === "number" && candidate >= 400 && candidate < 500) return candidate;
  return 500;
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const status = resolveStatus(err);
  if (status >= 500) {
    logger.error({ err, path: req.path }, "Unhandled error");
  }
  if (res.headersSent) return;
  res.status(status).json({ error: status >= 500 ? "Internal server error" : err.message });
}
