import { mergeMessagePage } from "../src/features/chat/chatApi";

// Exercises the exact merge logic a code review flagged as buggy: stacking
// the newest page above stale history when a channel is reopened after
// having been scrolled through earlier.
describe("mergeMessagePage", () => {
  const msg = (id: string, body: string) => ({
    _id: id,
    channelId: "c1",
    authorId: "u1",
    body,
    createdAt: new Date().toISOString(),
  });

  it("replaces (not prepends) when `before` is unset — reopening a channel", () => {
    const current = { messages: [msg("1", "old-1"), msg("2", "old-2")], nextCursor: "1" };
    const incoming = { messages: [msg("5", "new-5"), msg("6", "new-6")], nextCursor: "5" };

    mergeMessagePage(current, incoming, undefined);

    expect(current.messages.map((m) => m._id)).toEqual(["5", "6"]);
  });

  it("prepends and de-dupes when `before` is set — loading older history", () => {
    const current = { messages: [msg("3", "c"), msg("4", "d")], nextCursor: "3" };
    const incoming = { messages: [msg("1", "a"), msg("2", "b"), msg("3", "c")], nextCursor: "1" };

    mergeMessagePage(current, incoming, "3");

    expect(current.messages.map((m) => m._id)).toEqual(["1", "2", "3", "4"]);
  });
});
