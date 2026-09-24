import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGetPageQuery, useUpdatePageMutation, useDeletePageMutation, Page } from "./pagesApi";

// Keyed by page._id at the call site below, so navigating to a different
// page remounts this component fresh — the title/text fields initialize
// directly from `page` with no effect needed to sync them on every load.
function PageEditor({ workspaceId, page }: { workspaceId: string; page: Page }) {
  const [updatePage] = useUpdatePageMutation();
  const [deletePage] = useDeletePageMutation();
  const navigate = useNavigate();

  const [title, setTitle] = useState(page.title);
  const [text, setText] = useState((page.contentJson as { text?: string })?.text ?? "");
  const [error, setError] = useState("");

  async function saveTitle() {
    if (title === page.title) return;
    try {
      await updatePage({ workspaceId, pageId: page._id, title }).unwrap();
    } catch {
      setError("Couldn't save the title change.");
    }
  }

  async function saveText() {
    try {
      await updatePage({ workspaceId, pageId: page._id, contentJson: { text } }).unwrap();
    } catch {
      setError("Couldn't save your edits.");
    }
  }

  async function handleDelete() {
    try {
      await deletePage({ workspaceId, pageId: page._id }).unwrap();
      navigate(`/workspaces/${workspaceId}/pages`);
    } catch {
      setError("Couldn't delete this page. Check your permissions and try again.");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          aria-label="Page title"
          style={{
            font: "inherit",
            fontSize: "1.6rem",
            fontWeight: 700,
            border: "none",
            background: "transparent",
            color: "var(--text)",
            width: "100%",
          }}
        />
        <button className="btn btn-ghost" type="button" onClick={handleDelete}>
          Delete
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
      <textarea
        aria-label="Page content"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={saveText}
        rows={16}
        style={{
          width: "100%",
          marginTop: "1rem",
          padding: "0.9rem",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--text)",
          resize: "vertical",
        }}
      />
    </div>
  );
}

export function PageDetailPage() {
  const { workspaceId = "", pageId = "" } = useParams();
  const { data: page, isLoading, isError } = useGetPageQuery({ workspaceId, pageId });

  if (isLoading) return <p>Loading...</p>;
  if (isError || !page) {
    return <p className="field-error">This page doesn't exist or you don't have access to it.</p>;
  }
  return <PageEditor key={page._id} workspaceId={workspaceId} page={page} />;
}
