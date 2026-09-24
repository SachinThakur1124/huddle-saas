import { Schema, model, Types } from "mongoose";

export interface PageDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  title: string;
  contentJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const pageSchema = new Schema<PageDoc>({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  parentId: { type: Schema.Types.ObjectId, default: null, index: true },
  title: { type: String, required: true },
  contentJson: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

export const Page = model<PageDoc>("Page", pageSchema);
