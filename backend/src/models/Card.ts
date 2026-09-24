import { Schema, model, Types } from "mongoose";

export interface CardDoc {
  _id: Types.ObjectId;
  listId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  title: string;
  description: string;
  position: number;
  assigneeIds: Types.ObjectId[];
  createdAt: Date;
}

const cardSchema = new Schema<CardDoc>({
  listId: { type: Schema.Types.ObjectId, required: true, index: true },
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  position: { type: Number, required: true, default: 0 },
  assigneeIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: () => new Date() },
});

export const Card = model<CardDoc>("Card", cardSchema);
