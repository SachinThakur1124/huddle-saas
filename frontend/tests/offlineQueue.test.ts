import "fake-indexeddb/auto";
import { enqueue, flushQueue, queueSize, QueuedAction } from "../src/app/offlineQueue";

type Extract_<K extends QueuedAction["kind"]> = Extract<QueuedAction, { kind: K }>;

describe("offlineQueue", () => {
  it("flushes each queued item exactly once, in order, and clears the queue", async () => {
    await enqueue({ id: "1", kind: "message", workspaceId: "w1", channelId: "c1", body: "hello" });
    await enqueue({ id: "2", kind: "message", workspaceId: "w1", channelId: "c1", body: "world" });

    const sent: string[] = [];
    await flushQueue({
      message: async (a: Extract_<"message">) => {
        sent.push(a.body);
      },
    } as never);

    expect(sent).toEqual(["hello", "world"]);
    expect(await queueSize()).toBe(0);

    const sentAgain: string[] = [];
    await flushQueue({ message: async (a: Extract_<"message">) => sentAgain.push(a.body) } as never);
    expect(sentAgain).toEqual([]);
  });

  it("dispatches each queued action to the handler matching its kind", async () => {
    // IDB's getAll() returns records in ascending key order, not insertion
    // order — ids must sort the way they were created for flushQueue's
    // "in order" guarantee to hold, exactly as newActionId()'s
    // Date.now()-prefixed ids do in the real app.
    await enqueue({ id: "1-page", kind: "page", workspaceId: "w1", title: "Doc" });
    await enqueue({ id: "2-board", kind: "board", workspaceId: "w1", title: "Sprint" });

    const seen: string[] = [];
    await flushQueue({
      page: async (a: Extract_<"page">) => {
        seen.push(`page:${a.title}`);
      },
      board: async (a: Extract_<"board">) => {
        seen.push(`board:${a.title}`);
      },
    } as never);

    expect(seen).toEqual(["page:Doc", "board:Sprint"]);
  });

  it("stops at the first failure and leaves the rest queued for the next flush", async () => {
    await enqueue({ id: "m1", kind: "message", workspaceId: "w1", channelId: "c1", body: "one" });
    await enqueue({ id: "m2", kind: "message", workspaceId: "w1", channelId: "c1", body: "two" });

    const sent: string[] = [];
    await flushQueue({
      message: async (a: Extract_<"message">) => {
        sent.push(a.body);
        throw new Error("still offline");
      },
    } as never);

    expect(sent).toEqual(["one"]); // stopped after the first failure
    // Both remain queued: "one" wasn't removed since it never succeeded,
    // and "two" was never attempted.
    expect(await queueSize()).toBe(2);
  });
});
