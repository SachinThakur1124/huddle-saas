import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useListChannelsQuery, useCreateChannelMutation } from "./chatApi";
import { getErrorMessage } from "../../app/errors";

const NAME_MAX = 80;

export function ChatChannelListPage() {
  const { workspaceId = "" } = useParams();
  const { data: channels = [], isLoading } = useListChannelsQuery({ workspaceId });
  const [createChannel, { isLoading: isCreating }] = useCreateChannelMutation();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError("");
    try {
      const channel = await createChannel({ workspaceId, name: name.trim() }).unwrap();
      setName("");
      navigate(`/workspaces/${workspaceId}/chat/${channel._id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't create the channel. Check your permissions and try again."));
    }
  }

  return (
    <div>
      <h1>Channels</h1>
      <form className="inline-form" onSubmit={handleCreate}>
        <input
          aria-label="New channel name"
          placeholder="general"
          value={name}
          maxLength={NAME_MAX}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn" type="submit" disabled={isCreating || !name.trim()}>
          {isCreating ? <span className="spinner" /> : "+ New channel"}
        </button>
      </form>
      {error && <div className="alert alert-error">{error}</div>}
      {isLoading && (
        <div className="loading-row">
          <span className="spinner" /> Loading channels...
        </div>
      )}
      {!isLoading && channels.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon" aria-hidden="true">
            💬
          </span>
          <h3>No channels yet</h3>
          <p>Create one to start chatting with your team.</p>
        </div>
      )}
      <div className="entity-grid">
        {channels.map((c) => (
          <button
            key={c._id}
            type="button"
            className="card entity-tile"
            onClick={() => navigate(`/workspaces/${workspaceId}/chat/${c._id}`)}
          >
            <span aria-hidden="true" style={{ fontSize: "1.4rem" }}>
              #
            </span>
            <span className="entity-title">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
