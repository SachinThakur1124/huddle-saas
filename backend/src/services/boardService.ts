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
   * Moves a card to (toListId, toPosition), keeping positions DENSE
   * (0..n-1, no gaps) in both the source and target list — the frontend's
   * drag-and-drop sends a visual index, which only lands in the right slot
   * if positions never drift from that invariant. The algorithm:
   *   1. Close the gap in the source list (decrement everyone after the
   *      card's old position).
   *   2. Open a slot in the target list at the clamped position (increment
   *      everyone at or after it, excluding the card itself).
   *   3. Write the card's new listId/position.
   * Steps 1 and 2 both correctly apply when fromList === toList, since
   * they run sequentially inside one transaction against the same
   * collection. Both the target (and source, if different) List documents
   * are bumped first purely to force a real write conflict between two
   * transactions racing to restructure the same list.
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

      const fromListId = card.listId.toString();
      const fromPosition = card.position;

      if (fromListId !== toListId) {
        await List.updateOne({ _id: fromListId }, { $inc: { version: 1 } }, { session });
      }

      const targetCountExcludingSelf = await Card.countDocuments(
        { listId: toListId, _id: { $ne: card._id } },
        { session },
      );
      const clampedPosition = Math.max(0, Math.min(toPosition, targetCountExcludingSelf));

      await Card.updateMany(
        { listId: fromListId, position: { $gt: fromPosition } },
        { $inc: { position: -1 } },
        { session },
      );

      await Card.updateMany(
        {
          listId: toListId,
          _id: { $ne: card._id },
          position: { $gte: clampedPosition },
        },
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
