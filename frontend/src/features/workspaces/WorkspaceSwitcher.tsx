import { useNavigate, useParams } from "react-router-dom";
import { useListWorkspacesQuery } from "./workspacesApi";

export function WorkspaceSwitcher() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { data: workspaces = [] } = useListWorkspacesQuery();

  return (
    <div>
      <label htmlFor="workspace-switcher" style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 4 }}>
        Workspace
      </label>
      <select
        id="workspace-switcher"
        value={workspaceId ?? ""}
        onChange={(e) => navigate(`/workspaces/${e.target.value}/pages`)}
        style={{
          width: "100%",
          padding: "0.5rem",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--text)",
        }}
      >
        {workspaces.map((w) => (
          <option key={w._id} value={w._id}>
            {w.name}
          </option>
        ))}
      </select>
    </div>
  );
}
