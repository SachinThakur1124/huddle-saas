import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { extractMentions, mentionProcessor } from "../../src/jobs/mentionProcessor";
import { User } from "../../src/models/User";
import { Notification } from "../../src/models/Notification";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("extractMentions", () => {
  it("extracts @handles from a message body", () => {
    expect(extractMentions("hey @ada and @grace, check this")).toEqual(["ada", "grace"]);
  });

  it("returns an empty array when there are no mentions", () => {
    expect(extractMentions("no mentions here")).toEqual([]);
  });
});

describe("mentionProcessor", () => {
  it("creates a Notification for each mentioned user that exists", async () => {
    const argon2 = await import("argon2");
    const mentioned = await User.create({
      email: "ada@x.com",
      name: "ada",
      passwordHash: await argon2.hash("password123"),
    });
    const workspaceId = new mongoose.Types.ObjectId().toString();

    await mentionProcessor({
      data: {
        body: "hey @ada!",
        authorId: new mongoose.Types.ObjectId().toString(),
        workspaceId,
        messageId: new mongoose.Types.ObjectId().toString(),
      },
    } as never);

    const notifications = await Notification.find({ userId: mentioned._id });
    expect(notifications).toHaveLength(1);
  });
});
