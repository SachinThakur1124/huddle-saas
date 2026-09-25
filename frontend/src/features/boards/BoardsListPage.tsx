import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useParams } from "react-router-dom";
import { useListBoardsQuery, useCreateBoardMutation } from "./boardsApi";
import { getErrorMessage, isNetworkError } from "../../app/errors";
import { enqueue, newActionId } from "../../app/offlineQueue";

const TITLE_MAX = 100;
const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(TITLE_MAX, `Keep it under ${TITLE_MAX} characters`),
});
type FormValues = z.infer<typeof schema>;

export function BoardsListPage() {
  const { workspaceId = "" } = useParams();
  const { data: boards = [], isLoading } = useListBoardsQuery({ workspaceId });
  const [createBoard, { isLoading: isCreating }] = useCreateBoardMutation();
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function handleCreate(values: FormValues) {
    setNotice(null);
    try {
      const board = await createBoard({ workspaceId, title: values.title }).unwrap();
      reset();
      navigate(`/workspaces/${workspaceId}/boards/${board._id}`);
    } catch (err) {
      if (isNetworkError(err)) {
        await enqueue({ id: newActionId(), kind: "board", workspaceId, title: values.title });
        reset();
        setNotice({ kind: "success", text: "You're offline — this board will be created once you're back online." });
        return;
      }
      setNotice({ kind: "error", text: getErrorMessage(err, "Couldn't create the board. Check your permissions and try again.") });
    }
  }

  return (
    <div>
      <h1>Boards</h1>
      <form className="inline-form" onSubmit={handleSubmit(handleCreate)} noValidate>
        <div style={{ flex: 1 }}>
          <input aria-label="New board title" placeholder="Sprint board" maxLength={TITLE_MAX} {...register("title")} />
          {errors.title && <p className="field-error" style={{ marginTop: 4 }}>{errors.title.message}</p>}
        </div>
        <button className="btn" type="submit" disabled={isCreating}>
          {isCreating ? <span className="spinner" /> : "+ New board"}
        </button>
      </form>
      {notice && (
        <div className={notice.kind === "error" ? "alert alert-error" : "alert alert-success"}>{notice.text}</div>
      )}
      {isLoading && (
        <div className="loading-row">
          <span className="spinner" /> Loading boards...
        </div>
      )}
      {!isLoading && boards.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon" aria-hidden="true">
            🗂️
          </span>
          <h3>No boards yet</h3>
          <p>Create your first board to start tracking work.</p>
        </div>
      )}
      <div className="entity-grid">
        {boards.map((b) => (
          <button
            key={b._id}
            type="button"
            className="card entity-tile"
            onClick={() => navigate(`/workspaces/${workspaceId}/boards/${b._id}`)}
          >
            <span aria-hidden="true" style={{ fontSize: "1.4rem" }}>
              🗂️
            </span>
            <span className="entity-title">{b.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
