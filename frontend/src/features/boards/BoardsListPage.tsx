import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useListBoardsQuery, useCreateBoardMutation } from "./boardsApi";

export function BoardsListPage() {
  const { workspaceId = "" } = useParams();
  const { data: boards = [], isLoading } = useListBoardsQuery({ workspaceId });
  const [createBoard, { isLoading: isCreating }] = useCreateBoardMutation();
  const [title, setTitle] = useState("");
  const navigate = useNavigate();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const board = await createBoard({ workspaceId, title }).unwrap();
    setTitle("");
    navigate(`/workspaces/${workspaceId}/boards/${board._id}`);
  }

  return (
    <div>
      <h1>Boards</h1>
      <form onSubmit={handleCreate} style={{ display: "flex", gap: "0.5rem", margin: "1rem 0" }}>
        <input
          aria-label="New board title"
          placeholder="Sprint board"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ flex: 1, padding: "0.5rem", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}
        />
        <button className="btn" type="submit" disabled={isCreating}>
          + New board
        </button>
      </form>
      {isLoading && <p>Loading...</p>}
      <div style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {boards.map((b) => (
          <button
            key={b._id}
            type="button"
            className="card"
            style={{ textAlign: "left", padding: "1.2rem", cursor: "pointer", border: "1px solid var(--border)" }}
            onClick={() => navigate(`/workspaces/${workspaceId}/boards/${b._id}`)}
          >
            {b.title}
          </button>
        ))}
      </div>
    </div>
  );
}
