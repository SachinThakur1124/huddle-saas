import "dotenv/config";

const NODE_ENV = process.env.NODE_ENV ?? "development";

function required(name: string, fallback?: string): string {
  // Dev-only fallbacks must never silently apply in production — a real
  // deployment running with the default "dev-access-secret" would let
  // anyone forge a valid JWT.
  const usableFallback = NODE_ENV === "production" ? undefined : fallback;
  const value = process.env[name] ?? usableFallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  NODE_ENV,
  MONGO_URI: required("MONGO_URI", "mongodb://localhost:27017/huddle"),
  REDIS_URL: required("REDIS_URL", "redis://localhost:6379"),
  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET", "dev-access-secret"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET", "dev-refresh-secret"),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};
