import { Schema, model, Types } from "mongoose";

export interface BoardDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  title: string;
  createdAt: Date;
}

const boardSchema = new Schema<BoardDoc>({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

export const Board = model<BoardDoc>("Board", boardSchema);
