import { Schema, model, Types } from "mongoose";

export interface ListDoc {
  _id: Types.ObjectId;
  boardId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  title: string;
  position: number;
  version: number;
}

const listSchema = new Schema<ListDoc>({
  boardId: { type: Schema.Types.ObjectId, required: true, index: true },
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true },
  position: { type: Number, required: true, default: 0 },
  // Bumped on every write that touches this list's cards, so two
  // transactions racing to mutate the same list force a real MongoDB
  // write conflict (and an automatic retry via withTransaction) instead
  // of silently interleaving.
  version: { type: Number, required: true, default: 0 },
});

export const List = model<ListDoc>("List", listSchema);
