import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useListMessagesQuery, useSendMessageMutation } from "./chatApi";
import { joinWorkspace } from "./socket";
import { selectCurrentUser } from "../auth/authSlice";

export function ChatPage() {
  const { workspaceId = "", channelId = "" } = useParams();
  const currentUser = useSelector(selectCurrentUser);
  const [before, setBefore] = useState<string | undefined>(undefined);
  const { data, isFetching } = useListMessagesQuery({ workspaceId, channelId, before });
  const [sendMessage] = useSendMessageMutation();
  const [draft, setDraft] = useState("");

  const sentinelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasScrolledInitially = useRef(false);

  useEffect(() => {
    joinWorkspace(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    // Infinite scroll: when the sentinel above the oldest message scrolls
    // into view, load the next-older page.
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && data?.nextCursor && !isFetching) {
          setBefore(data.nextCursor);
        }
      },
      { threshold: 1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [data?.nextCursor, isFetching]);

  useEffect(() => {
    if (!hasScrolledInitially.current && data?.messages.length) {
      bottomRef.current?.scrollIntoView();
      hasScrolledInitially.current = true;
    }
  }, [data?.messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    const body = draft;
    setDraft("");
    await sendMessage({ workspaceId, channelId, body });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
        <div ref={sentinelRef} />
        {data?.messages.map((m) => (
          <div
            key={m._id}
            className="card"
            style={{
              alignSelf: m.authorId === currentUser?.id ? "flex-end" : "flex-start",
              padding: "0.5rem 0.8rem",
              margin: "0.2rem 0",
              maxWidth: "70%",
            }}
          >
            {m.body}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} style={{ display: "flex", gap: "0.5rem", marginTop: "0.8rem" }}>
        <input
          aria-label="Message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message #channel"
          style={{ flex: 1, padding: "0.6rem", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}
        />
        <button className="btn" type="submit">
          Send
        </button>
      </form>
    </div>
  );
}
