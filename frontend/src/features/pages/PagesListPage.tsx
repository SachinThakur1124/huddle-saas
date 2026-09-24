import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useListPagesQuery, useCreatePageMutation } from "./pagesApi";

export function PagesListPage() {
  const { workspaceId = "" } = useParams();
  const { data: pages = [], isLoading } = useListPagesQuery({ workspaceId });
  const [createPage, { isLoading: isCreating }] = useCreatePageMutation();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError("");
    try {
      const page = await createPage({ workspaceId, title }).unwrap();
      setTitle("");
      navigate(`/workspaces/${workspaceId}/pages/${page._id}`);
    } catch {
      setError("Couldn't create the page. Check your permissions and try again.");
    }
  }

  return (
    <div>
      <h1>Pages</h1>
      <form onSubmit={handleCreate} style={{ display: "flex", gap: "0.5rem", margin: "1rem 0" }}>
        <input
          aria-label="New page title"
          placeholder="Untitled page"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ flex: 1, padding: "0.5rem", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}
        />
        <button className="btn" type="submit" disabled={isCreating}>
          + New page
        </button>
      </form>
      {error && <p className="field-error">{error}</p>}
      {isLoading && <p>Loading...</p>}
      <div style={{ display: "grid", gap: "0.6rem" }}>
        {pages.map((p) => (
          <button
            key={p._id}
            type="button"
            className="card"
            style={{ textAlign: "left", padding: "0.9rem 1rem", cursor: "pointer", border: "1px solid var(--border)" }}
            onClick={() => navigate(`/workspaces/${workspaceId}/pages/${p._id}`)}
          >
            {p.title}
          </button>
        ))}
      </div>
    </div>
  );
}
