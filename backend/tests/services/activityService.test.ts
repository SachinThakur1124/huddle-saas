import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { ActivityService } from "../../src/services/activityService";
import { Page } from "../../src/models/Page";
import { Card } from "../../src/models/Card";
import { Message } from "../../src/models/Message";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("ActivityService.getRecent", () => {
  it("merges recent pages, cards, and messages into one feed, newest first, scoped to the workspace", async () => {
    const workspaceId = new mongoose.Types.ObjectId();
    const otherWorkspaceId = new mongoose.Types.ObjectId();
    const base = Date.now();

    const page = await Page.create({
      workspaceId,
      title: "Old page",
      createdAt: new Date(base - 3000),
    });
    const card = await Card.create({
      workspaceId,
      listId: new mongoose.Types.ObjectId(),
      title: "Newer card",
      position: 0,
      createdAt: new Date(base - 2000),
    });
    const message = await Message.create({
      workspaceId,
      channelId: new mongoose.Types.ObjectId(),
      authorId: new mongoose.Types.ObjectId(),
      body: "Newest message",
      createdAt: new Date(base - 1000),
    });
    await Page.create({ workspaceId: otherWorkspaceId, title: "Someone else's page" });

    const feed = await ActivityService.getRecent(workspaceId.toString());

    expect(feed).toHaveLength(3);
    expect(feed.map((f) => f.type)).toEqual(["message", "card", "page"]); // newest first
    expect(feed[0].id).toBe(message._id.toString());
    expect(feed[1].id).toBe(card._id.toString());
    expect(feed[2].id).toBe(page._id.toString());
    expect(feed.every((f) => f.workspaceId === workspaceId.toString())).toBe(true);
  });

  it("caps the feed at the requested limit", async () => {
    const workspaceId = new mongoose.Types.ObjectId();
    for (let i = 0; i < 5; i++) {
      await Page.create({ workspaceId, title: `Page ${i}` });
    }
    const feed = await ActivityService.getRecent(workspaceId.toString(), 3);
    expect(feed).toHaveLength(3);
  });
});
