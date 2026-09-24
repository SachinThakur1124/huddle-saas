import { Schema, model, Types } from "mongoose";

export interface WorkspaceDoc {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  createdAt: Date;
}

const workspaceSchema = new Schema<WorkspaceDoc>({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: () => new Date() },
});

export const Workspace = model<WorkspaceDoc>("Workspace", workspaceSchema);
