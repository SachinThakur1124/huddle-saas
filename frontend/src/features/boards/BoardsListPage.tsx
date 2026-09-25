import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useListBoardsQuery, useCreateBoardMutation } from "./boardsApi";
import { getErrorMessage } from "../../app/errors";

const TITLE_MAX = 100;

export function BoardsListPage() {
  const { workspaceId = "" } = useParams();
  const { data: boards = [], isLoading } = useListBoardsQuery({ workspaceId });
  const [createBoard, { isLoading: isCreating }] = useCreateBoardMutation();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError("");
    try {
      const board = await createBoard({ workspaceId, title: title.trim() }).unwrap();
      setTitle("");
      navigate(`/workspaces/${workspaceId}/boards/${board._id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't create the board. Check your permissions and try again."));
    }
  }

  return (
    <div>
      <h1>Boards</h1>
      <form className="inline-form" onSubmit={handleCreate}>
        <input
          aria-label="New board title"
          placeholder="Sprint board"
          value={title}
          maxLength={TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button className="btn" type="submit" disabled={isCreating || !title.trim()}>
          {isCreating ? <span className="spinner" /> : "+ New board"}
        </button>
      </form>
      {error && <div className="alert alert-error">{error}</div>}
      {isLoading && (
        <div className="loading-row">
          <span className="spinner" /> Loading boards...
        </div>
      )}
      {!isLoading && boards.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon" aria-hidden="true">
            🗂️
          </span>
          <h3>No boards yet</h3>
          <p>Create your first board to start tracking work.</p>
        </div>
      )}
      <div className="entity-grid">
        {boards.map((b) => (
          <button
            key={b._id}
            type="button"
            className="card entity-tile"
            onClick={() => navigate(`/workspaces/${workspaceId}/boards/${b._id}`)}
          >
            <span aria-hidden="true" style={{ fontSize: "1.4rem" }}>
              🗂️
            </span>
            <span className="entity-title">{b.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
