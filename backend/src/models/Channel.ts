import { Schema, model, Types } from "mongoose";

export interface ChannelDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  name: string;
  createdAt: Date;
}

const channelSchema = new Schema<ChannelDoc>({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

export const Channel = model<ChannelDoc>("Channel", channelSchema);
