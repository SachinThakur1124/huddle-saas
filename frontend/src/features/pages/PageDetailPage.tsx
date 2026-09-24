import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGetPageQuery, useUpdatePageMutation, useDeletePageMutation } from "./pagesApi";

export function PageDetailPage() {
  const { workspaceId = "", pageId = "" } = useParams();
  const { data: page, isLoading } = useGetPageQuery({ workspaceId, pageId });
  const [updatePage] = useUpdatePageMutation();
  const [deletePage] = useDeletePageMutation();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    if (page) {
      setTitle(page.title);
      setText((page.contentJson as { text?: string })?.text ?? "");
    }
  }, [page]);

  function saveTitle() {
    if (page && title !== page.title) {
      updatePage({ workspaceId, pageId, title });
    }
  }

  function saveText() {
    updatePage({ workspaceId, pageId, contentJson: { text } });
  }

  async function handleDelete() {
    await deletePage({ workspaceId, pageId }).unwrap();
    navigate(`/workspaces/${workspaceId}/pages`);
  }

  if (isLoading) return <p>Loading...</p>;

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
