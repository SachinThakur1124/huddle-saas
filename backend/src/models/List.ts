import { Schema, model, Types } from "mongoose";

export interface ListDoc {
  _id: Types.ObjectId;
  boardId: Types.ObjectId;
  title: string;
  position: number;
}

const listSchema = new Schema<ListDoc>({
  boardId: { type: Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true },
  position: { type: Number, required: true, default: 0 },
});

export const List = model<ListDoc>("List", listSchema);
