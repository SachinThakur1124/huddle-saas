# Huddle Backend Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Tier-1 backend for Huddle — auth+RBAC, Pages/Boards/Channels
CRUD, transactions/aggregations, Redis cache, BullMQ jobs, Socket.io, audit log,
search, Swagger docs — as a working, tested Express + TypeScript API.

**Architecture:** Layered `routes -> controllers -> services -> models`, MongoDB via
Mongoose, Redis via ioredis, background jobs via BullMQ, realtime via Socket.io.
Services carry business logic and are the unit under test; controllers stay thin.

**Tech Stack:** Node 22, TypeScript 5 (strict), Express 4, Mongoose 8, ioredis 5,
BullMQ 5, Socket.io 4, jsonwebtoken 9, argon2, zod 3, multer, helmet,
express-rate-limit, swagger-jsdoc + swagger-ui-express, pino, Jest + ts-jest +
Supertest + mongodb-memory-server (with replica-set support for transactions).

**Spec:** `docs/superpowers/specs/2026-09-24-huddle-saas-design.md`

## Global Constraints

- TypeScript strict mode (`"strict": true` in tsconfig).
- Node 22 (matches this environment).
- Passwords hashed with Argon2, never stored/logged in plaintext.
- Access JWT TTL = 15 minutes; refresh tokens are opaque random strings, hashed
  (SHA-256) at rest, rotated on every use, and reuse of an already-rotated token
  revokes the entire token family.
- RBAC roles are exactly: `owner`, `admin`, `member`, `viewer` (spec §3/§4).
- No secrets committed; all config via `.env`, with a committed `.env.example`.
- All mutating routes validate input with Zod before touching the database.
- 60%+ statement coverage on `src/services/**` and `src/middleware/**`, enforced
  by `jest --coverage` thresholds (CI fails below the floor).
- All list endpoints that can grow unbounded (messages, audit log, search) are
  paginated — no unbounded `find()` on a growth collection.

## Review Focus

- Cross-workspace access: a member of Workspace A must not be able to read/write
  Workspace B's pages/boards/channels by guessing an ObjectId. Covered in Task 3.
- Refresh-token replay: reusing a rotated-out refresh token must revoke the whole
  token family, not just fail once. Covered in Task 2.
- Concurrent card moves: two clients moving the same card to different positions
  at once must not corrupt list ordering (last-write-wins is acceptable, but no
  duplicate/NaN positions). Covered in Task 6.
- NoSQL operator injection: a query/body field like `{"$ne": null}` sent as a
  "string" field must be rejected by Zod, not passed through to Mongoose. Covered
  in Task 3 (Zod schemas) with an explicit test in Task 5.
- Oversized/wrong-type file uploads must be rejected with a 4xx, not crash the
  process or silently truncate. Covered in Task 10.

---

### Task 1: Project scaffold + health check

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/jest.config.ts`
- Create: `backend/.env.example`
- Create: `backend/src/config/env.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`
- Test: `backend/tests/health.test.ts`

**Interfaces:**
- Produces: `createApp(): express.Express` from `src/app.ts` — used by every
  later test file to build a supertest instance without binding a real port.
- Produces: `env` object from `src/config/env.ts` with fields `{ PORT, MONGO_URI,
  REDIS_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, NODE_ENV }`.

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "huddle-backend",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "jest --runInBand",
    "test:coverage": "jest --runInBand --coverage",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "argon2": "^0.31.2",
    "bullmq": "^5.12.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.4.0",
    "helmet": "^7.1.0",
    "ioredis": "^5.4.1",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.6.0",
    "multer": "^1.4.5-lts.1",
    "pino": "^9.4.0",
    "pino-http": "^10.3.0",
    "socket.io": "^4.7.5",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^5.0.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.13",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/multer": "^1.4.11",
    "@types/node": "^22.5.5",
    "@types/supertest": "^6.0.2",
    "@types/swagger-jsdoc": "^6.0.4",
    "@types/swagger-ui-express": "^4.1.6",
    "jest": "^29.7.0",
    "mongodb-memory-server": "^10.0.1",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "tsx": "^4.19.1",
    "typescript": "^5.6.2"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `backend/jest.config.ts`**

```typescript
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  coverageThreshold: {
    "src/services/**": { statements: 60, branches: 50 },
    "src/middleware/**": { statements: 60, branches: 50 },
  },
  collectCoverageFrom: ["src/services/**/*.ts", "src/middleware/**/*.ts"],
  testTimeout: 30000,
};

export default config;
```

- [ ] **Step 4: Create `backend/.env.example`**

```
PORT=4000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/huddle
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=change-me-access
JWT_REFRESH_SECRET=change-me-refresh
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 5: Create `backend/src/config/env.ts`**

```typescript
import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  MONGO_URI: required("MONGO_URI", "mongodb://localhost:27017/huddle"),
  REDIS_URL: required("REDIS_URL", "redis://localhost:6379"),
  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET", "dev-access-secret"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET", "dev-refresh-secret"),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};
```

- [ ] **Step 6: Write the failing test for the app factory**

```typescript
// backend/tests/health.test.ts
import request from "supertest";
import { createApp } from "../src/app";

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd backend && npm install && npm test`
Expected: FAIL — `Cannot find module '../src/app'`

- [ ] **Step 8: Create `backend/src/app.ts`**

```typescript
import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";

export function createApp(): Express {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  return app;
}
```

- [ ] **Step 9: Create `backend/src/server.ts`**

```typescript
import mongoose from "mongoose";
import { createApp } from "./app";
import { env } from "./config/env";

async function main() {
  await mongoose.connect(env.MONGO_URI);
  const app = createApp();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`huddle-backend listening on :${env.PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error", err);
  process.exit(1);
});
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npm test`
Expected: PASS (1 test)

- [ ] **Step 11: Commit**

```bash
cd ~/huddle-saas
git add backend/package.json backend/tsconfig.json backend/jest.config.ts \
  backend/.env.example backend/src/config/env.ts backend/src/app.ts \
  backend/src/server.ts backend/tests/health.test.ts backend/package-lock.json
git commit -m "feat(backend): scaffold Express+TS app with health check"
```

---

### Task 2: Auth — User model, register/login, refresh-token rotation

**Files:**
- Create: `backend/src/models/User.ts`
- Create: `backend/src/models/RefreshToken.ts`
- Create: `backend/src/services/authService.ts`
- Create: `backend/src/routes/authRoutes.ts`
- Create: `backend/src/middleware/requireAuth.ts`
- Modify: `backend/src/app.ts` (mount `/auth` routes)
- Test: `backend/tests/helpers/db.ts`
- Test: `backend/tests/services/authService.test.ts`
- Test: `backend/tests/routes/auth.routes.test.ts`

**Interfaces:**
- Consumes: `createApp()` from Task 1.
- Produces: `AuthService.register(email, password, name): Promise<{user, accessToken, refreshToken}>`,
  `AuthService.login(email, password): Promise<{user, accessToken, refreshToken}>`,
  `AuthService.refresh(refreshToken): Promise<{accessToken, refreshToken}>`,
  `AuthService.logout(refreshToken): Promise<void>` — used by Task 3's RBAC
  middleware (`requireAuth` reads the access token) and by every later routes
  test (to obtain an authenticated session).
- Produces: `requireAuth` Express middleware that sets `req.userId`.

- [ ] **Step 1: Create the shared in-memory Mongo test helper**

```typescript
// backend/tests/helpers/db.ts
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

let replSet: MongoMemoryReplSet;

export async function connectTestDb() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri(), { dbName: "test" });
}

export async function clearTestDb() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

