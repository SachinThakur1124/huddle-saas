import mongoose from "mongoose";
import { Board } from "../models/Board";
import { List } from "../models/List";
import { Card } from "../models/Card";
import { withTransaction } from "../lib/withTransaction";
import { AuditService } from "./auditService";
import { HttpError } from "../lib/httpError";

export const BoardService = {
  async createBoard(workspaceId: string, actorId: string, title: string) {
    const board = await Board.create({ workspaceId, title });
    await AuditService.record({
      actorId,
      workspaceId,
      action: "board.created",
      targetType: "Board",
      targetId: board._id,
    });
    return board;
  },

  async listBoards(workspaceId: string) {
    return Board.find({ workspaceId }).sort({ createdAt: 1 });
  },

  async getBoard(workspaceId: string, boardId: string) {
    const board = await Board.findOne({ _id: boardId, workspaceId });
    if (!board) return null;
    const lists = await List.find({ boardId, workspaceId }).sort({ position: 1 });
    const cards = await Card.find({
      listId: { $in: lists.map((l) => l._id) },
      workspaceId,
    }).sort({ position: 1 });
    return { board, lists, cards };
  },

  async createList(workspaceId: string, boardId: string, title: string) {
    const board = await Board.exists({ _id: boardId, workspaceId });
    if (!board) throw new HttpError(404, "Board not found");
    const count = await List.countDocuments({ boardId });
    return List.create({ boardId, workspaceId, title, position: count });
  },

  async createCard(workspaceId: string, actorId: string, listId: string, title: string) {
    return withTransaction(async (session) => {
      // Also serializes concurrent creates against the same list (see
      // List.version) so two racing creates can't both compute the same
      // "next position" from a stale read.
      const list = await List.findOneAndUpdate(
        { _id: listId, workspaceId },
        { $inc: { version: 1 } },
        { session, new: true },
      );
      if (!list) throw new HttpError(404, "List not found");

      const last = await Card.findOne({ listId }, { position: 1 }, { session }).sort({
        position: -1,
      });
      const nextPosition = last ? last.position + 1 : 0;

      const [card] = await Card.create(
        [{ listId, workspaceId, title, position: nextPosition }],
        { session },
      );
      await AuditService.record({
        actorId,
        workspaceId,
        action: "card.created",
        targetType: "Card",
        targetId: card._id,
        session,
      });
      return card;
    });
  },

  /**
   * Moves a card to (toListId, toPosition) and shifts every sibling at or
   * after that position up by one, inside a single transaction. The target
   * list document is written first (version bump) purely to force a real
   * write conflict between two transactions racing to move different
   * cards into the same list — without it, two moves that don't happen to
   * overlap an existing sibling's position can commit independently and
   * leave duplicate positions.
   */
  async moveCard(
    workspaceId: string,
    actorId: string,
    cardId: string,
    toListId: string,
    toPosition: number,
  ) {
    await withTransaction(async (session) => {
      const card = await Card.findOne({ _id: cardId, workspaceId }).session(session);
      if (!card) throw new HttpError(404, "Card not found");

      const targetList = await List.findOneAndUpdate(
        { _id: toListId, workspaceId },
        { $inc: { version: 1 } },
        { session, new: true },
      );
      if (!targetList) throw new HttpError(404, "Target list not found");

      const siblingCount = await Card.countDocuments({ listId: toListId }, { session });
      const clampedPosition = Math.max(0, Math.min(toPosition, siblingCount));

      await Card.updateMany(
        { listId: toListId, position: { $gte: clampedPosition } },
        { $inc: { position: 1 } },
        { session },
      );

      card.listId = new mongoose.Types.ObjectId(toListId);
      card.position = clampedPosition;
      await card.save({ session });

      await AuditService.record({
        actorId,
        workspaceId,
        action: "card.moved",
        targetType: "Card",
        targetId: card._id,
        session,
      });
    });
  },

  async getStats(workspaceId: string, boardId: string) {
    const lists = await List.find({ boardId, workspaceId }, { _id: 1 });
    const listIds = lists.map((l) => l._id);
    const result = await Card.aggregate([
      { $match: { listId: { $in: listIds }, workspaceId: new mongoose.Types.ObjectId(workspaceId) } },
      { $group: { _id: "$listId", count: { $sum: 1 } } },
    ]);
    const counted = new Map(result.map((r) => [r._id.toString(), r.count as number]));
    return lists.map((l) => ({ listId: l._id.toString(), count: counted.get(l._id.toString()) ?? 0 }));
  },
};
