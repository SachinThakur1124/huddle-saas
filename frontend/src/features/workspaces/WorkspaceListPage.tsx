import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useListWorkspacesQuery, useCreateWorkspaceMutation } from "./workspacesApi";
import { getErrorMessage } from "../../app/errors";

const NAME_MAX = 100;
const schema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(NAME_MAX, `Keep it under ${NAME_MAX} characters`),
});
type FormValues = z.infer<typeof schema>;

export function WorkspaceListPage() {
  const { data: workspaces = [], isLoading } = useListWorkspacesQuery();
  const [createWorkspace, { isLoading: isCreating }] = useCreateWorkspaceMutation();
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function handleCreate(values: FormValues) {
    setError("");
    try {
      const workspace = await createWorkspace({ name: values.name }).unwrap();
      reset();
      navigate(`/workspaces/${workspace._id}/pages`);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't create the workspace. Try again."));
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-brand">
        <span className="app-brand-mark" aria-hidden="true">
          H
        </span>
        Huddle
      </div>
      <div className="card auth-card" style={{ maxWidth: 440 }}>
        <h1>Your workspaces</h1>
        {isLoading && (
          <div className="loading-row">
            <span className="spinner" /> Loading workspaces...
          </div>
        )}
        {!isLoading && workspaces.length === 0 && (
          <div className="empty-state" style={{ padding: "2rem 1rem" }}>
            <span className="empty-state-icon" aria-hidden="true">
              🗃️
            </span>
            <h3>No workspaces yet</h3>
            <p>Create one below to get started.</p>
          </div>
        )}
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {workspaces.map((w) => (
            <li key={w._id} style={{ marginBottom: "0.5rem" }}>
              <button
                type="button"
                className="card entity-tile"
                onClick={() => navigate(`/workspaces/${w._id}/pages`)}
              >
                <span className="avatar" aria-hidden="true">
                  {w.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="entity-title">{w.name}</span>
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleSubmit(handleCreate)} style={{ marginTop: "1.2rem" }} noValidate>
          <div className="field">
            <label htmlFor="new-workspace-name">New workspace</label>
            <input
              id="new-workspace-name"
              maxLength={NAME_MAX}
              placeholder="Acme Inc."
              {...register("name")}
            />
            {errors.name && <span className="field-error">{errors.name.message}</span>}
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn" type="submit" disabled={isCreating} style={{ width: "100%" }}>
            {isCreating ? <span className="spinner" /> : "Create workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
