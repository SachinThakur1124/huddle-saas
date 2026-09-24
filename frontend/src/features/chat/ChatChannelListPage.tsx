import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useListChannelsQuery, useCreateChannelMutation } from "./chatApi";

export function ChatChannelListPage() {
  const { workspaceId = "" } = useParams();
  const { data: channels = [], isLoading } = useListChannelsQuery({ workspaceId });
  const [createChannel, { isLoading: isCreating }] = useCreateChannelMutation();
  const [name, setName] = useState("");
  const navigate = useNavigate();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const channel = await createChannel({ workspaceId, name }).unwrap();
    setName("");
    navigate(`/workspaces/${workspaceId}/chat/${channel._id}`);
  }

  return (
    <div>
      <h1>Channels</h1>
      <form onSubmit={handleCreate} style={{ display: "flex", gap: "0.5rem", margin: "1rem 0" }}>
        <input
          aria-label="New channel name"
          placeholder="general"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1, padding: "0.5rem", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}
        />
        <button className="btn" type="submit" disabled={isCreating}>
          + New channel
        </button>
      </form>
      {isLoading && <p>Loading...</p>}
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {channels.map((c) => (
          <button
            key={c._id}
            type="button"
            className="card"
            style={{ textAlign: "left", padding: "0.8rem 1rem", cursor: "pointer", border: "1px solid var(--border)" }}
            onClick={() => navigate(`/workspaces/${workspaceId}/chat/${c._id}`)}
          >
            # {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
