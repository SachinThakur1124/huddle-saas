import "fake-indexeddb/auto";
import { enqueue, flushQueue } from "../src/app/offlineQueue";

describe("offlineQueue", () => {
  it("flushes each queued item exactly once and clears the queue", async () => {
    await enqueue({ id: "1", workspaceId: "w1", channelId: "c1", body: "hello" });
    await enqueue({ id: "2", workspaceId: "w1", channelId: "c1", body: "world" });

    const sent: string[] = [];
    await flushQueue(async (m) => {
      sent.push(m.body);
    });

    expect(sent).toEqual(["hello", "world"]);

    const sentAgain: string[] = [];
    await flushQueue(async (m) => {
      sentAgain.push(m.body);
    });
    expect(sentAgain).toEqual([]);
  });
});
