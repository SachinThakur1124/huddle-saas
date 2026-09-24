import mongoose from "mongoose";
import { Board } from "../models/Board";
import { List } from "../models/List";
import { Card } from "../models/Card";
import { withTransaction } from "../lib/withTransaction";
import { AuditService } from "./auditService";

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

  async createList(boardId: string, title: string) {
    const count = await List.countDocuments({ boardId });
    return List.create({ boardId, title, position: count });
  },

  async createCard(listId: string, actorId: string, workspaceId: string, title: string) {
    const count = await Card.countDocuments({ listId });
    const card = await Card.create({ listId, workspaceId, title, position: count });
    await AuditService.record({
      actorId,
      workspaceId,
      action: "card.created",
      targetType: "Card",
      targetId: card._id,
    });
    return card;
  },

  /**
   * Moves a card to (toListId, toPosition) and shifts every sibling at or
   * after that position up by one, inside a single transaction, so two
   * concurrent moves into the same slot can never leave two cards with the
   * same position or a gap.
   */
  async moveCard(
    workspaceId: string,
    actorId: string,
    cardId: string,
    toListId: string,
    toPosition: number,
  ) {
    await withTransaction(async (session) => {
      const card = await Card.findById(cardId).session(session);
      if (!card) throw new Error("Card not found");

      const targetList = await List.exists({ _id: toListId }).session(session);
      if (!targetList) throw new Error("Target list not found");

      await Card.updateMany(
        { listId: toListId, position: { $gte: toPosition } },
        { $inc: { position: 1 } },
        { session },
      );

      card.listId = new mongoose.Types.ObjectId(toListId);
      card.position = toPosition;
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

  async getStats(boardId: string) {
    const lists = await List.find({ boardId }, { _id: 1 });
    const listIds = lists.map((l) => l._id);
    const result = await Card.aggregate([
      { $match: { listId: { $in: listIds } } },
      { $group: { _id: "$listId", count: { $sum: 1 } } },
    ]);
    return result.map((r) => ({ listId: r._id.toString(), count: r.count as number }));
  },
};
