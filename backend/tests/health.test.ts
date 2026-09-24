import request from "supertest";
import { createApp } from "../src/app";
import { mentionQueue, searchReindexQueue } from "../src/jobs/queues";

// createApp() pulls in chatRoutes -> jobs/queues.ts, which opens real
// BullMQ/ioredis connections at import time even though this test never
// touches chat endpoints — close them so Jest can exit cleanly.
afterAll(async () => {
  await mentionQueue.close();
  await searchReindexQueue.close();
});

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
