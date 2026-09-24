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
      <input
        aria-label="Search this workspace"
        placeholder="Search pages, cards, messages..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: "100%",
          padding: "0.5rem 0.8rem",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--text)",
        }}
      />
      {query && results.length > 0 && (
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
          }}
        >
          {results.map((r) => (
            <li key={`${r.type}-${r.id}`}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: "100%", justifyContent: "flex-start", border: "none" }}
                onClick={() => goTo(r)}
              >
                <span style={{ color: "var(--text-muted)", marginRight: 6 }}>{r.type}</span>
                {r.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
