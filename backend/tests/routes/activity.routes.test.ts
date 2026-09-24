import request from "supertest";
import { createApp } from "../../src/app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";

const app = createApp();

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("GET /workspaces/:workspaceId/activity", () => {
  it("returns the merged recent-activity feed for a member", async () => {
    const reg = await request(app)
      .post("/auth/register")
      .send({ email: "activity@x.com", password: "password123", name: "A" });
    const token = reg.body.accessToken as string;
    const ws = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "WS" });
    const workspaceId = ws.body._id;

    await request(app)
      .post(`/workspaces/${workspaceId}/pages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Doc 1" });

    const res = await request(app)
      .get(`/workspaces/${workspaceId}/activity`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].type).toBe("page");
  });
});
