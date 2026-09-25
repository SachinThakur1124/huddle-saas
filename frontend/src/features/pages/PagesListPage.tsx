import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useListPagesQuery, useCreatePageMutation } from "./pagesApi";
import { getErrorMessage } from "../../app/errors";

const TITLE_MAX = 200;

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
      const page = await createPage({ workspaceId, title: title.trim() }).unwrap();
      setTitle("");
      navigate(`/workspaces/${workspaceId}/pages/${page._id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't create the page. Check your permissions and try again."));
    }
  }

  return (
    <div>
      <h1>Pages</h1>
      <form className="inline-form" onSubmit={handleCreate}>
        <input
          aria-label="New page title"
          placeholder="Untitled page"
          value={title}
          maxLength={TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button className="btn" type="submit" disabled={isCreating || !title.trim()}>
          {isCreating ? <span className="spinner" /> : "+ New page"}
        </button>
      </form>
      {error && <div className="alert alert-error">{error}</div>}
      {isLoading && (
        <div className="loading-row">
          <span className="spinner" /> Loading pages...
        </div>
      )}
      {!isLoading && pages.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon" aria-hidden="true">
            📄
          </span>
          <h3>No pages yet</h3>
          <p>Create your first page to start writing.</p>
        </div>
      )}
      <div className="entity-grid">
        {pages.map((p) => (
          <button
            key={p._id}
            type="button"
            className="card entity-tile"
            onClick={() => navigate(`/workspaces/${workspaceId}/pages/${p._id}`)}
          >
            <span aria-hidden="true" style={{ fontSize: "1.4rem" }}>
              📄
            </span>
            <span className="entity-title">{p.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
