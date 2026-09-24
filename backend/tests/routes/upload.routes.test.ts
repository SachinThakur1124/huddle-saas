import request from "supertest";
import { createApp } from "../../src/app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";

const app = createApp();

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

let counter = 0;

async function setupWorkspace() {
  const email = `u${counter++}@x.com`;
  const reg = await request(app)
    .post("/auth/register")
    .send({ email, password: "password123", name: "U" });
  const token = reg.body.accessToken as string;
  const ws = await request(app)
    .post("/workspaces")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "WS" });
  return { token, workspaceId: ws.body._id as string };
}

describe("upload routes", () => {
  it("accepts a small png upload", async () => {
    const { token, workspaceId } = await setupWorkspace();
    const res = await request(app)
      .post(`/workspaces/${workspaceId}/uploads`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: "test.png",
        contentType: "image/png",
      })
      .expect(201);
    expect(res.body.mimeType).toBe("image/png");
  });

  it("rejects a disallowed file type with 400", async () => {
    const { token, workspaceId } = await setupWorkspace();
    await request(app)
      .post(`/workspaces/${workspaceId}/uploads`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("#!/bin/sh\necho hi"), {
        filename: "script.sh",
        contentType: "application/x-sh",
      })
      .expect(400);
  });

  it("rejects a file over the 5MB limit with 400/413, not a crash", async () => {
    const { token, workspaceId } = await setupWorkspace();
    const big = Buffer.alloc(6 * 1024 * 1024, 1);
    const res = await request(app)
      .post(`/workspaces/${workspaceId}/uploads`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", big, { filename: "big.png", contentType: "image/png" });
    expect([400, 413]).toContain(res.status);
  });

  it("serves the uploaded file back to an authenticated member of the workspace", async () => {
    const { token, workspaceId } = await setupWorkspace();
    const uploaded = await request(app)
      .post(`/workspaces/${workspaceId}/uploads`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: "test.png",
        contentType: "image/png",
      });

    const res = await request(app)
      .get(uploaded.body.url)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.headers["content-type"]).toBe("image/png");
  });

  it("rejects fetching the file with no auth token", async () => {
    const { token, workspaceId } = await setupWorkspace();
    const uploaded = await request(app)
      .post(`/workspaces/${workspaceId}/uploads`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: "test.png",
        contentType: "image/png",
      });

    await request(app).get(uploaded.body.url).expect(401);
  });

  it("rejects a member of workspace A fetching workspace B's attachment via A's URL (IDOR)", async () => {
    const wsB = await setupWorkspace();
    const uploaded = await request(app)
      .post(`/workspaces/${wsB.workspaceId}/uploads`)
      .set("Authorization", `Bearer ${wsB.token}`)
      .attach("file", Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: "test.png",
        contentType: "image/png",
      });
    const attachmentId = uploaded.body.id as string;

    const wsA = await setupWorkspace();
    await request(app)
      .get(`/workspaces/${wsA.workspaceId}/uploads/${attachmentId}`)
      .set("Authorization", `Bearer ${wsA.token}`)
      .expect(404);
  });
});