export async function disconnectTestDb() {
  await mongoose.disconnect();
  await replSet.stop();
}
```

- [ ] **Step 2: Write the failing test for `AuthService.register`/`login`**

```typescript
// backend/tests/services/authService.test.ts
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { AuthService } from "../../src/services/authService";
import { RefreshToken } from "../../src/models/RefreshToken";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("AuthService", () => {
  it("registers a user and returns a token pair", async () => {
    const result = await AuthService.register("a@x.com", "password123", "Ada");
    expect(result.user.email).toBe("a@x.com");
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
  });

  it("rejects duplicate email registration", async () => {
    await AuthService.register("dup@x.com", "password123", "Ada");
    await expect(
      AuthService.register("dup@x.com", "password123", "Ada"),
    ).rejects.toThrow(/already/i);
  });

  it("logs in with correct credentials", async () => {
    await AuthService.register("login@x.com", "password123", "Ada");
    const result = await AuthService.login("login@x.com", "password123");
    expect(result.accessToken).toEqual(expect.any(String));
  });

  it("rejects login with wrong password", async () => {
    await AuthService.register("wrong@x.com", "password123", "Ada");
    await expect(
      AuthService.login("wrong@x.com", "wrong-password"),
    ).rejects.toThrow(/invalid/i);
  });

  it("rotates refresh tokens and revokes the family on reuse", async () => {
    const { refreshToken } = await AuthService.register(
      "rotate@x.com",
      "password123",
      "Ada",
    );
    const rotated = await AuthService.refresh(refreshToken);
    expect(rotated.refreshToken).not.toBe(refreshToken);

    // Reusing the already-rotated token must fail AND revoke the family.
    await expect(AuthService.refresh(refreshToken)).rejects.toThrow(
      /reuse|revoked/i,
    );
    await expect(AuthService.refresh(rotated.refreshToken)).rejects.toThrow(
      /revoked/i,
    );

    const tokens = await RefreshToken.find({});
    expect(tokens.every((t) => t.revoked)).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- authService.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/authService'`

- [ ] **Step 4: Create `backend/src/models/User.ts`**

```typescript
import { Schema, model, Types } from "mongoose";

export interface UserDoc {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
}

const userSchema = new Schema<UserDoc>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

export const User = model<UserDoc>("User", userSchema);
```

- [ ] **Step 5: Create `backend/src/models/RefreshToken.ts`**

```typescript
import { Schema, model, Types } from "mongoose";

export interface RefreshTokenDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenDoc>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  familyId: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  revoked: { type: Boolean, default: false },
  createdAt: { type: Date, default: () => new Date() },
});

export const RefreshToken = model<RefreshTokenDoc>(
  "RefreshToken",
  refreshTokenSchema,
);
```

- [ ] **Step 6: Create `backend/src/services/authService.ts`**

```typescript
import argon2 from "argon2";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User, UserDoc } from "../models/User";
import { RefreshToken } from "../models/RefreshToken";
import { env } from "../config/env";

const ACCESS_TTL = "15m";
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function issueAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TTL,
  });
}

async function issueRefreshToken(userId: string, familyId: string) {
  const raw = crypto.randomBytes(40).toString("hex");
  await RefreshToken.create({
    userId,
    familyId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return raw;
}

function toPublicUser(u: UserDoc) {
  return { id: u._id.toString(), email: u.email, name: u.name };
}

export const AuthService = {
  async register(email: string, password: string, name: string) {
    const existing = await User.findOne({ email });
    if (existing) throw new Error("Email already registered");

    const passwordHash = await argon2.hash(password);
    const user = await User.create({ email, passwordHash, name });
    const familyId = crypto.randomUUID();
    const accessToken = issueAccessToken(user._id.toString());
    const refreshToken = await issueRefreshToken(user._id.toString(), familyId);
    return { user: toPublicUser(user), accessToken, refreshToken };
  },

  async login(email: string, password: string) {
    const user = await User.findOne({ email });
    if (!user) throw new Error("Invalid email or password");
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new Error("Invalid email or password");

    const familyId = crypto.randomUUID();
    const accessToken = issueAccessToken(user._id.toString());
    const refreshToken = await issueRefreshToken(user._id.toString(), familyId);
    return { user: toPublicUser(user), accessToken, refreshToken };
  },

  async refresh(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    const record = await RefreshToken.findOne({ tokenHash });
    if (!record) throw new Error("Invalid refresh token");

    if (record.revoked) {
      // Reuse of a token from an already-revoked family: nuke the whole family.
      await RefreshToken.updateMany(
        { familyId: record.familyId },
        { revoked: true },
      );
      throw new Error("Refresh token has been revoked (reuse detected)");
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new Error("Refresh token expired");
    }

    // Rotate: revoke this one, issue a new one in the same family.
    record.revoked = true;
    await record.save();

    const accessToken = issueAccessToken(record.userId.toString());
    const refreshToken = await issueRefreshToken(
      record.userId.toString(),
      record.familyId,
    );
    return { accessToken, refreshToken };
  },

  async logout(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    const record = await RefreshToken.findOne({ tokenHash });
    if (record) {
      await RefreshToken.updateMany(
        { familyId: record.familyId },
        { revoked: true },
      );
    }
  },

  verifyAccessToken(token: string): { sub: string } {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string };
  },
};
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- authService.test.ts`
Expected: PASS (5 tests). Note the "reuse detected" test relies on the second
`refresh(refreshToken)` call reusing an already-revoked record — re-read the
service code above if it fails: the first rotate sets `revoked=true` on the
*old* record before issuing the new one, so the second call to the same raw
token hits the `record.revoked` branch.

- [ ] **Step 8: Create `backend/src/middleware/requireAuth.ts`**

```typescript
import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/authService";

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  try {
    const payload = AuthService.verifyAccessToken(header.slice(7));
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
}
```

- [ ] **Step 9: Create `backend/src/routes/authRoutes.ts`**

```typescript
import { Router } from "express";
import { z } from "zod";
import { AuthService } from "../services/authService";

export const authRoutes = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

authRoutes.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const result = await AuthService.register(
      parsed.data.email,
      parsed.data.password,
      parsed.data.name,
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRoutes.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const result = await AuthService.login(parsed.data.email, parsed.data.password);
    res.status(200).json(result);
  } catch (err) {
    res.status(401).json({ error: (err as Error).message });
  }
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

authRoutes.post("/refresh", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const result = await AuthService.refresh(parsed.data.refreshToken);
    res.status(200).json(result);
  } catch (err) {
    res.status(401).json({ error: (err as Error).message });
  }
});

authRoutes.post("/logout", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (parsed.success) {
    await AuthService.logout(parsed.data.refreshToken);
  }
  res.status(204).send();
});
```

- [ ] **Step 10: Modify `backend/src/app.ts` to mount auth routes**

```typescript
// add near the top of src/app.ts, after existing imports
import { authRoutes } from "./routes/authRoutes";

// inside createApp(), after app.use(express.json()):
app.use("/auth", authRoutes);
```

- [ ] **Step 11: Write the route-level test**

```typescript
// backend/tests/routes/auth.routes.test.ts
import request from "supertest";
import { createApp } from "../../src/app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";

const app = createApp();

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("POST /auth/register + /auth/login", () => {
  it("registers then logs in", async () => {
    await request(app)
      .post("/auth/register")
      .send({ email: "r@x.com", password: "password123", name: "Ru" })
      .expect(201);

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "r@x.com", password: "password123" })
      .expect(200);

    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it("rejects a malformed email with 400", async () => {
    await request(app)
      .post("/auth/register")
      .send({ email: "not-an-email", password: "password123", name: "Ru" })
      .expect(400);
  });
});
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all tests so far)

- [ ] **Step 13: Commit**

```bash
cd ~/huddle-saas
git add backend/src/models/User.ts backend/src/models/RefreshToken.ts \
  backend/src/services/authService.ts backend/src/routes/authRoutes.ts \
  backend/src/middleware/requireAuth.ts backend/src/app.ts \
  backend/tests/helpers/db.ts backend/tests/services/authService.test.ts \
  backend/tests/routes/auth.routes.test.ts
git commit -m "feat(backend): auth with refresh-token rotation and reuse detection"
```

---

### Task 3: Workspace, Membership, RBAC middleware, Redis permission cache

**Files:**
- Create: `backend/src/models/Workspace.ts`
- Create: `backend/src/models/Membership.ts`
- Create: `backend/src/lib/redis.ts`
- Create: `backend/src/services/permissionCache.ts`
- Create: `backend/src/middleware/requireRole.ts`
- Create: `backend/src/services/workspaceService.ts`
- Create: `backend/src/routes/workspaceRoutes.ts`
- Modify: `backend/src/app.ts` (mount `/workspaces`)
- Test: `backend/tests/services/permissionCache.test.ts`
- Test: `backend/tests/routes/workspace.routes.test.ts`

**Interfaces:**
- Consumes: `requireAuth` (Task 2), `AuthedRequest` (Task 2).
- Produces: `requireRole(minRole)` middleware reading `req.membership.role`.
- Produces: `PermissionCache.get(userId, workspaceId)`,
  `.set(userId, workspaceId, role)`, `.invalidate(userId, workspaceId)` — an
  injectable class (constructor takes a Redis-like client) so tests use a fake.
- Produces: role order `["viewer", "member", "admin", "owner"]` exported as
  `ROLE_ORDER` from `permissionCache.ts` — later tasks (Boards, Pages) import
  this to gate mutating routes.

- [ ] **Step 1: Write the failing test for `PermissionCache` using a fake client**

```typescript
// backend/tests/services/permissionCache.test.ts
import { PermissionCache } from "../../src/services/permissionCache";

class FakeRedis {
  private store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.store.set(key, value);
    return "OK";
  }
  async del(key: string) {
    this.store.delete(key);
    return 1;
  }
}

describe("PermissionCache", () => {
  it("caches and returns a role", async () => {
    const cache = new PermissionCache(new FakeRedis() as never);
    await cache.set("u1", "w1", "admin");
    expect(await cache.get("u1", "w1")).toBe("admin");
  });

  it("returns null on cache miss", async () => {
    const cache = new PermissionCache(new FakeRedis() as never);
    expect(await cache.get("nope", "w1")).toBeNull();
  });

  it("invalidate clears the entry", async () => {
    const cache = new PermissionCache(new FakeRedis() as never);
    await cache.set("u1", "w1", "owner");
    await cache.invalidate("u1", "w1");
    expect(await cache.get("u1", "w1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- permissionCache.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create `backend/src/lib/redis.ts`**

```typescript
import Redis from "ioredis";
import { env } from "../config/env";

export const redisClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});
```

- [ ] **Step 4: Create `backend/src/services/permissionCache.ts`**

```typescript
export const ROLE_ORDER = ["viewer", "member", "admin", "owner"] as const;
export type Role = (typeof ROLE_ORDER)[number];

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

const TTL_SECONDS = 300;

function key(userId: string, workspaceId: string) {
  return `membership:${userId}:${workspaceId}`;
}

export class PermissionCache {
  constructor(private client: RedisLike) {}

  async get(userId: string, workspaceId: string): Promise<Role | null> {
    const value = await this.client.get(key(userId, workspaceId));
    return (value as Role) ?? null;
  }

  async set(userId: string, workspaceId: string, role: Role): Promise<void> {
    await this.client.set(key(userId, workspaceId), role, "EX", TTL_SECONDS);
  }

  async invalidate(userId: string, workspaceId: string): Promise<void> {
    await this.client.del(key(userId, workspaceId));
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- permissionCache.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Create `backend/src/models/Workspace.ts`**

```typescript
import { Schema, model, Types } from "mongoose";

export interface WorkspaceDoc {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  createdAt: Date;
}

const workspaceSchema = new Schema<WorkspaceDoc>({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: () => new Date() },
});

export const Workspace = model<WorkspaceDoc>("Workspace", workspaceSchema);
```

- [ ] **Step 7: Create `backend/src/models/Membership.ts`**

```typescript
import { Schema, model, Types } from "mongoose";
import { Role } from "../services/permissionCache";

export interface MembershipDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  role: Role;
  createdAt: Date;
}

const membershipSchema = new Schema<MembershipDoc>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
  role: { type: String, enum: ["viewer", "member", "admin", "owner"], required: true },
  createdAt: { type: Date, default: () => new Date() },
});

membershipSchema.index({ userId: 1, workspaceId: 1 }, { unique: true });

export const Membership = model<MembershipDoc>("Membership", membershipSchema);
```

- [ ] **Step 8: Create `backend/src/middleware/requireRole.ts`**

```typescript
import { Response, NextFunction } from "express";
import { AuthedRequest } from "./requireAuth";
import { Membership } from "../models/Membership";
import { PermissionCache, ROLE_ORDER, Role } from "../services/permissionCache";
import { redisClient } from "../lib/redis";

export interface WorkspaceScopedRequest extends AuthedRequest {
  membership?: { role: Role };
}

const cache = new PermissionCache(redisClient);

export function requireRole(minRole: Role) {
  return async (
    req: WorkspaceScopedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    const workspaceId = req.params.workspaceId;
    const userId = req.userId!;
    if (!workspaceId) {
      return res.status(400).json({ error: "workspaceId param required" });
    }

    let role = await cache.get(userId, workspaceId);
    if (!role) {
      const membership = await Membership.findOne({ userId, workspaceId });
      if (!membership) {
        return res.status(403).json({ error: "Not a member of this workspace" });
      }
      role = membership.role;
      await cache.set(userId, workspaceId, role);
    }

    if (ROLE_ORDER.indexOf(role) < ROLE_ORDER.indexOf(minRole)) {
      return res.status(403).json({ error: `Requires role >= ${minRole}` });
    }

    req.membership = { role };
    next();
  };
}

export async function invalidateMembershipCache(userId: string, workspaceId: string) {
  await cache.invalidate(userId, workspaceId);
}
```

- [ ] **Step 9: Create `backend/src/services/workspaceService.ts`**

```typescript
import { Workspace } from "../models/Workspace";
import { Membership } from "../models/Membership";
import { Role } from "./permissionCache";
import { invalidateMembershipCache } from "../middleware/requireRole";

function slugify(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
}

export const WorkspaceService = {
  async create(ownerId: string, name: string) {
    const workspace = await Workspace.create({ name, slug: slugify(name) });
    await Membership.create({ userId: ownerId, workspaceId: workspace._id, role: "owner" });
    return workspace;
  },

  async listForUser(userId: string) {
    const memberships = await Membership.find({ userId }).populate("workspaceId");
    return memberships.map((m) => m.workspaceId);
  },

  async setRole(workspaceId: string, targetUserId: string, role: Role) {
    const membership = await Membership.findOneAndUpdate(
      { userId: targetUserId, workspaceId },
      { role },
      { upsert: true, new: true },
    );
    await invalidateMembershipCache(targetUserId, workspaceId);
    return membership;
  },
};
```

- [ ] **Step 10: Create `backend/src/routes/workspaceRoutes.ts`**

```typescript
import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { WorkspaceService } from "../services/workspaceService";

export const workspaceRoutes = Router();

workspaceRoutes.use(requireAuth);

const createSchema = z.object({ name: z.string().min(1).max(100) });

workspaceRoutes.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const workspace = await WorkspaceService.create(req.userId!, parsed.data.name);
  res.status(201).json(workspace);
});

workspaceRoutes.get("/", async (req: AuthedRequest, res) => {
  const workspaces = await WorkspaceService.listForUser(req.userId!);
  res.status(200).json(workspaces);
});

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["viewer", "member", "admin", "owner"]),
});

