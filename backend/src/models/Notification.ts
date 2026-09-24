import { Schema, model, Types } from "mongoose";

export interface NotificationDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  type: string;
  payload: unknown;
  read: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDoc>({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  workspaceId: { type: Schema.Types.ObjectId, required: true },
  type: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, default: {} },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: () => new Date() },
});

export const Notification = model<NotificationDoc>("Notification", notificationSchema);
