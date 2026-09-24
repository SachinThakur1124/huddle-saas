import { Schema, model, Types } from "mongoose";

export interface RefreshTokenDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenDoc>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  familyId: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  revoked: { type: Boolean, default: false },
  createdAt: { type: Date, default: () => new Date() },
});

export const RefreshToken = model<RefreshTokenDoc>(
  "RefreshToken",
  refreshTokenSchema,
);
