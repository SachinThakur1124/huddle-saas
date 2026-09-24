import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { PageService } from "../../src/services/pageService";
import { Page } from "../../src/models/Page";

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
});
