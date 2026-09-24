import request from "supertest";
import { createApp } from "../../src/app";
import { mentionQueue, searchReindexQueue } from "../../src/jobs/queues";

afterAll(async () => {
  await mentionQueue.close();
  await searchReindexQueue.close();
});

describe("GET /api/docs", () => {
  it("serves the Swagger UI page", async () => {
    const app = createApp();
    const res = await request(app).get("/api/docs/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger-ui");
  });
});