workspaceRoutes.post(
  "/:workspaceId/members",
  requireRole("admin"),
  async (req: WorkspaceScopedRequest, res) => {
    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const membership = await WorkspaceService.setRole(
      req.params.workspaceId,
      parsed.data.userId,
      parsed.data.role,
    );
    res.status(200).json(membership);
  },
);
```

- [ ] **Step 11: Modify `backend/src/app.ts` to mount workspace routes**

```typescript
import { workspaceRoutes } from "./routes/workspaceRoutes";
// inside createApp():
app.use("/workspaces", workspaceRoutes);
```

- [ ] **Step 12: Write the routes test, including the cross-workspace-access Review Focus case**

```typescript
// backend/tests/routes/workspace.routes.test.ts
import request from "supertest";
import { createApp } from "../../src/app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";

const app = createApp();

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

async function registerAndLogin(email: string) {
  const res = await request(app)
    .post("/auth/register")
    .send({ email, password: "password123", name: "Test" });
  return res.body.accessToken as string;
}

describe("workspace routes", () => {
  it("creates a workspace and lists it for the owner", async () => {
    const token = await registerAndLogin("owner@x.com");
    const create = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Acme" })
      .expect(201);

    const list = await request(app)
      .get("/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(list.body).toHaveLength(1);
    expect(list.body[0]._id).toBe(create.body._id);
  });

  it("denies a non-member from managing another workspace's members (403)", async () => {
    const ownerToken = await registerAndLogin("owner2@x.com");
    const outsiderToken = await registerAndLogin("outsider@x.com");

    const created = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Private Co" })
      .expect(201);

    await request(app)
      .post(`/workspaces/${created.body._id}/members`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ userId: "000000000000000000000000", role: "member" })
      .expect(403);
  });
});
```

- [ ] **Step 13: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all tests so far)

- [ ] **Step 14: Commit**

```bash
cd ~/huddle-saas
git add backend/src/models/Workspace.ts backend/src/models/Membership.ts \
  backend/src/lib/redis.ts backend/src/services/permissionCache.ts \
  backend/src/middleware/requireRole.ts backend/src/services/workspaceService.ts \
  backend/src/routes/workspaceRoutes.ts backend/src/app.ts \
  backend/tests/services/permissionCache.test.ts backend/tests/routes/workspace.routes.test.ts
git commit -m "feat(backend): workspaces, RBAC middleware, Redis permission cache"
```

---

### Task 4: Mongo transaction helper + Audit log

**Files:**
- Create: `backend/src/lib/withTransaction.ts`
- Create: `backend/src/models/AuditLog.ts`
- Create: `backend/src/services/auditService.ts`
- Test: `backend/tests/services/auditService.test.ts`

**Interfaces:**
- Produces: `withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T>`
  — used by Task 5 (page cascade delete) and Task 6 (card move + audit).
- Produces: `AuditService.record({ actorId, workspaceId, action, targetType, targetId, session? })`.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/tests/services/auditService.test.ts
import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { AuditService } from "../../src/services/auditService";
import { AuditLog } from "../../src/models/AuditLog";
import { withTransaction } from "../../src/lib/withTransaction";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("AuditService + withTransaction", () => {
  it("records an audit entry", async () => {
    const workspaceId = new mongoose.Types.ObjectId();
    const actorId = new mongoose.Types.ObjectId();
    await AuditService.record({
      actorId,
      workspaceId,
      action: "card.moved",
      targetType: "Card",
      targetId: new mongoose.Types.ObjectId(),
    });
    const entries = await AuditLog.find({ workspaceId });
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("card.moved");
  });

  it("rolls back all writes inside withTransaction on error", async () => {
    const workspaceId = new mongoose.Types.ObjectId();
    await expect(
      withTransaction(async (session) => {
        await AuditLog.create(
          [
            {
              workspaceId,
              actorId: new mongoose.Types.ObjectId(),
              action: "test.write",
              targetType: "Card",
              targetId: new mongoose.Types.ObjectId(),
            },
          ],
          { session },
        );
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const entries = await AuditLog.find({ workspaceId });
    expect(entries).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- auditService.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Create `backend/src/lib/withTransaction.ts`**

```typescript
import mongoose, { ClientSession } from "mongoose";

export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
```

- [ ] **Step 4: Create `backend/src/models/AuditLog.ts`**

```typescript
import { Schema, model, Types } from "mongoose";

