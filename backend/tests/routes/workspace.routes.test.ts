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

  async function registerAndGetId(email: string) {
    const res = await request(app)
      .post("/auth/register")
      .send({ email, password: "password123", name: "T" });
    return { token: res.body.accessToken as string, userId: res.body.user.id as string };
  }

  it("prevents an admin from promoting themselves to owner or demoting the owner", async () => {
    const owner = await registerAndGetId("owner3@x.com");
    const admin = await registerAndGetId("admin3@x.com");

    const ws = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Co" });

    await request(app)
      .post(`/workspaces/${ws.body._id}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: admin.userId, role: "admin" })
      .expect(200);

    // Admin tries to promote itself to owner.
    await request(app)
      .post(`/workspaces/${ws.body._id}/members`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ userId: admin.userId, role: "owner" })
      .expect(403);

    // Admin tries to demote the real owner to viewer.
    await request(app)
      .post(`/workspaces/${ws.body._id}/members`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ userId: owner.userId, role: "viewer" })
      .expect(403);
  });

  it("prevents demoting the last owner of a workspace", async () => {
    const owner = await registerAndGetId("owner4@x.com");
    const ws = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Solo Co" });

    await request(app)
      .post(`/workspaces/${ws.body._id}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: owner.userId, role: "admin" })
      .expect(400);
  });

  it("lets an owner promote a member and an admin manage lower-ranked members", async () => {
    const owner = await registerAndGetId("owner5@x.com");
    const member = await registerAndGetId("member5@x.com");
    const ws = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Co5" });

    await request(app)
      .post(`/workspaces/${ws.body._id}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: member.userId, role: "admin" })
      .expect(200);

    const viewer = await registerAndGetId("viewer5@x.com");
    await request(app)
      .post(`/workspaces/${ws.body._id}/members`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ userId: viewer.userId, role: "member" })
      .expect(200);
  });
});
