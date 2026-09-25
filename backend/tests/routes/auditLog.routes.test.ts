import request from "supertest";
import { createApp } from "../../src/app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";

const app = createApp();

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("GET /workspaces/:workspaceId/audit-log", () => {
  async function setupWorkspace() {
    const reg = await request(app)
      .post("/auth/register")
      .send({ email: "audit@x.com", password: "password123", name: "A" });
    const token = reg.body.accessToken as string;
    const ws = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "WS" });
    return { token, workspaceId: ws.body._id as string };
  }

  it("returns audit entries recorded by actions in this workspace, newest first", async () => {
    const { token, workspaceId } = await setupWorkspace();

    await request(app)
      .post(`/workspaces/${workspaceId}/pages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Doc 1" });
    await request(app)
      .post(`/workspaces/${workspaceId}/boards`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Board 1" });

    const res = await request(app)
      .get(`/workspaces/${workspaceId}/audit-log`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0].action).toBe("board.created"); // most recent first
    expect(res.body.some((e: { action: string }) => e.action === "page.created")).toBe(true);
  });

  it("denies a member below admin from reading the audit log", async () => {
    const { token, workspaceId } = await setupWorkspace();
    const memberReg = await request(app)
      .post("/auth/register")
      .send({ email: "member-audit@x.com", password: "password123", name: "M" });
    await request(app)
      .post(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${token}`)
      .send({ userId: memberReg.body.user.id, role: "member" });

    await request(app)
      .get(`/workspaces/${workspaceId}/audit-log`)
      .set("Authorization", `Bearer ${memberReg.body.accessToken}`)
      .expect(403);
  });

  it("rejects a non-numeric or non-positive page instead of crashing", async () => {
    const { token, workspaceId } = await setupWorkspace();

    await request(app)
      .get(`/workspaces/${workspaceId}/audit-log?page=abc`)
      .set("Authorization", `Bearer ${token}`)
      .expect(400);

    await request(app)
      .get(`/workspaces/${workspaceId}/audit-log?page=0`)
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
  });
});
