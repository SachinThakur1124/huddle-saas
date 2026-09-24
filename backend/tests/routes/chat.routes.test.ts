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
