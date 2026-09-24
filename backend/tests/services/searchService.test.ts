import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { SearchService } from "../../src/services/searchService";
import { Page } from "../../src/models/Page";
import { Card } from "../../src/models/Card";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("SearchService", () => {
  it("finds matches across pages and cards, scoped to the workspace", async () => {
    const workspaceId = new mongoose.Types.ObjectId();
    const otherWorkspaceId = new mongoose.Types.ObjectId();
    await Page.create({ workspaceId, title: "Rocket launch plan" });
    await Card.create({
      workspaceId,
      listId: new mongoose.Types.ObjectId(),
      title: "Fix rocket engine bug",
      position: 0,
    });
    await Page.create({ workspaceId: otherWorkspaceId, title: "Rocket secrets" });

    const results = await SearchService.search(workspaceId.toString(), "rocket");
    expect(results.length).toBe(2);
    expect(results.every((r) => r.workspaceId === workspaceId.toString())).toBe(true);
  });
});
