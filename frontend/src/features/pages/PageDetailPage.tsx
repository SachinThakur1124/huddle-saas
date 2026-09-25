import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGetPageQuery, useUpdatePageMutation, useDeletePageMutation, Page } from "./pagesApi";
import { getErrorMessage } from "../../app/errors";

const TITLE_MAX = 200;

// Keyed by page._id at the call site below, so navigating to a different
// page remounts this component fresh — the title/text fields initialize
// directly from `page` with no effect needed to sync them on every load.
function PageEditor({ workspaceId, page }: { workspaceId: string; page: Page }) {
  const [updatePage] = useUpdatePageMutation();
  const [deletePage, { isLoading: isDeleting }] = useDeletePageMutation();
  const navigate = useNavigate();

  const [title, setTitle] = useState(page.title);
  const [text, setText] = useState((page.contentJson as { text?: string })?.text ?? "");
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function saveTitle() {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(page.title);
      return;
    }
    if (trimmed === page.title) return;
    try {
      await updatePage({ workspaceId, pageId: page._id, title: trimmed }).unwrap();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the title change."));
    }
  }

  async function saveText() {
    try {
      await updatePage({ workspaceId, pageId: page._id, contentJson: { text } }).unwrap();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save your edits."));
    }
  }

  async function handleDelete() {
    try {
      await deletePage({ workspaceId, pageId: page._id }).unwrap();
      navigate(`/workspaces/${workspaceId}/pages`);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't delete this page. Check your permissions and try again."));
      setConfirmingDelete(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem" }}>
        <input
          value={title}
          maxLength={TITLE_MAX}
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
        {confirmingDelete ? (
          <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", alignSelf: "center" }}>Delete page?</span>
            <button className="btn" type="button" style={{ background: "var(--danger)" }} onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <span className="spinner" /> : "Confirm"}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost" type="button" onClick={() => setConfirmingDelete(true)}>
            Delete
          </button>
        )}
      </div>
      {error && <div className="alert alert-error">{error}</div>}
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

  if (isLoading) {
    return (
      <div className="loading-row">
        <span className="spinner" /> Loading page...
      </div>
    );
  }
  if (isError || !page) {
    return <div className="alert alert-error">This page doesn't exist or you don't have access to it.</div>;
  }
  return <PageEditor key={page._id} workspaceId={workspaceId} page={page} />;
}
