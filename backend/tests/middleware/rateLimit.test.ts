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
