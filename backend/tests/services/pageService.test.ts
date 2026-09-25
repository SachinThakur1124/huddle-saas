import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { PageService } from "../../src/services/pageService";
import { Page } from "../../src/models/Page";
import { searchReindexQueue } from "../../src/jobs/queues";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("PageService", () => {
  const workspaceId = new mongoose.Types.ObjectId().toString();
  const actorId = new mongoose.Types.ObjectId().toString();

  it("creates and fetches a page", async () => {
    const page = await PageService.create(workspaceId, actorId, {
      title: "Roadmap",
      contentJson: { blocks: [] },
    });
    const fetched = await PageService.get(workspaceId, page._id.toString());
    expect(fetched?.title).toBe("Roadmap");
  });

  it("rejects fetching a page from a different workspace", async () => {
    const page = await PageService.create(workspaceId, actorId, { title: "X" });
    const otherWorkspace = new mongoose.Types.ObjectId().toString();
    const fetched = await PageService.get(otherWorkspace, page._id.toString());
    expect(fetched).toBeNull();
  });

  it("cascade-deletes child pages inside a transaction", async () => {
    const parent = await PageService.create(workspaceId, actorId, { title: "Parent" });
    const child = await PageService.create(workspaceId, actorId, {
      title: "Child",
      parentId: parent._id.toString(),
    });

    await PageService.delete(workspaceId, actorId, parent._id.toString());

    const remaining = await Page.find({ workspaceId });
    expect(remaining).toHaveLength(0);
    expect(await Page.findById(child._id)).toBeNull();
  });

  it("updates a page's title/content and returns null for a page in another workspace", async () => {
    const page = await PageService.create(workspaceId, actorId, { title: "Draft" });

    const updated = await PageService.update(workspaceId, actorId, page._id.toString(), {
      title: "Final",
    });
    expect(updated?.title).toBe("Final");

    const otherWorkspace = new mongoose.Types.ObjectId().toString();
    const result = await PageService.update(otherWorkspace, actorId, page._id.toString(), {
      title: "Hijacked",
    });
    expect(result).toBeNull();
  });

  it("enqueues a real search-reindex job on update, which bumps updatedAt", async () => {
    const page = await Page.create({ workspaceId, title: "Doc", updatedAt: new Date(0) });

    await PageService.update(workspaceId, actorId, page._id.toString(), { title: "Doc v2" });

    const waiting = await searchReindexQueue.getJobs(["waiting", "completed", "active"]);
    const job = waiting.find((j) => j.data.entityId === page._id.toString());
    expect(job).toBeDefined();
    expect(job!.data.entityType).toBe("page");
  });

  it("rejects a page from setting itself as its own parent", async () => {
    const page = await PageService.create(workspaceId, actorId, { title: "Self" });
    await expect(
      PageService.update(workspaceId, actorId, page._id.toString(), { parentId: page._id.toString() }),
    ).rejects.toThrow("A page cannot be its own parent");
  });

  it("rejects setting a parent to one of the page's own descendants", async () => {
    const grandparent = await PageService.create(workspaceId, actorId, { title: "GP" });
    const parent = await PageService.create(workspaceId, actorId, {
      title: "P",
      parentId: grandparent._id.toString(),
    });
    // Trying to make the grandparent a child of its own grandchild's branch
    await expect(
      PageService.update(workspaceId, actorId, grandparent._id.toString(), {
        parentId: parent._id.toString(),
      }),
    ).rejects.toThrow("Cannot set parent to one of this page's own descendants");
  });

  it("rejects an update with a parentId that doesn't exist", async () => {
    const page = await PageService.create(workspaceId, actorId, { title: "Orphan-to-be" });
    const fakeParentId = new mongoose.Types.ObjectId().toString();
    await expect(
      PageService.update(workspaceId, actorId, page._id.toString(), { parentId: fakeParentId }),
    ).rejects.toThrow("Invalid parentId");
  });
});
