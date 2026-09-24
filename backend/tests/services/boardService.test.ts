import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { BoardService } from "../../src/services/boardService";
import { Card } from "../../src/models/Card";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("BoardService", () => {
  const workspaceId = new mongoose.Types.ObjectId().toString();
  const actorId = new mongoose.Types.ObjectId().toString();

  async function setupBoard() {
    const board = await BoardService.createBoard(workspaceId, actorId, "Sprint");
    const listA = await BoardService.createList(board._id.toString(), "Todo");
    const listB = await BoardService.createList(board._id.toString(), "Done");
    const card = await BoardService.createCard(listA._id.toString(), actorId, workspaceId, "Ship it");
    return { board, listA, listB, card };
  }

  it("creates a board with lists and cards", async () => {
    const { card } = await setupBoard();
    expect(card.title).toBe("Ship it");
  });

  it("moves a card between lists with a valid, non-colliding position", async () => {
    const { listB, card } = await setupBoard();
    await BoardService.moveCard(workspaceId, actorId, card._id.toString(), listB._id.toString(), 0);
    const moved = await Card.findById(card._id);
    expect(moved!.listId.toString()).toBe(listB._id.toString());
    expect(moved!.position).toBe(0);
  });

  it("keeps positions distinct when two cards land in the same list back-to-back", async () => {
    const { listA, listB, card } = await setupBoard();
    const card2 = await BoardService.createCard(listA._id.toString(), actorId, workspaceId, "Second");
    await BoardService.moveCard(workspaceId, actorId, card._id.toString(), listB._id.toString(), 0);
    await BoardService.moveCard(workspaceId, actorId, card2._id.toString(), listB._id.toString(), 0);
    const cards = await Card.find({ listId: listB._id }).sort({ position: 1 });
    expect(cards.map((c) => c.position)).toEqual([...new Set(cards.map((c) => c.position))]);
  });

  it("returns per-list card counts via aggregation", async () => {
    const { board } = await setupBoard();
    const stats = await BoardService.getStats(board._id.toString());
    expect(stats.reduce((sum, s) => sum + s.count, 0)).toBe(1);
  });
});
