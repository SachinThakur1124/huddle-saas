import { Types } from "mongoose";
import { Page } from "../models/Page";
import { withTransaction } from "../lib/withTransaction";
import { AuditService } from "./auditService";

interface CreateInput {
  title: string;
  contentJson?: unknown;
  parentId?: string | null;
}

export const PageService = {
  async create(workspaceId: string, actorId: string, input: CreateInput) {
    const page = await Page.create({
      workspaceId,
      parentId: input.parentId ?? null,
      title: input.title,
      contentJson: input.contentJson ?? {},
    });
    await AuditService.record({
      actorId,
      workspaceId,
      action: "page.created",
      targetType: "Page",
      targetId: page._id,
    });
    return page;
  },

  async get(workspaceId: string, pageId: string) {
    return Page.findOne({ _id: pageId, workspaceId });
  },

  async listForWorkspace(workspaceId: string) {
    return Page.find({ workspaceId }).sort({ createdAt: 1 });
  },

  async update(workspaceId: string, actorId: string, pageId: string, patch: Partial<CreateInput>) {
    const page = await Page.findOneAndUpdate(
      { _id: pageId, workspaceId },
      { ...patch, updatedAt: new Date() },
      { new: true },
    );
    if (page) {
      await AuditService.record({
        actorId,
        workspaceId,
        action: "page.updated",
        targetType: "Page",
        targetId: page._id,
      });
    }
    return page;
  },

  async delete(workspaceId: string, actorId: string, pageId: string) {
    await withTransaction(async (session) => {
      const ids: Types.ObjectId[] = [new Types.ObjectId(pageId)];
      let frontier = ids;
      while (frontier.length > 0) {
        const children = await Page.find(
          { workspaceId, parentId: { $in: frontier } },
          { _id: 1 },
          { session },
        );
        const childIds = children.map((c) => c._id);
        ids.push(...childIds);
        frontier = childIds;
      }
      await Page.deleteMany({ _id: { $in: ids } }, { session });
      await AuditService.record({
        actorId,
        workspaceId,
        action: "page.deleted",
        targetType: "Page",
        targetId: pageId,
        session,
      });
    });
  },
};