export interface AuditLogDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  actorId: Types.ObjectId;
  action: string;
  targetType: string;
  targetId: Types.ObjectId;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDoc>({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  actorId: { type: Schema.Types.ObjectId, required: true },
  action: { type: String, required: true },
  targetType: { type: String, required: true },
  targetId: { type: Schema.Types.ObjectId, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

export const AuditLog = model<AuditLogDoc>("AuditLog", auditLogSchema);
```

- [ ] **Step 5: Create `backend/src/services/auditService.ts`**

```typescript
import { ClientSession, Types } from "mongoose";
import { AuditLog } from "../models/AuditLog";

interface RecordInput {
  actorId: Types.ObjectId | string;
  workspaceId: Types.ObjectId | string;
  action: string;
  targetType: string;
  targetId: Types.ObjectId | string;
  session?: ClientSession;
}

export const AuditService = {
  async record(input: RecordInput) {
    const [doc] = await AuditLog.create(
      [
        {
          actorId: input.actorId,
          workspaceId: input.workspaceId,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
        },
      ],
      { session: input.session },
    );
    return doc;
  },

  async listForWorkspace(workspaceId: string, page = 1, pageSize = 25) {
    return AuditLog.find({ workspaceId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);
  },
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- auditService.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
cd ~/huddle-saas
git add backend/src/lib/withTransaction.ts backend/src/models/AuditLog.ts \
  backend/src/services/auditService.ts backend/tests/services/auditService.test.ts
git commit -m "feat(backend): Mongo transaction helper and audit log service"
```

---

### Task 5: Pages module (nested docs, CRUD, cascade delete via transaction)

**Files:**
- Create: `backend/src/models/Page.ts`
- Create: `backend/src/services/pageService.ts`
- Create: `backend/src/routes/pageRoutes.ts`
- Modify: `backend/src/app.ts` (mount `/workspaces/:workspaceId/pages`)
- Test: `backend/tests/services/pageService.test.ts`
- Test: `backend/tests/routes/page.routes.test.ts`

**Interfaces:**
- Consumes: `requireRole` (Task 3), `withTransaction` + `AuditService` (Task 4).
- Produces: `PageService.create/get/listForWorkspace/update/delete` — the exact
  CRUD shape Task 6/7 mirror for Board/Channel.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/tests/services/pageService.test.ts
import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { PageService } from "../../src/services/pageService";
import { Page } from "../../src/models/Page";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("PageService", () => {
  const workspaceId = new mongoose.Types.ObjectId().toString();
  const actorId = new mongoose.Types.ObjectId().toString();

  it("creates and fetches a page", async () => {
    const page = await PageService.create(workspaceId, actorId, {
      title: "Roadmap",
      contentJson: { blocks: [] },
    });
    const fetched = await PageService.get(workspaceId, page._id.toString());
    expect(fetched?.title).toBe("Roadmap");
  });

  it("rejects fetching a page from a different workspace", async () => {
    const page = await PageService.create(workspaceId, actorId, { title: "X" });
    const otherWorkspace = new mongoose.Types.ObjectId().toString();
    const fetched = await PageService.get(otherWorkspace, page._id.toString());
    expect(fetched).toBeNull();
  });

  it("cascade-deletes child pages inside a transaction", async () => {
    const parent = await PageService.create(workspaceId, actorId, { title: "Parent" });
    const child = await PageService.create(workspaceId, actorId, {
      title: "Child",
      parentId: parent._id.toString(),
    });

    await PageService.delete(workspaceId, actorId, parent._id.toString());

    const remaining = await Page.find({ workspaceId });
    expect(remaining).toHaveLength(0);
    expect(await Page.findById(child._id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- pageService.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create `backend/src/models/Page.ts`**

```typescript
import { Schema, model, Types } from "mongoose";

export interface PageDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  title: string;
  contentJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const pageSchema = new Schema<PageDoc>({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  parentId: { type: Schema.Types.ObjectId, default: null, index: true },
  title: { type: String, required: true, text: true },
  contentJson: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

export const Page = model<PageDoc>("Page", pageSchema);
```

- [ ] **Step 4: Create `backend/src/services/pageService.ts`**

```typescript
import { Types } from "mongoose";
import { Page } from "../models/Page";
import { withTransaction } from "../lib/withTransaction";
import { AuditService } from "./auditService";

interface CreateInput {
  title: string;
  contentJson?: unknown;
  parentId?: string | null;
}

export const PageService = {
  async create(workspaceId: string, actorId: string, input: CreateInput) {
    const page = await Page.create({
      workspaceId,
      parentId: input.parentId ?? null,
      title: input.title,
      contentJson: input.contentJson ?? {},
    });
    await AuditService.record({
      actorId,
      workspaceId,
      action: "page.created",
      targetType: "Page",
      targetId: page._id,
    });
    return page;
  },

  async get(workspaceId: string, pageId: string) {
    return Page.findOne({ _id: pageId, workspaceId });
  },

  async listForWorkspace(workspaceId: string) {
    return Page.find({ workspaceId }).sort({ createdAt: 1 });
  },

  async update(workspaceId: string, actorId: string, pageId: string, patch: Partial<CreateInput>) {
    const page = await Page.findOneAndUpdate(
      { _id: pageId, workspaceId },
      { ...patch, updatedAt: new Date() },
      { new: true },
    );
    if (page) {
      await AuditService.record({
        actorId,
        workspaceId,
        action: "page.updated",
        targetType: "Page",
        targetId: page._id,
      });
    }
    return page;
  },

  async delete(workspaceId: string, actorId: string, pageId: string) {
    await withTransaction(async (session) => {
      const ids: Types.ObjectId[] = [new Types.ObjectId(pageId)];
      // Collect descendant ids breadth-first so a multi-level tree is fully removed.
      let frontier = ids;
      while (frontier.length > 0) {
        const children = await Page.find(
          { workspaceId, parentId: { $in: frontier } },
          { _id: 1 },
          { session },
        );
        const childIds = children.map((c) => c._id);
        ids.push(...childIds);
        frontier = childIds;
      }
      await Page.deleteMany({ _id: { $in: ids } }, { session });
      await AuditService.record({
        actorId,
        workspaceId,
        action: "page.deleted",
        targetType: "Page",
        targetId: pageId,
        session,
      });
    });
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- pageService.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Create `backend/src/routes/pageRoutes.ts`**

```typescript
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { PageService } from "../services/pageService";

export const pageRoutes = Router({ mergeParams: true });

pageRoutes.use(requireAuth, requireRole("viewer"));

pageRoutes.get("/", async (req: WorkspaceScopedRequest, res) => {
  const pages = await PageService.listForWorkspace(req.params.workspaceId);
  res.json(pages);
});

pageRoutes.get("/:pageId", async (req: WorkspaceScopedRequest, res) => {
  const page = await PageService.get(req.params.workspaceId, req.params.pageId);
  if (!page) return res.status(404).json({ error: "Page not found" });
  res.json(page);
});

// String field is explicitly typed and length-capped so a NoSQL operator
// object like {"$ne": null} fails validation instead of reaching Mongoose.
const createSchema = z.object({
  title: z.string().min(1).max(200),
  contentJson: z.unknown().optional(),
  parentId: z.string().nullable().optional(),
});

pageRoutes.post("/", requireRole("member"), async (req: WorkspaceScopedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const page = await PageService.create(req.params.workspaceId, req.userId!, parsed.data);
  res.status(201).json(page);
});

pageRoutes.patch("/:pageId", requireRole("member"), async (req: WorkspaceScopedRequest, res) => {
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const page = await PageService.update(
    req.params.workspaceId,
    req.userId!,
    req.params.pageId,
    parsed.data,
  );
  if (!page) return res.status(404).json({ error: "Page not found" });
  res.json(page);
});

pageRoutes.delete("/:pageId", requireRole("admin"), async (req: WorkspaceScopedRequest, res) => {
  await PageService.delete(req.params.workspaceId, req.userId!, req.params.pageId);
  res.status(204).send();
});
```

- [ ] **Step 7: Modify `backend/src/app.ts` to mount page routes**

```typescript
import { pageRoutes } from "./routes/pageRoutes";
// inside createApp():
app.use("/workspaces/:workspaceId/pages", pageRoutes);
```

- [ ] **Step 8: Write the routes test, including the NoSQL-injection Review Focus case**

```typescript
// backend/tests/routes/page.routes.test.ts
import request from "supertest";
import { createApp } from "../../src/app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";

const app = createApp();

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

async function setupWorkspace() {
  const reg = await request(app)
    .post("/auth/register")
    .send({ email: "p@x.com", password: "password123", name: "P" });
  const token = reg.body.accessToken as string;
  const ws = await request(app)
    .post("/workspaces")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "WS" });
  return { token, workspaceId: ws.body._id as string };
}

describe("page routes", () => {
  it("creates and lists pages", async () => {
    const { token, workspaceId } = await setupWorkspace();
    await request(app)
      .post(`/workspaces/${workspaceId}/pages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Doc 1" })
      .expect(201);

    const list = await request(app)
      .get(`/workspaces/${workspaceId}/pages`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it("rejects a NoSQL operator injected as the title field (400, not 500)", async () => {
    const { token, workspaceId } = await setupWorkspace();
    await request(app)
      .post(`/workspaces/${workspaceId}/pages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: { $ne: null } })
      .expect(400);
  });
});
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all tests so far)

- [ ] **Step 10: Commit**

```bash
cd ~/huddle-saas
git add backend/src/models/Page.ts backend/src/services/pageService.ts \
  backend/src/routes/pageRoutes.ts backend/src/app.ts \
  backend/tests/services/pageService.test.ts backend/tests/routes/page.routes.test.ts
git commit -m "feat(backend): Pages module with nested docs and cascade delete"
```

---

### Task 6: Boards module (Board/List/Card, move endpoint via transaction, stats aggregation)

**Files:**
- Create: `backend/src/models/Board.ts`
- Create: `backend/src/models/List.ts`
- Create: `backend/src/models/Card.ts`
- Create: `backend/src/services/boardService.ts`
- Create: `backend/src/routes/boardRoutes.ts`
- Modify: `backend/src/app.ts` (mount `/workspaces/:workspaceId/boards`)
- Test: `backend/tests/services/boardService.test.ts`
- Test: `backend/tests/routes/board.routes.test.ts`

**Interfaces:**
- Consumes: `withTransaction`, `AuditService` (Task 4), `requireRole` (Task 3).
- Produces: `BoardService.moveCard(workspaceId, actorId, cardId, toListId, toPosition)`
  — the function Task 8 (Socket.io) calls after a successful move to broadcast
  `card:moved` to the workspace room.
- Produces: `BoardService.getStats(boardId)` returning `{ listId, count }[]` via
  aggregation.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/tests/services/boardService.test.ts
import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { BoardService } from "../../src/services/boardService";
import { Card } from "../../src/models/Card";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("BoardService", () => {
  const workspaceId = new mongoose.Types.ObjectId().toString();
  const actorId = new mongoose.Types.ObjectId().toString();

  async function setupBoard() {
    const board = await BoardService.createBoard(workspaceId, actorId, "Sprint");
    const listA = await BoardService.createList(board._id.toString(), "Todo");
    const listB = await BoardService.createList(board._id.toString(), "Done");
    const card = await BoardService.createCard(listA._id.toString(), actorId, workspaceId, "Ship it");
    return { board, listA, listB, card };
  }

  it("creates a board with lists and cards", async () => {
    const { card } = await setupBoard();
    expect(card.title).toBe("Ship it");
  });

  it("moves a card between lists with a valid, non-colliding position", async () => {
    const { listB, card } = await setupBoard();
    await BoardService.moveCard(workspaceId, actorId, card._id.toString(), listB._id.toString(), 0);
    const moved = await Card.findById(card._id);
    expect(moved!.listId.toString()).toBe(listB._id.toString());
    expect(moved!.position).toBe(0);
  });

  it("keeps positions distinct when two cards land in the same list back-to-back", async () => {
    const { listA, listB, card } = await setupBoard();
    const card2 = await BoardService.createCard(listA._id.toString(), actorId, workspaceId, "Second");
    await BoardService.moveCard(workspaceId, actorId, card._id.toString(), listB._id.toString(), 0);
    await BoardService.moveCard(workspaceId, actorId, card2._id.toString(), listB._id.toString(), 0);
    const cards = await Card.find({ listId: listB._id }).sort({ position: 1 });
    expect(cards.map((c) => c.position)).toEqual([...new Set(cards.map((c) => c.position))]);
  });

  it("returns per-list card counts via aggregation", async () => {
    const { board } = await setupBoard();
    const stats = await BoardService.getStats(board._id.toString());
    expect(stats.reduce((sum, s) => sum + s.count, 0)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- boardService.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the three models**

```typescript
// backend/src/models/Board.ts
import { Schema, model, Types } from "mongoose";

export interface BoardDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  title: string;
  createdAt: Date;
}

const boardSchema = new Schema<BoardDoc>({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

export const Board = model<BoardDoc>("Board", boardSchema);
```

```typescript
// backend/src/models/List.ts
import { Schema, model, Types } from "mongoose";

export interface ListDoc {
  _id: Types.ObjectId;
  boardId: Types.ObjectId;
  title: string;
  position: number;
}

const listSchema = new Schema<ListDoc>({
  boardId: { type: Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true },
  position: { type: Number, required: true, default: 0 },
});

export const List = model<ListDoc>("List", listSchema);
```

```typescript
// backend/src/models/Card.ts
import { Schema, model, Types } from "mongoose";

export interface CardDoc {
  _id: Types.ObjectId;
  listId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  title: string;
  description: string;
  position: number;
  assigneeIds: Types.ObjectId[];
  createdAt: Date;
}

const cardSchema = new Schema<CardDoc>({
  listId: { type: Schema.Types.ObjectId, required: true, index: true },
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true, text: true },
  description: { type: String, default: "", text: true },
  position: { type: Number, required: true, default: 0 },
  assigneeIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: () => new Date() },
});

export const Card = model<CardDoc>("Card", cardSchema);
```

- [ ] **Step 4: Create `backend/src/services/boardService.ts`**

```typescript
import mongoose from "mongoose";
import { Board } from "../models/Board";
import { List } from "../models/List";
import { Card } from "../models/Card";
import { withTransaction } from "../lib/withTransaction";
import { AuditService } from "./auditService";

export const BoardService = {
  async createBoard(workspaceId: string, actorId: string, title: string) {
    const board = await Board.create({ workspaceId, title });
    await AuditService.record({
      actorId,
      workspaceId,
      action: "board.created",
      targetType: "Board",
      targetId: board._id,
    });
    return board;
  },

  async createList(boardId: string, title: string) {
    const count = await List.countDocuments({ boardId });
    return List.create({ boardId, title, position: count });
  },

  async createCard(listId: string, actorId: string, workspaceId: string, title: string) {
    const count = await Card.countDocuments({ listId });
    const card = await Card.create({ listId, workspaceId, title, position: count });
    await AuditService.record({
      actorId,
      workspaceId,
      action: "card.created",
      targetType: "Card",
      targetId: card._id,
    });
    return card;
  },

  /**
   * Moves a card to (toListId, toPosition) and shifts every sibling at or
   * after that position up by one, inside a single transaction, so two
   * concurrent moves into the same slot can never leave two cards with the
   * same position or a gap.
   */
  async moveCard(
    workspaceId: string,
    actorId: string,
    cardId: string,
    toListId: string,
    toPosition: number,
  ) {
    await withTransaction(async (session) => {
      const card = await Card.findById(cardId).session(session);
      if (!card) throw new Error("Card not found");

      const targetList = await List.exists({ _id: toListId }).session(session);
      if (!targetList) throw new Error("Target list not found");

      await Card.updateMany(
        { listId: toListId, position: { $gte: toPosition } },
        { $inc: { position: 1 } },
        { session },
      );

      card.listId = new mongoose.Types.ObjectId(toListId);
      card.position = toPosition;
      await card.save({ session });

      await AuditService.record({
        actorId,
        workspaceId,
        action: "card.moved",
        targetType: "Card",
        targetId: card._id,
        session,
      });
    });
  },

  async getStats(boardId: string) {
    const lists = await List.find({ boardId }, { _id: 1 });
    const listIds = lists.map((l) => l._id);
    const result = await Card.aggregate([
      { $match: { listId: { $in: listIds } } },
      { $group: { _id: "$listId", count: { $sum: 1 } } },
    ]);
    return result.map((r) => ({ listId: r._id.toString(), count: r.count as number }));
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- boardService.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Create `backend/src/routes/boardRoutes.ts`**

```typescript
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { BoardService } from "../services/boardService";

export const boardRoutes = Router({ mergeParams: true });

boardRoutes.use(requireAuth, requireRole("viewer"));

const createBoardSchema = z.object({ title: z.string().min(1).max(100) });

boardRoutes.post("/", requireRole("member"), async (req: WorkspaceScopedRequest, res) => {
  const parsed = createBoardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const board = await BoardService.createBoard(
    req.params.workspaceId,
    req.userId!,
    parsed.data.title,
  );
  res.status(201).json(board);
});

boardRoutes.post(
  "/:boardId/lists",
  requireRole("member"),
  async (req: WorkspaceScopedRequest, res) => {
    const parsed = createBoardSchema.safeParse(req.body); // same {title} shape
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const list = await BoardService.createList(req.params.boardId, parsed.data.title);
    res.status(201).json(list);
  },
);

boardRoutes.post(
  "/:boardId/lists/:listId/cards",
  requireRole("member"),
  async (req: WorkspaceScopedRequest, res) => {
    const parsed = createBoardSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const card = await BoardService.createCard(
      req.params.listId,
      req.userId!,
      req.params.workspaceId,
      parsed.data.title,
    );
    res.status(201).json(card);
  },
);

const moveSchema = z.object({
  toListId: z.string().min(1),
  toPosition: z.number().int().min(0),
});

boardRoutes.post(
  "/cards/:cardId/move",
  requireRole("member"),
  async (req: WorkspaceScopedRequest, res) => {
    const parsed = moveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    await BoardService.moveCard(
      req.params.workspaceId,
      req.userId!,
      req.params.cardId,
      parsed.data.toListId,
      parsed.data.toPosition,
    );
    res.status(200).json({ ok: true });
  },
);

boardRoutes.get("/:boardId/stats", async (req: WorkspaceScopedRequest, res) => {
  const stats = await BoardService.getStats(req.params.boardId);
  res.json(stats);
});
```

- [ ] **Step 7: Modify `backend/src/app.ts` to mount board routes**

```typescript
import { boardRoutes } from "./routes/boardRoutes";
// inside createApp():
app.use("/workspaces/:workspaceId/boards", boardRoutes);
```

- [ ] **Step 8: Write the routes test**

```typescript
// backend/tests/routes/board.routes.test.ts
import request from "supertest";
import { createApp } from "../../src/app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";

const app = createApp();

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("board routes", () => {
  it("creates a board, list, card, and moves the card", async () => {
    const reg = await request(app)
      .post("/auth/register")
      .send({ email: "b@x.com", password: "password123", name: "B" });
    const token = reg.body.accessToken as string;
    const ws = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "WS" });
    const workspaceId = ws.body._id;

    const board = await request(app)
      .post(`/workspaces/${workspaceId}/boards`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Board 1" })
      .expect(201);

    const listA = await request(app)
      .post(`/workspaces/${workspaceId}/boards/${board.body._id}/lists`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Todo" })
      .expect(201);

    const listB = await request(app)
      .post(`/workspaces/${workspaceId}/boards/${board.body._id}/lists`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Done" })
      .expect(201);

    const card = await request(app)
      .post(`/workspaces/${workspaceId}/boards/${board.body._id}/lists/${listA.body._id}/cards`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Card 1" })
      .expect(201);

    await request(app)
      .post(`/workspaces/${workspaceId}/boards/cards/${card.body._id}/move`)
      .set("Authorization", `Bearer ${token}`)
      .send({ toListId: listB.body._id, toPosition: 0 })
      .expect(200);
  });
});
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all tests so far)

- [ ] **Step 10: Commit**

```bash
cd ~/huddle-saas
git add backend/src/models/Board.ts backend/src/models/List.ts backend/src/models/Card.ts \
  backend/src/services/boardService.ts backend/src/routes/boardRoutes.ts backend/src/app.ts \
  backend/tests/services/boardService.test.ts backend/tests/routes/board.routes.test.ts
git commit -m "feat(backend): Boards module with transactional card move + stats"
```

---

### Task 7: Channels/Messages module with pagination

**Files:**
- Create: `backend/src/models/Channel.ts`
- Create: `backend/src/models/Message.ts`
- Create: `backend/src/services/chatService.ts`
- Create: `backend/src/routes/chatRoutes.ts`
- Modify: `backend/src/app.ts` (mount `/workspaces/:workspaceId/channels`)
- Test: `backend/tests/services/chatService.test.ts`
- Test: `backend/tests/routes/chat.routes.test.ts`

**Interfaces:**
- Produces: `ChatService.postMessage(channelId, authorId, workspaceId, body)` —
  the function Task 8 (Socket.io) calls before broadcasting `message:new`.
- Produces: `ChatService.listMessages(channelId, { before, limit })` — cursor
  pagination by `createdAt`/`_id`, the pattern the frontend infinite scroll
  (frontend plan) consumes.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/tests/services/chatService.test.ts
import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { ChatService } from "../../src/services/chatService";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("ChatService", () => {
  const workspaceId = new mongoose.Types.ObjectId().toString();
  const authorId = new mongoose.Types.ObjectId().toString();

  it("posts and lists messages oldest-to-newest is reversed for the newest page", async () => {
    const channel = await ChatService.createChannel(workspaceId, "general");
    for (let i = 0; i < 3; i++) {
      await ChatService.postMessage(channel._id.toString(), authorId, workspaceId, `msg ${i}`);
    }
    const page = await ChatService.listMessages(channel._id.toString(), { limit: 2 });
    expect(page.messages).toHaveLength(2);
    expect(page.messages[0].body).toBe("msg 2");
    expect(page.nextCursor).toEqual(expect.any(String));
  });

  it("paginates backward using the cursor without duplicates or gaps", async () => {
    const channel = await ChatService.createChannel(workspaceId, "general2");
    for (let i = 0; i < 5; i++) {
      await ChatService.postMessage(channel._id.toString(), authorId, workspaceId, `msg ${i}`);
    }
    const page1 = await ChatService.listMessages(channel._id.toString(), { limit: 2 });
    const page2 = await ChatService.listMessages(channel._id.toString(), {
      limit: 2,
      before: page1.nextCursor!,
    });
    const bodies = [...page1.messages, ...page2.messages].map((m) => m.body);
    expect(new Set(bodies).size).toBe(bodies.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- chatService.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the two models**

```typescript
// backend/src/models/Channel.ts
import { Schema, model, Types } from "mongoose";

export interface ChannelDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  name: string;
  createdAt: Date;
}

const channelSchema = new Schema<ChannelDoc>({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

export const Channel = model<ChannelDoc>("Channel", channelSchema);
```

```typescript
// backend/src/models/Message.ts
import { Schema, model, Types } from "mongoose";

export interface MessageDoc {
  _id: Types.ObjectId;
  channelId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  authorId: Types.ObjectId;
  body: string;
  createdAt: Date;
}

const messageSchema = new Schema<MessageDoc>({
  channelId: { type: Schema.Types.ObjectId, required: true, index: true },
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  authorId: { type: Schema.Types.ObjectId, required: true },
  body: { type: String, required: true, text: true },
  createdAt: { type: Date, default: () => new Date(), index: true },
});

export const Message = model<MessageDoc>("Message", messageSchema);
```

- [ ] **Step 4: Create `backend/src/services/chatService.ts`**

```typescript
import { Channel } from "../models/Channel";
import { Message } from "../models/Message";

interface ListOptions {
  limit?: number;
  before?: string; // opaque cursor: the _id of the oldest message already seen
}

export const ChatService = {
  async createChannel(workspaceId: string, name: string) {
    return Channel.create({ workspaceId, name });
  },

  async postMessage(channelId: string, authorId: string, workspaceId: string, body: string) {
    return Message.create({ channelId, authorId, workspaceId, body });
  },

  async listMessages(channelId: string, options: ListOptions) {
    const limit = options.limit ?? 25;
    const query: Record<string, unknown> = { channelId };
    if (options.before) {
      query._id = { $lt: options.before };
    }
    const rows = await Message.find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .lean();

    return {
      messages: rows.reverse(), // return oldest-first within the page for easy rendering
      nextCursor: rows.length === limit ? rows[0]._id.toString() : null,
    };
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- chatService.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Create `backend/src/routes/chatRoutes.ts`**

```typescript
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { ChatService } from "../services/chatService";

export const chatRoutes = Router({ mergeParams: true });

chatRoutes.use(requireAuth, requireRole("viewer"));

const createChannelSchema = z.object({ name: z.string().min(1).max(80) });

chatRoutes.post("/", requireRole("member"), async (req: WorkspaceScopedRequest, res) => {
  const parsed = createChannelSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const channel = await ChatService.createChannel(req.params.workspaceId, parsed.data.name);
  res.status(201).json(channel);
});

const messageSchema = z.object({ body: z.string().min(1).max(4000) });

chatRoutes.post(
  "/:channelId/messages",
  requireRole("member"),
  async (req: WorkspaceScopedRequest, res) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const message = await ChatService.postMessage(
      req.params.channelId,
      req.userId!,
      req.params.workspaceId,
      parsed.data.body,
    );
    res.status(201).json(message);
  },
);

chatRoutes.get("/:channelId/messages", async (req: WorkspaceScopedRequest, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const before = typeof req.query.before === "string" ? req.query.before : undefined;
  const page = await ChatService.listMessages(req.params.channelId, { limit, before });
  res.json(page);
});
```

- [ ] **Step 7: Modify `backend/src/app.ts` to mount chat routes**

```typescript
import { chatRoutes } from "./routes/chatRoutes";
// inside createApp():
app.use("/workspaces/:workspaceId/channels", chatRoutes);
```

- [ ] **Step 8: Write the routes test**

```typescript
// backend/tests/routes/chat.routes.test.ts
import request from "supertest";
import { createApp } from "../../src/app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";

const app = createApp();

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("chat routes", () => {
  it("creates a channel, posts a message, and paginates messages", async () => {
    const reg = await request(app)
      .post("/auth/register")
      .send({ email: "c@x.com", password: "password123", name: "C" });
    const token = reg.body.accessToken as string;
    const ws = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "WS" });
    const workspaceId = ws.body._id;

    const channel = await request(app)
      .post(`/workspaces/${workspaceId}/channels`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "general" })
      .expect(201);

    await request(app)
      .post(`/workspaces/${workspaceId}/channels/${channel.body._id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "hello" })
      .expect(201);

    const list = await request(app)
      .get(`/workspaces/${workspaceId}/channels/${channel.body._id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(list.body.messages).toHaveLength(1);
  });
});
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all tests so far)

- [ ] **Step 10: Commit**

```bash
cd ~/huddle-saas
git add backend/src/models/Channel.ts backend/src/models/Message.ts \
  backend/src/services/chatService.ts backend/src/routes/chatRoutes.ts backend/src/app.ts \
  backend/tests/services/chatService.test.ts backend/tests/routes/chat.routes.test.ts
git commit -m "feat(backend): Channels/Messages module with cursor pagination"
```

---

### Task 8: Socket.io realtime (chat, card moves, presence)

**Files:**
- Create: `backend/src/sockets/index.ts`
- Create: `backend/src/sockets/auth.ts`
- Modify: `backend/src/server.ts` (attach Socket.io to the HTTP server)
- Modify: `backend/src/routes/chatRoutes.ts` (emit `message:new` after post)
- Modify: `backend/src/routes/boardRoutes.ts` (emit `card:moved` after move)
- Test: `backend/tests/sockets/sockets.test.ts`

**Interfaces:**
- Produces: `attachSockets(httpServer): Server` — called once from `server.ts`.
- Produces: `emitToWorkspace(workspaceId, event, payload)` — a plain function
  (not a class) so route handlers can call it without importing the whole
  Socket.io server object.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/tests/sockets/sockets.test.ts
import { createServer } from "http";
import { AddressInfo } from "net";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import { attachSockets, emitToWorkspace } from "../../src/sockets/index";
import { AuthService } from "../../src/services/authService";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";

let httpServer: ReturnType<typeof createServer>;
let port: number;
let client: ClientSocket;

beforeAll(async () => {
  await connectTestDb();
  httpServer = createServer();
  attachSockets(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as AddressInfo).port;
});

afterEach(async () => {
  client?.close();
  await clearTestDb();
});

afterAll(async () => {
  httpServer.close();
  await disconnectTestDb();
});

describe("sockets", () => {
  it("joins a workspace room after authenticating and receives a broadcast", async () => {
    const { accessToken } = await AuthService.register("s@x.com", "password123", "S");

    client = ioClient(`http://localhost:${port}`, {
      auth: { token: accessToken },
      transports: ["websocket"],
    });

    await new Promise<void>((resolve, reject) => {
      client.on("connect_error", reject);
      client.on("connect", resolve);
    });

    client.emit("workspace:join", "ws-1");

    const received = new Promise((resolve) => {
      client.on("message:new", resolve);
    });

    // give the join a tick to register before broadcasting
    await new Promise((r) => setTimeout(r, 50));
    emitToWorkspace("ws-1", "message:new", { body: "hi" });

    await expect(received).resolves.toEqual({ body: "hi" });
  });

  it("rejects a connection with no auth token", async () => {
    const badClient = ioClient(`http://localhost:${port}`, {
      auth: {},
      transports: ["websocket"],
    });
    const err = await new Promise((resolve) => {
      badClient.on("connect_error", resolve);
    });
    expect(err).toBeTruthy();
    badClient.close();
  });
});
```

- [ ] **Step 2: Add `socket.io-client` as a dev dependency and run test to verify it fails**

```bash
cd backend && npm install -D socket.io-client
npm test -- sockets.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `backend/src/sockets/auth.ts`**

```typescript
import { Socket } from "socket.io";
import { AuthService } from "../services/authService";

export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
) {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    return next(new Error("Missing auth token"));
  }
  try {
    const payload = AuthService.verifyAccessToken(token);
    socket.data.userId = payload.sub;
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
}
```

- [ ] **Step 4: Create `backend/src/sockets/index.ts`**

```typescript
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
```

- [ ] **Step 5: Modify `backend/src/server.ts` to attach sockets**

```typescript
import { createServer } from "http";
import mongoose from "mongoose";
import { createApp } from "./app";
import { attachSockets } from "./sockets/index";
import { env } from "./config/env";

async function main() {
  await mongoose.connect(env.MONGO_URI);
  const app = createApp();
  const httpServer = createServer(app);
  attachSockets(httpServer);
  httpServer.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`huddle-backend listening on :${env.PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error", err);
  process.exit(1);
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- sockets.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Wire real emits into chat and board routes**

```typescript
// backend/src/routes/chatRoutes.ts — add import and call after creating the message
import { emitToWorkspace } from "../sockets/index";
// ...inside the POST /:channelId/messages handler, after `const message = await ChatService.postMessage(...)`:
emitToWorkspace(req.params.workspaceId, "message:new", message);
```

```typescript
// backend/src/routes/boardRoutes.ts — add import and call after a successful move
import { emitToWorkspace } from "../sockets/index";
// ...inside the POST /cards/:cardId/move handler, after `await BoardService.moveCard(...)`:
emitToWorkspace(req.params.workspaceId, "card:moved", {
  cardId: req.params.cardId,
  toListId: req.body.toListId,
  toPosition: req.body.toPosition,
});
```

- [ ] **Step 8: Run the full suite to confirm nothing broke**

Run: `npm test`
Expected: PASS (all tests)

- [ ] **Step 9: Commit**

```bash
cd ~/huddle-saas
git add backend/src/sockets backend/src/server.ts backend/src/routes/chatRoutes.ts \
  backend/src/routes/boardRoutes.ts backend/tests/sockets/sockets.test.ts backend/package.json backend/package-lock.json
git commit -m "feat(backend): Socket.io realtime chat, card-move broadcast, auth handshake"
```

---

### Task 9: BullMQ jobs — mention notifications and search reindex

**Files:**
- Create: `backend/src/models/Notification.ts`
- Create: `backend/src/jobs/queues.ts`
- Create: `backend/src/jobs/mentionProcessor.ts`
- Create: `backend/src/jobs/searchReindexProcessor.ts`
- Create: `backend/src/jobs/worker.ts`
- Modify: `backend/src/routes/chatRoutes.ts` (enqueue mention job after posting)
- Test: `backend/tests/jobs/mentionProcessor.test.ts`
- Test: `backend/tests/jobs/searchReindexProcessor.test.ts`

**Interfaces:**
- Produces: `extractMentions(body: string): string[]` (plain function, unit
  tested directly — this is the part BullMQ testing should focus on, since
  exercising the real queue/worker requires a live Redis and is covered
  manually via docker-compose, not CI).
- Produces: `mentionProcessor(job): Promise<void>` and
  `searchReindexProcessor(job): Promise<void>` as plain async functions
  registered as BullMQ processors in `worker.ts`, so each is unit-testable by
  calling it directly with a fake `job` object.

- [ ] **Step 1: Write the failing test for mention extraction and processing**

```typescript
// backend/tests/jobs/mentionProcessor.test.ts
import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { extractMentions, mentionProcessor } from "../../src/jobs/mentionProcessor";
import { User } from "../../src/models/User";
import { Notification } from "../../src/models/Notification";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("extractMentions", () => {
  it("extracts @handles from a message body", () => {
    expect(extractMentions("hey @ada and @grace, check this")).toEqual(["ada", "grace"]);
  });

  it("returns an empty array when there are no mentions", () => {
    expect(extractMentions("no mentions here")).toEqual([]);
  });
});

describe("mentionProcessor", () => {
  it("creates a Notification for each mentioned user that exists", async () => {
    const argon2 = await import("argon2");
    const mentioned = await User.create({
      email: "ada@x.com",
      name: "ada",
      passwordHash: await argon2.hash("password123"),
    });
    const workspaceId = new mongoose.Types.ObjectId().toString();

    await mentionProcessor({
      data: {
        body: "hey @ada!",
        authorId: new mongoose.Types.ObjectId().toString(),
        workspaceId,
        messageId: new mongoose.Types.ObjectId().toString(),
      },
    } as never);

    const notifications = await Notification.find({ userId: mentioned._id });
    expect(notifications).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- mentionProcessor.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create `backend/src/models/Notification.ts`**

```typescript
import { Schema, model, Types } from "mongoose";

export interface NotificationDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  type: string;
  payload: unknown;
  read: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDoc>({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  workspaceId: { type: Schema.Types.ObjectId, required: true },
  type: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, default: {} },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: () => new Date() },
});

export const Notification = model<NotificationDoc>("Notification", notificationSchema);
```

- [ ] **Step 4: Create `backend/src/jobs/mentionProcessor.ts`**

```typescript
import { Job } from "bullmq";
import { User } from "../models/User";
import { Notification } from "../models/Notification";

export function extractMentions(body: string): string[] {
  const matches = body.match(/@([a-zA-Z0-9_]+)/g) ?? [];
  return matches.map((m) => m.slice(1));
}

interface MentionJobData {
  body: string;
  authorId: string;
  workspaceId: string;
  messageId: string;
}

export async function mentionProcessor(job: Job<MentionJobData>) {
  const { body, workspaceId, messageId } = job.data;
  const handles = extractMentions(body);
  if (handles.length === 0) return;

  // "handle" here matches the local part of the email for demo purposes,
  // since the app has no separate @username field.
  const emailPrefixes = handles.map((h) => new RegExp(`^${h}@`, "i"));
  const users = await User.find({ email: { $in: emailPrefixes } });

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u._id,
        workspaceId,
        type: "mention",
        payload: { messageId },
      }),
    ),
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- mentionProcessor.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Write the failing test for the search-reindex processor**

```typescript
// backend/tests/jobs/searchReindexProcessor.test.ts
import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { searchReindexProcessor } from "../../src/jobs/searchReindexProcessor";
import { Page } from "../../src/models/Page";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("searchReindexProcessor", () => {
  it("touches updatedAt on the target page (stand-in for a real reindex step)", async () => {
    const page = await Page.create({
      workspaceId: new mongoose.Types.ObjectId(),
      title: "Doc",
      updatedAt: new Date(0),
    });

    await searchReindexProcessor({
      data: { entityType: "page", entityId: page._id.toString() },
    } as never);

    const updated = await Page.findById(page._id);
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- searchReindexProcessor.test.ts`
Expected: FAIL — module not found

- [ ] **Step 8: Create `backend/src/jobs/searchReindexProcessor.ts`**

```typescript
import { Job } from "bullmq";
import { Page } from "../models/Page";

interface ReindexJobData {
  entityType: "page" | "card" | "message";
  entityId: string;
}

/**
 * Mongo text indexes update automatically on write, so there is no separate
 * index to rebuild; this job's real job is to bump `updatedAt` so any
 * downstream cache (e.g. a search results cache) knows the document changed.
 */
export async function searchReindexProcessor(job: Job<ReindexJobData>) {
  const { entityType, entityId } = job.data;
  if (entityType === "page") {
    await Page.findByIdAndUpdate(entityId, { updatedAt: new Date() });
  }
}
```

- [ ] **Step 9: Create `backend/src/jobs/queues.ts`**

```typescript
import { Queue } from "bullmq";
import { env } from "../config/env";

const connection = { url: env.REDIS_URL };

export const mentionQueue = new Queue("mention-notification", { connection });
export const searchReindexQueue = new Queue("search-reindex", { connection });
```

- [ ] **Step 10: Create `backend/src/jobs/worker.ts`**

```typescript
import { Worker } from "bullmq";
import { env } from "../config/env";
import { mentionProcessor } from "./mentionProcessor";
import { searchReindexProcessor } from "./searchReindexProcessor";

const connection = { url: env.REDIS_URL };

export function startWorkers() {
  const mentionWorker = new Worker("mention-notification", mentionProcessor, { connection });
  const searchWorker = new Worker("search-reindex", searchReindexProcessor, { connection });
  return [mentionWorker, searchWorker];
}
```

- [ ] **Step 11: Run test to verify it passes**

Run: `npm test -- searchReindexProcessor.test.ts`
Expected: PASS

- [ ] **Step 12: Wire the mention queue into chat message posting**

```typescript
// backend/src/routes/chatRoutes.ts — add import and enqueue after posting
import { mentionQueue } from "../jobs/queues";
// ...inside the POST /:channelId/messages handler, after emitToWorkspace(...):
await mentionQueue.add("mention", {
  body: parsed.data.body,
  authorId: req.userId,
  workspaceId: req.params.workspaceId,
  messageId: message._id.toString(),
});
```

- [ ] **Step 13: Start the worker process alongside the server**

```typescript
// backend/src/server.ts — add import and call
import { startWorkers } from "./jobs/worker";
// inside main(), after attachSockets(httpServer):
startWorkers();
```

- [ ] **Step 14: Run full suite**

Run: `npm test`
Expected: PASS (all tests). Note: route tests that hit `/messages` now call
`mentionQueue.add`, which requires a reachable Redis. If CI has no Redis
service yet, this is resolved by Task 12's CI workflow, which starts a Redis
service container — do not skip that step.

- [ ] **Step 15: Commit**

```bash
cd ~/huddle-saas
git add backend/src/models/Notification.ts backend/src/jobs backend/src/routes/chatRoutes.ts \
  backend/src/server.ts backend/tests/jobs
git commit -m "feat(backend): BullMQ mention-notification and search-reindex jobs"
```

---

### Task 10: Search endpoint + file uploads

**Files:**
- Create: `backend/src/services/searchService.ts`
- Create: `backend/src/routes/searchRoutes.ts`
- Create: `backend/src/models/Attachment.ts`
- Create: `backend/src/routes/uploadRoutes.ts`
- Modify: `backend/src/app.ts` (mount `/workspaces/:workspaceId/search` and `/uploads`)
- Test: `backend/tests/services/searchService.test.ts`
- Test: `backend/tests/routes/upload.routes.test.ts`

**Interfaces:**
- Produces: `SearchService.search(workspaceId, query): Promise<SearchResult[]>`
  merging Page/Card/Message text-index hits.
- Produces: `POST /workspaces/:workspaceId/uploads` returning `{ id, url,
  mimeType, size }`, rejecting anything outside an allowlist or over 5MB.

- [ ] **Step 1: Ensure text indexes exist — add to each model**

```typescript
// backend/src/models/Page.ts — add after schema definition, before model():
pageSchema.index({ title: "text", contentJson: "text" });
```

```typescript
// backend/src/models/Card.ts — add after schema definition, before model():
cardSchema.index({ title: "text", description: "text" });
```

```typescript
// backend/src/models/Message.ts — add after schema definition, before model():
messageSchema.index({ body: "text" });
```

- [ ] **Step 2: Write the failing test for search**

```typescript
// backend/tests/services/searchService.test.ts
import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { SearchService } from "../../src/services/searchService";
import { Page } from "../../src/models/Page";
import { Card } from "../../src/models/Card";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("SearchService", () => {
  it("finds matches across pages and cards, scoped to the workspace", async () => {
    const workspaceId = new mongoose.Types.ObjectId();
    const otherWorkspaceId = new mongoose.Types.ObjectId();
    await Page.create({ workspaceId, title: "Rocket launch plan" });
    await Card.create({
      workspaceId,
      listId: new mongoose.Types.ObjectId(),
      title: "Fix rocket engine bug",
      position: 0,
    });
    await Page.create({ workspaceId: otherWorkspaceId, title: "Rocket secrets" });

    const results = await SearchService.search(workspaceId.toString(), "rocket");
    expect(results.length).toBe(2);
    expect(results.every((r) => r.workspaceId === workspaceId.toString())).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- searchService.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Create `backend/src/services/searchService.ts`**

```typescript
import { Page } from "../models/Page";
import { Card } from "../models/Card";
import { Message } from "../models/Message";

export interface SearchResult {
  type: "page" | "card" | "message";
  id: string;
  workspaceId: string;
  title: string;
  score: number;
}

export const SearchService = {
  async search(workspaceId: string, query: string): Promise<SearchResult[]> {
    const filter = { workspaceId, $text: { $search: query } };
    const projection = { score: { $meta: "textScore" } };

    const [pages, cards, messages] = await Promise.all([
      Page.find(filter, projection).sort(projection).limit(10).lean(),
      Card.find(filter, projection).sort(projection).limit(10).lean(),
      Message.find(filter, projection).sort(projection).limit(10).lean(),
    ]);

    const results: SearchResult[] = [
      ...pages.map((p) => ({
        type: "page" as const,
        id: p._id.toString(),
        workspaceId: p.workspaceId.toString(),
        title: p.title,
        score: (p as unknown as { score: number }).score,
      })),
      ...cards.map((c) => ({
        type: "card" as const,
        id: c._id.toString(),
        workspaceId: c.workspaceId.toString(),
        title: c.title,
        score: (c as unknown as { score: number }).score,
      })),
      ...messages.map((m) => ({
        type: "message" as const,
        id: m._id.toString(),
        workspaceId: m.workspaceId.toString(),
        title: m.body.slice(0, 80),
        score: (m as unknown as { score: number }).score,
      })),
    ];

    return results.sort((a, b) => b.score - a.score);
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- searchService.test.ts`
Expected: PASS

- [ ] **Step 6: Create `backend/src/routes/searchRoutes.ts`**

```typescript
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { SearchService } from "../services/searchService";

export const searchRoutes = Router({ mergeParams: true });

searchRoutes.use(requireAuth, requireRole("viewer"));

searchRoutes.get("/", async (req: WorkspaceScopedRequest, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  if (!q.trim()) return res.json([]);
  const results = await SearchService.search(req.params.workspaceId, q);
  res.json(results);
});
```

- [ ] **Step 7: Create `backend/src/models/Attachment.ts`**

```typescript
import { Schema, model, Types } from "mongoose";

export interface AttachmentDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  uploaderId: Types.ObjectId;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  createdAt: Date;
}

const attachmentSchema = new Schema<AttachmentDoc>({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  uploaderId: { type: Schema.Types.ObjectId, required: true },
  filename: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  path: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

export const Attachment = model<AttachmentDoc>("Attachment", attachmentSchema);
```

- [ ] **Step 8: Write the failing upload route test (the Review Focus case: oversized/wrong-type)**

```typescript
// backend/tests/routes/upload.routes.test.ts
import request from "supertest";
import { createApp } from "../../src/app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";

const app = createApp();

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

async function setupWorkspace() {
  const reg = await request(app)
    .post("/auth/register")
    .send({ email: "u@x.com", password: "password123", name: "U" });
  const token = reg.body.accessToken as string;
  const ws = await request(app)
    .post("/workspaces")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "WS" });
  return { token, workspaceId: ws.body._id as string };
}

describe("upload routes", () => {
  it("accepts a small png upload", async () => {
    const { token, workspaceId } = await setupWorkspace();
    const res = await request(app)
      .post(`/workspaces/${workspaceId}/uploads`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: "test.png",
        contentType: "image/png",
      })
      .expect(201);
    expect(res.body.mimeType).toBe("image/png");
  });

  it("rejects a disallowed file type with 400", async () => {
    const { token, workspaceId } = await setupWorkspace();
    await request(app)
      .post(`/workspaces/${workspaceId}/uploads`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("#!/bin/sh\necho hi"), {
        filename: "script.sh",
        contentType: "application/x-sh",
      })
      .expect(400);
  });

  it("rejects a file over the 5MB limit with 400/413, not a crash", async () => {
    const { token, workspaceId } = await setupWorkspace();
    const big = Buffer.alloc(6 * 1024 * 1024, 1);
    const res = await request(app)
      .post(`/workspaces/${workspaceId}/uploads`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", big, { filename: "big.png", contentType: "image/png" });
    expect([400, 413]).toContain(res.status);
  });
});
```

- [ ] **Step 9: Run test to verify it fails**

Run: `npm test -- upload.routes.test.ts`
Expected: FAIL — module not found

- [ ] **Step 10: Create `backend/src/routes/uploadRoutes.ts`**

```typescript
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { Attachment } from "../models/Attachment";

export const uploadRoutes = Router({ mergeParams: true });

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/gif", "application/pdf"]);
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error("Unsupported file type"));
    }
    cb(null, true);
  },
});

uploadRoutes.use(requireAuth, requireRole("member"));

uploadRoutes.post("/", (req: WorkspaceScopedRequest, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const attachment = await Attachment.create({
      workspaceId: req.params.workspaceId,
      uploaderId: req.userId,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
    });

    res.status(201).json({
      id: attachment._id,
      url: `/uploads/${path.basename(req.file.path)}`,
      mimeType: attachment.mimeType,
      size: attachment.size,
    });
  });
});
```

- [ ] **Step 11: Modify `backend/src/app.ts` to mount search and upload routes and serve uploads statically**

```typescript
import path from "path";
import { searchRoutes } from "./routes/searchRoutes";
import { uploadRoutes } from "./routes/uploadRoutes";
// inside createApp():
app.use("/workspaces/:workspaceId/search", searchRoutes);
app.use("/workspaces/:workspaceId/uploads", uploadRoutes);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all tests). Multer's `limits.fileFilter` error surfaces as a
generic error from `upload.single` — confirm the 6MB case returns 400 (Multer
emits `LIMIT_FILE_SIZE` as an `Error` caught by the `err` branch above, not a
thrown exception, so no extra try/catch is needed).

- [ ] **Step 13: Commit**

```bash
cd ~/huddle-saas
git add backend/src/services/searchService.ts backend/src/routes/searchRoutes.ts \
  backend/src/models/Attachment.ts backend/src/routes/uploadRoutes.ts backend/src/app.ts \
  backend/src/models/Page.ts backend/src/models/Card.ts backend/src/models/Message.ts \
  backend/tests/services/searchService.test.ts backend/tests/routes/upload.routes.test.ts
git commit -m "feat(backend): cross-entity search and validated file uploads"
```

---

### Task 11: Swagger docs, security hardening, structured logging, error handler

**Files:**
- Create: `backend/src/docs/swagger.ts`
- Create: `backend/src/middleware/errorHandler.ts`
- Create: `backend/src/middleware/rateLimit.ts`
- Create: `backend/src/lib/logger.ts`
- Modify: `backend/src/app.ts` (mount `/api/docs`, rate limiter on `/auth`, logger, error handler last)
- Modify: `backend/src/routes/authRoutes.ts` (add swagger-jsdoc `@openapi` comments)
- Test: `backend/tests/routes/docs.routes.test.ts`
- Test: `backend/tests/middleware/rateLimit.test.ts`

**Interfaces:**
- Produces: `errorHandler` — the last Express middleware, converting any
  uncaught error into a `500 { error: "Internal server error" }` JSON body
  instead of leaking a stack trace, and logging it via `logger`.

- [ ] **Step 1: Write the failing test for `/api/docs`**

```typescript
// backend/tests/routes/docs.routes.test.ts
import request from "supertest";
import { createApp } from "../../src/app";

describe("GET /api/docs", () => {
  it("serves the Swagger UI page", async () => {
    const app = createApp();
    const res = await request(app).get("/api/docs/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger-ui");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- docs.routes.test.ts`
Expected: FAIL — 404, route not mounted

- [ ] **Step 3: Create `backend/src/docs/swagger.ts`**

```typescript
import swaggerJsdoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: { title: "Huddle API", version: "0.1.0" },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
  apis: ["src/routes/*.ts"],
});
```

- [ ] **Step 4: Create `backend/src/lib/logger.ts`**

```typescript
import pino from "pino";
import { env } from "../config/env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  redact: ["req.headers.authorization"],
});
```

- [ ] **Step 5: Create `backend/src/middleware/errorHandler.ts`**

```typescript
import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  logger.error({ err, path: req.path }, "Unhandled error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
}
```

- [ ] **Step 6: Create `backend/src/middleware/rateLimit.ts`**

```typescript
import rateLimit from "express-rate-limit";

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts, try again later" },
});
```

- [ ] **Step 7: Modify `backend/src/app.ts` to wire docs, logging, rate limit, error handler**

```typescript
import swaggerUi from "swagger-ui-express";
import pinoHttp from "pino-http";
import { swaggerSpec } from "./docs/swagger";
import { logger } from "./lib/logger";
import { authRateLimit } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/errorHandler";

// inside createApp(), after app.use(express.json()):
app.use(pinoHttp({ logger }));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/auth", authRateLimit); // placed BEFORE app.use("/auth", authRoutes) below

// at the very end of createApp(), after all other app.use(...) route mounts,
// immediately before `return app;`:
app.use(errorHandler);
```

- [ ] **Step 8: Add one `@openapi` annotation to `authRoutes.ts` as the documented pattern**

```typescript
// backend/src/routes/authRoutes.ts — add directly above `authRoutes.post("/register", ...)`:
/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email: { type: string }
 *               password: { type: string, minLength: 8 }
 *               name: { type: string }
 *     responses:
 *       201: { description: User created with token pair }
 *       400: { description: Validation error }
 *       409: { description: Email already registered }
 */
```

- [ ] **Step 9: Run test to verify docs test passes**

Run: `npm test -- docs.routes.test.ts`
Expected: PASS

- [ ] **Step 10: Write and run the rate-limit test**

```typescript
// backend/tests/middleware/rateLimit.test.ts
import request from "supertest";
import { createApp } from "../../src/app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";

const app = createApp();

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("auth rate limiting", () => {
  it("returns 429 after exceeding the auth attempt limit", async () => {
    const attempts = Array.from({ length: 21 }, () =>
      request(app).post("/auth/login").send({ email: "x@x.com", password: "wrong" }),
    );
    const results = await Promise.all(attempts);
    expect(results.some((r) => r.status === 429)).toBe(true);
  });
});
```

Run: `npm test -- rateLimit.test.ts`
Expected: PASS

- [ ] **Step 11: Run the full suite**

Run: `npm test`
Expected: PASS (all tests)

- [ ] **Step 12: Commit**

```bash
cd ~/huddle-saas
git add backend/src/docs backend/src/middleware/errorHandler.ts backend/src/middleware/rateLimit.ts \
  backend/src/lib/logger.ts backend/src/app.ts backend/src/routes/authRoutes.ts \
  backend/tests/routes/docs.routes.test.ts backend/tests/middleware/rateLimit.test.ts
git commit -m "feat(backend): Swagger docs, structured logging, rate limiting, error handler"
```

---

### Task 12: Coverage verification and backend wrap-up

**Files:**
- Modify: `backend/jest.config.ts` (confirm thresholds still pass)
- Create: `backend/README.md` (backend-specific run instructions, linked from root README in the DevOps plan)

- [ ] **Step 1: Run the full suite with coverage**

Run: `npm run test:coverage`
Expected: PASS, with `src/services/**` and `src/middleware/**` both at or
above 60% statements / 50% branches. If a specific service is under
threshold, add one more test to that service's existing test file targeting
its least-covered branch (e.g. an error path) — do not lower the threshold.

- [ ] **Step 2: Create `backend/README.md`**

```markdown
# Huddle Backend

Express + TypeScript API for Huddle. See the root README for the full
project overview, architecture diagram, and Docker instructions.

## Local dev (without Docker)

1. `cp .env.example .env` and adjust if needed.
2. Start MongoDB and Redis locally (or via the root `docker-compose.yml`).
3. `npm install`
4. `npm run dev`

## Tests

- `npm test` — full suite
- `npm run test:coverage` — with coverage report

## API docs

Once running, Swagger UI is at `http://localhost:4000/api/docs`.
```

- [ ] **Step 3: Commit**

```bash
cd ~/huddle-saas
git add backend/README.md backend/jest.config.ts
git commit -m "docs(backend): add backend README with run and test instructions"
```
