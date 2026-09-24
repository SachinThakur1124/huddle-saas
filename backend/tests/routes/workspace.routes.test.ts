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
});
