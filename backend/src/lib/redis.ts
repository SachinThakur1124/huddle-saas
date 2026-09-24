import Redis from "ioredis";
import { env } from "../config/env";

export const redisClient = new Redis(env.REDIS_URL, {
  // Finite retries + a command timeout so a Redis outage makes individual
  // commands fail fast (callers fall back to Mongo — see requireRole.ts)
  // instead of every workspace request queueing forever.
  maxRetriesPerRequest: 3,
  commandTimeout: 2000,
  lazyConnect: true,
});
