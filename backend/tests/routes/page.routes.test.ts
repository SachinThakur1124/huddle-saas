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
