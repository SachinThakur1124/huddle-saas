import pino from "pino";
import { env } from "../config/env";

function level() {
  if (env.NODE_ENV === "test") return "silent";
  if (env.NODE_ENV === "production") return "info";
  return "debug";
}

export const logger = pino({
  level: level(),
  redact: ["req.headers.authorization"],
});
