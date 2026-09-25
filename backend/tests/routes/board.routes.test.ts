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

  it("returns 404 (not 500) when moving a card that doesn't exist", async () => {
    const reg = await request(app)
      .post("/auth/register")
      .send({ email: "b2@x.com", password: "password123", name: "B2" });
    const token = reg.body.accessToken as string;
    const ws = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "WS" });

    await request(app)
      .post(`/workspaces/${ws.body._id}/boards/cards/${"0".repeat(24)}/move`)
      .set("Authorization", `Bearer ${token}`)
      .send({ toListId: "0".repeat(24), toPosition: 0 })
      .expect(404);
  });

  it("rejects a member of workspace A moving workspace B's card via A's URL (IDOR)", async () => {
    const regA = await request(app)
      .post("/auth/register")
      .send({ email: "alice@x.com", password: "password123", name: "Alice" });
    const tokenA = regA.body.accessToken as string;
    const wsA = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "WS A" });

    const regB = await request(app)
      .post("/auth/register")
      .send({ email: "bob@x.com", password: "password123", name: "Bob" });
    const tokenB = regB.body.accessToken as string;
    const wsB = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "WS B" });

    const boardB = await request(app)
      .post(`/workspaces/${wsB.body._id}/boards`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ title: "Board B" });
    const listB = await request(app)
      .post(`/workspaces/${wsB.body._id}/boards/${boardB.body._id}/lists`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ title: "List B" });
    const cardB = await request(app)
      .post(`/workspaces/${wsB.body._id}/boards/${boardB.body._id}/lists/${listB.body._id}/cards`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ title: "Card B" });

    // Alice is a member of WS A, not WS B. Using A's workspace URL with B's
    // card/list ids must not succeed.
    await request(app)
      .post(`/workspaces/${wsA.body._id}/boards/cards/${cardB.body._id}/move`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ toListId: listB.body._id, toPosition: 0 })
      .expect(404);

    const stillThere = await request(app)
      .get(`/workspaces/${wsB.body._id}/boards/${boardB.body._id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(stillThere.body.cards[0].listId).toBe(listB.body._id);
  });

  it("deletes a card and closes the position gap left in its list", async () => {
    const reg = await request(app)
      .post("/auth/register")
      .send({ email: "delcard@x.com", password: "password123", name: "D" });
    const token = reg.body.accessToken as string;
    const ws = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "WS" });
    const board = await request(app)
      .post(`/workspaces/${ws.body._id}/boards`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Board" });
    const list = await request(app)
      .post(`/workspaces/${ws.body._id}/boards/${board.body._id}/lists`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Todo" });

    const cards = [];
    for (const title of ["A", "B", "C"]) {
      cards.push(
        await request(app)
          .post(`/workspaces/${ws.body._id}/boards/${board.body._id}/lists/${list.body._id}/cards`)
          .set("Authorization", `Bearer ${token}`)
          .send({ title }),
      );
    }

    await request(app)
      .delete(`/workspaces/${ws.body._id}/boards/cards/${cards[1].body._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const boardState = await request(app)
      .get(`/workspaces/${ws.body._id}/boards/${board.body._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const remaining = boardState.body.cards.sort((a: { position: number }, b: { position: number }) => a.position - b.position);
    expect(remaining).toHaveLength(2);
    expect(remaining.map((c: { title: string }) => c.title)).toEqual(["A", "C"]);
    expect(remaining.map((c: { position: number }) => c.position)).toEqual([0, 1]);
  });

  it("deletes a list, cascade-deletes its cards, and closes the position gap among remaining lists", async () => {
    const reg = await request(app)
      .post("/auth/register")
      .send({ email: "dellist@x.com", password: "password123", name: "D" });
    const token = reg.body.accessToken as string;
    const ws = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "WS" });
    const board = await request(app)
      .post(`/workspaces/${ws.body._id}/boards`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Board" });

    const lists = [];
    for (const title of ["Todo", "Doing", "Done"]) {
      lists.push(
        await request(app)
          .post(`/workspaces/${ws.body._id}/boards/${board.body._id}/lists`)
          .set("Authorization", `Bearer ${token}`)
          .send({ title }),
      );
    }
    await request(app)
      .post(`/workspaces/${ws.body._id}/boards/${board.body._id}/lists/${lists[1].body._id}/cards`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "orphaned card" });

    await request(app)
      .delete(`/workspaces/${ws.body._id}/boards/${board.body._id}/lists/${lists[1].body._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const boardState = await request(app)
      .get(`/workspaces/${ws.body._id}/boards/${board.body._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(boardState.body.cards).toHaveLength(0); // cascade-deleted with the list
    const remaining = boardState.body.lists.sort((a: { position: number }, b: { position: number }) => a.position - b.position);
    expect(remaining.map((l: { title: string }) => l.title)).toEqual(["Todo", "Done"]);
    expect(remaining.map((l: { position: number }) => l.position)).toEqual([0, 1]);
  });

  it("deletes a board and cascade-deletes its lists and cards (admin+ only)", async () => {
    const reg = await request(app)
      .post("/auth/register")
      .send({ email: "delboard@x.com", password: "password123", name: "D" });
    const token = reg.body.accessToken as string;
    const ws = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "WS" });
    const board = await request(app)
      .post(`/workspaces/${ws.body._id}/boards`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Board" });

    const member = await request(app)
      .post("/auth/register")
      .send({ email: "delboard-member@x.com", password: "password123", name: "M" });
    await request(app)
      .post(`/workspaces/${ws.body._id}/members`)
      .set("Authorization", `Bearer ${token}`)
      .send({ userId: member.body.user.id, role: "member" });

    await request(app)
      .delete(`/workspaces/${ws.body._id}/boards/${board.body._id}`)
      .set("Authorization", `Bearer ${member.body.accessToken}`)
      .expect(403); // a plain member can't delete a board

    await request(app)
      .delete(`/workspaces/${ws.body._id}/boards/${board.body._id}`)
      .set("Authorization", `Bearer ${token}`) // owner
      .expect(204);

    await request(app)
      .get(`/workspaces/${ws.body._id}/boards/${board.body._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
  });

  it("rejects a member of workspace A deleting workspace B's card via A's URL (IDOR)", async () => {
    const regA = await request(app)
      .post("/auth/register")
      .send({ email: "idor-del-a@x.com", password: "password123", name: "A" });
    const tokenA = regA.body.accessToken as string;
    const wsA = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "WS A" });

    const regB = await request(app)
      .post("/auth/register")
      .send({ email: "idor-del-b@x.com", password: "password123", name: "B" });
    const tokenB = regB.body.accessToken as string;
    const wsB = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "WS B" });
    const boardB = await request(app)
      .post(`/workspaces/${wsB.body._id}/boards`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ title: "Board B" });
    const listB = await request(app)
      .post(`/workspaces/${wsB.body._id}/boards/${boardB.body._id}/lists`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ title: "List B" });
    const cardB = await request(app)
      .post(`/workspaces/${wsB.body._id}/boards/${boardB.body._id}/lists/${listB.body._id}/cards`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ title: "Card B" });

    await request(app)
      .delete(`/workspaces/${wsA.body._id}/boards/cards/${cardB.body._id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(404);
  });
});
