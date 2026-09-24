import { Schema, model, Types } from "mongoose";
import { Role } from "../services/permissionCache";

export interface MembershipDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  role: Role;
  createdAt: Date;
}

const membershipSchema = new Schema<MembershipDoc>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
  role: { type: String, enum: ["viewer", "member", "admin", "owner"], required: true },
  createdAt: { type: Date, default: () => new Date() },
});

membershipSchema.index({ userId: 1, workspaceId: 1 }, { unique: true });

export const Membership = model<MembershipDoc>("Membership", membershipSchema);
