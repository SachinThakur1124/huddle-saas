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

  it("rejects an invalid limit or before cursor instead of crashing", async () => {
    const reg = await request(app)
      .post("/auth/register")
      .send({ email: "c-badquery@x.com", password: "password123", name: "C" });
    const token = reg.body.accessToken as string;
    const ws = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "WS" });
    const channel = await request(app)
      .post(`/workspaces/${ws.body._id}/channels`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "general" });

    await request(app)
      .get(`/workspaces/${ws.body._id}/channels/${channel.body._id}/messages?limit=not-a-number`)
      .set("Authorization", `Bearer ${token}`)
      .expect(400);

    await request(app)
      .get(`/workspaces/${ws.body._id}/channels/${channel.body._id}/messages?before=not-an-id`)
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
  });

  it("deletes a channel and cascade-deletes its messages (admin+ only)", async () => {
    const reg = await request(app)
      .post("/auth/register")
      .send({ email: "delchannel@x.com", password: "password123", name: "D" });
    const token = reg.body.accessToken as string;
    const ws = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "WS" });
    const channel = await request(app)
      .post(`/workspaces/${ws.body._id}/channels`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "general" });
    await request(app)
      .post(`/workspaces/${ws.body._id}/channels/${channel.body._id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "hello" });

    const member = await request(app)
      .post("/auth/register")
      .send({ email: "delchannel-member@x.com", password: "password123", name: "M" });
    await request(app)
      .post(`/workspaces/${ws.body._id}/members`)
      .set("Authorization", `Bearer ${token}`)
      .send({ userId: member.body.user.id, role: "member" });

    await request(app)
      .delete(`/workspaces/${ws.body._id}/channels/${channel.body._id}`)
      .set("Authorization", `Bearer ${member.body.accessToken}`)
      .expect(403);

    await request(app)
      .delete(`/workspaces/${ws.body._id}/channels/${channel.body._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    await request(app)
      .get(`/workspaces/${ws.body._id}/channels/${channel.body._id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .expect(404); // channel itself is gone, not just emptied
  });

  it("rejects a member of workspace A reading/posting to workspace B's channel via A's URL (IDOR)", async () => {
    const regA = await request(app)
      .post("/auth/register")
      .send({ email: "alice2@x.com", password: "password123", name: "Alice" });
    const tokenA = regA.body.accessToken as string;
    const wsA = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "WS A" });

    const regB = await request(app)
      .post("/auth/register")
      .send({ email: "bob2@x.com", password: "password123", name: "Bob" });
    const tokenB = regB.body.accessToken as string;
    const wsB = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "WS B" });

    const channelB = await request(app)
      .post(`/workspaces/${wsB.body._id}/channels`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "secret" });
    await request(app)
      .post(`/workspaces/${wsB.body._id}/channels/${channelB.body._id}/messages`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ body: "B's private message" });

    await request(app)
      .get(`/workspaces/${wsA.body._id}/channels/${channelB.body._id}/messages`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(404);

    await request(app)
      .post(`/workspaces/${wsA.body._id}/channels/${channelB.body._id}/messages`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ body: "injected by alice" })
      .expect(404);
  });
});
