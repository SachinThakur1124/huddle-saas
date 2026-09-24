import { Schema, model, Types } from "mongoose";

export interface AttachmentDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  uploaderId: Types.ObjectId;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  createdAt: Date;
}

const attachmentSchema = new Schema<AttachmentDoc>({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  uploaderId: { type: Schema.Types.ObjectId, required: true },
  filename: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  path: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

export const Attachment = model<AttachmentDoc>("Attachment", attachmentSchema);
