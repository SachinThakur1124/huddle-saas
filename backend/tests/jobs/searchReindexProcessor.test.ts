import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { searchReindexProcessor } from "../../src/jobs/searchReindexProcessor";
import { Page } from "../../src/models/Page";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("searchReindexProcessor", () => {
  it("touches updatedAt on the target page (stand-in for a real reindex step)", async () => {
    const page = await Page.create({
      workspaceId: new mongoose.Types.ObjectId(),
      title: "Doc",
      updatedAt: new Date(0),
    });

    await searchReindexProcessor({
      data: { entityType: "page", entityId: page._id.toString() },
    } as never);

    const updated = await Page.findById(page._id);
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(0);
  });
});
