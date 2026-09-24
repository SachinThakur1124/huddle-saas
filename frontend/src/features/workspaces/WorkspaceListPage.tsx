import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useListWorkspacesQuery, useCreateWorkspaceMutation } from "./workspacesApi";

export function WorkspaceListPage() {
  const { data: workspaces = [], isLoading } = useListWorkspacesQuery();
  const [createWorkspace, { isLoading: isCreating }] = useCreateWorkspaceMutation();
  const [name, setName] = useState("");
  const navigate = useNavigate();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const workspace = await createWorkspace({ name }).unwrap();
    setName("");
    navigate(`/workspaces/${workspace._id}/pages`);
  }

  return (
    <div className="auth-screen">
      <div className="card auth-card">
        <h1>Your workspaces</h1>
        {isLoading && <p>Loading...</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {workspaces.map((w) => (
            <li key={w._id} style={{ marginBottom: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: "100%", justifyContent: "flex-start" }}
                onClick={() => navigate(`/workspaces/${w._id}/pages`)}
              >
                {w.name}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleCreate} style={{ marginTop: "1rem" }}>
          <div className="field">
            <label htmlFor="new-workspace-name">New workspace</label>
            <input
              id="new-workspace-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc."
            />
          </div>
          <button className="btn" type="submit" disabled={isCreating}>
            Create workspace
          </button>
        </form>
      </div>
    </div>
  );
}
