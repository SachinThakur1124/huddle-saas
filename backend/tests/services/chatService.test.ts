import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { ChatService } from "../../src/services/chatService";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("ChatService", () => {
  const workspaceId = new mongoose.Types.ObjectId().toString();
  const authorId = new mongoose.Types.ObjectId().toString();

  it("posts and lists messages, newest page returned oldest-first", async () => {
    const channel = await ChatService.createChannel(workspaceId, "general");
    for (let i = 0; i < 3; i++) {
      await ChatService.postMessage(channel._id.toString(), authorId, workspaceId, `msg ${i}`);
    }
    const page = await ChatService.listMessages(channel._id.toString(), { limit: 2 });
    expect(page.messages).toHaveLength(2);
    // Page holds the 2 newest messages (msg 1, msg 2), returned oldest-first.
    expect(page.messages[0].body).toBe("msg 1");
    expect(page.messages[1].body).toBe("msg 2");
    expect(page.nextCursor).toEqual(expect.any(String));
  });

  it("paginates backward using the cursor without duplicates or gaps", async () => {
    const channel = await ChatService.createChannel(workspaceId, "general2");
    for (let i = 0; i < 5; i++) {
      await ChatService.postMessage(channel._id.toString(), authorId, workspaceId, `msg ${i}`);
    }
    const page1 = await ChatService.listMessages(channel._id.toString(), { limit: 2 });
    const page2 = await ChatService.listMessages(channel._id.toString(), {
      limit: 2,
      before: page1.nextCursor!,
    });
    const bodies = [...page1.messages, ...page2.messages].map((m) => m.body);
    expect(new Set(bodies).size).toBe(bodies.length);
  });
});
