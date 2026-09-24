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
