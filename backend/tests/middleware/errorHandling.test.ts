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
    .send({ email: "e2e@x.com", password: "password123", name: "E" });
  const token = reg.body.accessToken as string;
  const ws = await request(app)
    .post("/workspaces")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "WS" });
  return { token, workspaceId: ws.body._id as string };
}

describe("async errors are mapped to real HTTP responses, not crashes", () => {
  it("returns 400 (not a hang or 500) for a malformed page id", async () => {
    const { token, workspaceId } = await setupWorkspace();
    const res = await request(app)
      .get(`/workspaces/${workspaceId}/pages/not-an-id`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed workspaceId in the URL", async () => {
    const { token } = await setupWorkspace();
    const res = await request(app)
      .get(`/workspaces/not-an-id/pages`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("returns 404 (not a hang) when moving a card that does not exist", async () => {
    const { token, workspaceId } = await setupWorkspace();
    const res = await request(app)
      .post(`/workspaces/${workspaceId}/boards/cards/${"0".repeat(24)}/move`)
      .set("Authorization", `Bearer ${token}`)
      .send({ toListId: "0".repeat(24), toPosition: 0 });
    expect(res.status).toBe(404);
  });

  it("returns a 4xx (not 500) for malformed JSON in the request body", async () => {
    const res = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send("{not valid json");
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
