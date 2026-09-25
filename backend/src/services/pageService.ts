import { Page } from "../models/Page";
import { withTransaction } from "../lib/withTransaction";
import { AuditService } from "./auditService";
import { HttpError } from "../lib/httpError";
import { searchReindexQueue } from "../jobs/queues";

interface CreateInput {
  title: string;
  contentJson?: unknown;
  parentId?: string | null;
}

export const PageService = {
  async create(workspaceId: string, actorId: string, input: CreateInput) {
    if (input.parentId) {
      const parentExists = await Page.exists({ _id: input.parentId, workspaceId });
      if (!parentExists) throw new HttpError(400, "Invalid parentId");
    }
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
    if (patch.parentId) {
      if (patch.parentId === pageId) {
        throw new HttpError(400, "A page cannot be its own parent");
      }
      let cursor: string | null = patch.parentId;
      const guard = new Set<string>();
      while (cursor) {
        if (cursor === pageId) {
          throw new HttpError(400, "Cannot set parent to one of this page's own descendants");
        }
        if (guard.has(cursor)) break; // defensive: pre-existing bad data, stop walking
        guard.add(cursor);
        const parent: { parentId?: import("mongoose").Types.ObjectId | null } | null =
          await Page.findOne({ _id: cursor, workspaceId }, { parentId: 1 });
        if (!parent) throw new HttpError(400, "Invalid parentId");
        cursor = parent.parentId ? parent.parentId.toString() : null;
      }
    }
    const page = await Page.findOneAndUpdate({ _id: pageId, workspaceId }, patch, { new: true });
    if (page) {
      await AuditService.record({
        actorId,
        workspaceId,
        action: "page.updated",
        targetType: "Page",
        targetId: page._id,
      });
      // Bumping `updatedAt` is offloaded to the reindex worker rather than
      // done inline here, so a burst of rapid edits (e.g. autosave on every
      // keystroke) doesn't add a synchronous write to the request path for
      // every one of them — the queue absorbs the burst instead.
      await searchReindexQueue.add("reindex", {
        entityType: "page",
        entityId: page._id.toString(),
      });
    }
    return page;
  },

  async delete(workspaceId: string, actorId: string, pageId: string) {
    await withTransaction(async (session) => {
      // Scope the root to this workspace explicitly — without this, a
      // valid-looking pageId belonging to a DIFFERENT workspace would still
      // be deleted, since the cascade below only scopes the *children* it
      // discovers, not the root itself.
      const root = await Page.findOne({ _id: pageId, workspaceId }, { _id: 1 }, { session });
      if (!root) return;

      const ids = [root._id];
      const visited = new Set([root._id.toString()]);
      let frontier = ids;
      while (frontier.length > 0) {
        const children = await Page.find(
          { workspaceId, parentId: { $in: frontier } },
          { _id: 1 },
          { session },
        );
        const newChildIds = children
          .map((c) => c._id)
          .filter((id) => !visited.has(id.toString()));
        newChildIds.forEach((id) => visited.add(id.toString()));
        ids.push(...newChildIds);
        frontier = newChildIds;
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
