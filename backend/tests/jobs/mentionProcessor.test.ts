import mongoose from "mongoose";
import argon2 from "argon2";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { extractMentions, mentionProcessor } from "../../src/jobs/mentionProcessor";
import { User } from "../../src/models/User";
import { Membership } from "../../src/models/Membership";
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

  it("handles dotted local parts (e.g. john.doe)", () => {
    expect(extractMentions("cc @john.doe")).toEqual(["john.doe"]);
  });
});

async function createUser(email: string) {
  return User.create({ email, name: email.split("@")[0], passwordHash: await argon2.hash("password123") });
}

describe("mentionProcessor", () => {
  it("creates a Notification for a mentioned user who is a member of the workspace", async () => {
    const workspaceId = new mongoose.Types.ObjectId().toString();
    const mentioned = await createUser("ada@x.com");
    await Membership.create({ userId: mentioned._id, workspaceId, role: "member" });

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

  it("does NOT notify a matching user who exists but is not a member of this workspace", async () => {
    const workspaceId = new mongoose.Types.ObjectId().toString();
    const outsider = await createUser("ada@x.com"); // exists system-wide, never joined this workspace

    await mentionProcessor({
      data: {
        body: "hey @ada!",
        authorId: new mongoose.Types.ObjectId().toString(),
        workspaceId,
        messageId: new mongoose.Types.ObjectId().toString(),
      },
    } as never);

    const notifications = await Notification.find({ userId: outsider._id });
    expect(notifications).toHaveLength(0);
  });
});
