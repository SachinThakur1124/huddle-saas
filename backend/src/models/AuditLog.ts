import { Schema, model, Types } from "mongoose";

export interface AuditLogDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  actorId: Types.ObjectId;
  action: string;
  targetType: string;
  targetId: Types.ObjectId;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDoc>({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  actorId: { type: Schema.Types.ObjectId, required: true },
  action: { type: String, required: true },
  targetType: { type: String, required: true },
  targetId: { type: Schema.Types.ObjectId, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

export const AuditLog = model<AuditLogDoc>("AuditLog", auditLogSchema);
