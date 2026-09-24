import { Schema, model, Types } from "mongoose";

export interface MessageDoc {
  _id: Types.ObjectId;
  channelId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  authorId: Types.ObjectId;
  body: string;
  createdAt: Date;
}

const messageSchema = new Schema<MessageDoc>({
  channelId: { type: Schema.Types.ObjectId, required: true, index: true },
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  authorId: { type: Schema.Types.ObjectId, required: true },
  body: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date(), index: true },
});

export const Message = model<MessageDoc>("Message", messageSchema);
