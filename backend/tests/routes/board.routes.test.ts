import request from "supertest";
import { createApp } from "../../src/app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";

const app = createApp();

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("board routes", () => {
  it("creates a board, list, card, and moves the card", async () => {
    const reg = await request(app)
      .post("/auth/register")
      .send({ email: "b@x.com", password: "password123", name: "B" });
    const token = reg.body.accessToken as string;
    const ws = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "WS" });
    const workspaceId = ws.body._id;

    const board = await request(app)
      .post(`/workspaces/${workspaceId}/boards`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Board 1" })
      .expect(201);

    const listA = await request(app)
      .post(`/workspaces/${workspaceId}/boards/${board.body._id}/lists`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Todo" })
      .expect(201);

    const listB = await request(app)
      .post(`/workspaces/${workspaceId}/boards/${board.body._id}/lists`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Done" })
      .expect(201);

    const card = await request(app)
      .post(`/workspaces/${workspaceId}/boards/${board.body._id}/lists/${listA.body._id}/cards`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Card 1" })
      .expect(201);

    await request(app)
      .post(`/workspaces/${workspaceId}/boards/cards/${card.body._id}/move`)
      .set("Authorization", `Bearer ${token}`)
      .send({ toListId: listB.body._id, toPosition: 0 })
      .expect(200);
  });
});
