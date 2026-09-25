import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLazySearchQuery } from "./searchApi";

const DEBOUNCE_MS = 300;

export function SearchBar() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [trigger, { data: results = [] }] = useLazySearchQuery();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!workspaceId || !query.trim()) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      trigger({ workspaceId, q: query });
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query, workspaceId, trigger]);

  function goTo(result: (typeof results)[number]) {
    if (!workspaceId) return;
    if (result.type === "page") navigate(`/workspaces/${workspaceId}/pages/${result.id}`);
    setQuery("");
  }

  return (
    <div style={{ position: "relative", width: 320 }}>
      <span
        aria-hidden="true"
        style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
      >
        🔍
      </span>
      <input
        aria-label="Search this workspace"
        placeholder="Search pages, cards, messages..."
        value={query}
        maxLength={200}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: "100%",
          padding: "0.5rem 0.8rem 0.5rem 2.1rem",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--text)",
        }}
      />
      {query.trim() && (
        <ul
          className="card"
          style={{
            position: "absolute",
            top: "110%",
            left: 0,
            right: 0,
            listStyle: "none",
            margin: 0,
            padding: "0.4rem",
            zIndex: 10,
            maxHeight: 280,
            overflow: "auto",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {results.length === 0 && (
            <li style={{ padding: "0.6rem 0.7rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              No results for "{query}"
            </li>
          )}
          {results.map((r) => (
            <li key={`${r.type}-${r.id}`}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: "100%", justifyContent: "flex-start", border: "none" }}
                onClick={() => goTo(r)}
              >
                <span className="badge badge-primary">{r.type}</span>
                {r.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
