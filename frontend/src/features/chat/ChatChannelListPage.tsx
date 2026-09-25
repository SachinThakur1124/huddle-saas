import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useParams } from "react-router-dom";
import { useListChannelsQuery, useCreateChannelMutation } from "./chatApi";
import { getErrorMessage, isNetworkError } from "../../app/errors";
import { enqueue, newActionId } from "../../app/offlineQueue";

const NAME_MAX = 80;
const schema = z.object({
  name: z.string().trim().min(1, "Channel name is required").max(NAME_MAX, `Keep it under ${NAME_MAX} characters`),
});
type FormValues = z.infer<typeof schema>;

export function ChatChannelListPage() {
  const { workspaceId = "" } = useParams();
  const { data: channels = [], isLoading } = useListChannelsQuery({ workspaceId });
  const [createChannel, { isLoading: isCreating }] = useCreateChannelMutation();
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
      const channel = await createChannel({ workspaceId, name: values.name }).unwrap();
      reset();
      navigate(`/workspaces/${workspaceId}/chat/${channel._id}`);
    } catch (err) {
      if (isNetworkError(err)) {
        await enqueue({ id: newActionId(), kind: "channel", workspaceId, name: values.name });
        reset();
        setNotice({ kind: "success", text: "You're offline — this channel will be created once you're back online." });
        return;
      }
      setNotice({ kind: "error", text: getErrorMessage(err, "Couldn't create the channel. Check your permissions and try again.") });
    }
  }

  return (
    <div>
      <h1>Channels</h1>
      <form className="inline-form" onSubmit={handleSubmit(handleCreate)} noValidate>
        <div style={{ flex: 1 }}>
          <input aria-label="New channel name" placeholder="general" maxLength={NAME_MAX} {...register("name")} />
          {errors.name && <p className="field-error" style={{ marginTop: 4 }}>{errors.name.message}</p>}
        </div>
        <button className="btn" type="submit" disabled={isCreating}>
          {isCreating ? <span className="spinner" /> : "+ New channel"}
        </button>
      </form>
      {notice && (
        <div className={notice.kind === "error" ? "alert alert-error" : "alert alert-success"}>{notice.text}</div>
      )}
      {isLoading && (
        <div className="loading-row">
          <span className="spinner" /> Loading channels...
        </div>
      )}
      {!isLoading && channels.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon" aria-hidden="true">
            💬
          </span>
          <h3>No channels yet</h3>
          <p>Create one to start chatting with your team.</p>
        </div>
      )}
      <div className="entity-grid">
        {channels.map((c) => (
          <button
            key={c._id}
            type="button"
            className="card entity-tile"
            onClick={() => navigate(`/workspaces/${workspaceId}/chat/${c._id}`)}
          >
            <span aria-hidden="true" style={{ fontSize: "1.4rem" }}>
              #
            </span>
            <span className="entity-title">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
