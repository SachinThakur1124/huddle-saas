import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useListMessagesQuery, useSendMessageMutation } from "./chatApi";
import { selectCurrentUser } from "../auth/authSlice";
import { enqueue } from "../../app/offlineQueue";

function isNetworkError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "status" in err && err.status === "FETCH_ERROR";
}

// Keyed by channelId at the call site below, so switching channels remounts
// this component fresh — pagination (`before`) and the one-time initial
// scroll both reset naturally, with no effect needed to reset them.
function ChatChannelView({ workspaceId, channelId }: { workspaceId: string; channelId: string }) {
  const currentUser = useSelector(selectCurrentUser);
  const [before, setBefore] = useState<string | undefined>(undefined);
  const { data, isFetching } = useListMessagesQuery({ workspaceId, channelId, before });
  const [sendMessage] = useSendMessageMutation();
  const [draft, setDraft] = useState("");

  const sentinelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasScrolledInitially = useRef(false);

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
    try {
      await sendMessage({ workspaceId, channelId, body }).unwrap();
    } catch (err) {
      if (isNetworkError(err)) {
        // Offline: queue it in IndexedDB rather than losing the draft —
        // flushed automatically on the browser's `online` event (see
        // main.tsx).
        await enqueue({ id: `${Date.now()}-${Math.random()}`, workspaceId, channelId, body });
        return;
      }
      setDraft(body); // give the text back so it isn't silently lost
    }
  }

  const isEmpty = !isFetching && (data?.messages.length ?? 0) === 0;

  return (
    <div className="chat-scroll">
      <div className="chat-messages">
        <div ref={sentinelRef} />
        {isFetching && !data?.messages.length && (
          <div className="loading-row">
            <span className="spinner" /> Loading messages...
          </div>
        )}
        {isEmpty && (
          <div className="empty-state" style={{ margin: "auto" }}>
            <span className="empty-state-icon" aria-hidden="true">
              💬
            </span>
            <h3>No messages yet</h3>
            <p>Say hi to get the conversation started.</p>
          </div>
        )}
        {data?.messages.map((m) => {
          const own = m.authorId === currentUser?.id;
          return (
            <div key={m._id} className={`chat-bubble${own ? " own" : ""}`}>
              {m.body}
              <span className="chat-bubble-meta">
                {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="chat-composer">
        <input
          aria-label="Message"
          value={draft}
          maxLength={4000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message #channel"
        />
        <button className="btn" type="submit" disabled={!draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export function ChatPage() {
  const { workspaceId = "", channelId = "" } = useParams();
  return <ChatChannelView key={channelId} workspaceId={workspaceId} channelId={channelId} />;
}
