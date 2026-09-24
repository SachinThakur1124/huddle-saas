import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { BoardService } from "../../src/services/boardService";
import { Card } from "../../src/models/Card";
import { HttpError } from "../../src/lib/httpError";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("BoardService", () => {
  const workspaceId = new mongoose.Types.ObjectId().toString();
  const actorId = new mongoose.Types.ObjectId().toString();

  async function setupBoard() {
    const board = await BoardService.createBoard(workspaceId, actorId, "Sprint");
    const listA = await BoardService.createList(workspaceId, board._id.toString(), "Todo");
    const listB = await BoardService.createList(workspaceId, board._id.toString(), "Done");
    const card = await BoardService.createCard(workspaceId, actorId, listA._id.toString(), "Ship it");
    return { board, listA, listB, card };
  }

  it("creates a board with lists and cards", async () => {
    const { card } = await setupBoard();
    expect(card.title).toBe("Ship it");
  });

  it("getBoard returns the board with its lists and cards, scoped to the workspace", async () => {
    const { board } = await setupBoard();
    const result = await BoardService.getBoard(workspaceId, board._id.toString());
    expect(result?.lists).toHaveLength(2);
    expect(result?.cards).toHaveLength(1);
  });

  it("getBoard returns null for a board belonging to a different workspace", async () => {
    const { board } = await setupBoard();
    const otherWorkspace = new mongoose.Types.ObjectId().toString();
    const result = await BoardService.getBoard(otherWorkspace, board._id.toString());
    expect(result).toBeNull();
  });

  it("moves a card between lists with a valid, non-colliding position", async () => {
    const { listB, card } = await setupBoard();
    await BoardService.moveCard(workspaceId, actorId, card._id.toString(), listB._id.toString(), 0);
    const moved = await Card.findById(card._id);
    expect(moved!.listId.toString()).toBe(listB._id.toString());
    expect(moved!.position).toBe(0);
  });

  it("throws a 404 HttpError (not a generic Error) when moving a card that doesn't exist", async () => {
    const { listB } = await setupBoard();
    const fakeCardId = new mongoose.Types.ObjectId().toString();
    await expect(
      BoardService.moveCard(workspaceId, actorId, fakeCardId, listB._id.toString(), 0),
    ).rejects.toThrow(HttpError);
  });

  it("rejects moving a card into a list from a different workspace", async () => {
    const { card } = await setupBoard();
    const otherWorkspace = new mongoose.Types.ObjectId().toString();
    const otherBoard = await BoardService.createBoard(otherWorkspace, actorId, "Other");
    const otherList = await BoardService.createList(otherWorkspace, otherBoard._id.toString(), "X");
    await expect(
      BoardService.moveCard(workspaceId, actorId, card._id.toString(), otherList._id.toString(), 0),
    ).rejects.toThrow(HttpError);
  });

  it("keeps positions distinct under real concurrent creates into the same list", async () => {
    const { listA } = await setupBoard(); // listA already has 1 card at position 0
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        BoardService.createCard(workspaceId, actorId, listA._id.toString(), `Card ${i}`),
      ),
    );
    const cards = await Card.find({ listId: listA._id }).sort({ position: 1 });
    const positions = cards.map((c) => c.position);
    expect(new Set(positions).size).toBe(positions.length); // no duplicates
    expect(positions).toEqual([...positions].sort((a, b) => a - b)); // no gaps in ordering
  });

  it("keeps positions distinct under real concurrent moves into the same list", async () => {
    const { listA, listB, card } = await setupBoard();
    const card2 = await BoardService.createCard(workspaceId, actorId, listA._id.toString(), "Second");

    await Promise.all([
      BoardService.moveCard(workspaceId, actorId, card._id.toString(), listB._id.toString(), 0),
      BoardService.moveCard(workspaceId, actorId, card2._id.toString(), listB._id.toString(), 0),
    ]);

    const cards = await Card.find({ listId: listB._id }).sort({ position: 1 });
    const positions = cards.map((c) => c.position);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it("returns per-list card counts via aggregation, including empty lists", async () => {
    const { board } = await setupBoard();
    const stats = await BoardService.getStats(workspaceId, board._id.toString());
    expect(stats).toHaveLength(2); // listA (1 card) + listB (0 cards)
    expect(stats.reduce((sum, s) => sum + s.count, 0)).toBe(1);
  });
});
