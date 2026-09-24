import { ClientSession, Types } from "mongoose";
import { AuditLog } from "../models/AuditLog";

interface RecordInput {
  actorId: Types.ObjectId | string;
  workspaceId: Types.ObjectId | string;
  action: string;
  targetType: string;
  targetId: Types.ObjectId | string;
  session?: ClientSession;
}

export const AuditService = {
  async record(input: RecordInput) {
    const [doc] = await AuditLog.create(
      [
        {
          actorId: input.actorId,
          workspaceId: input.workspaceId,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
        },
      ],
      { session: input.session },
    );
    return doc;
  },

  async listForWorkspace(workspaceId: string, page = 1, pageSize = 25) {
    return AuditLog.find({ workspaceId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);
  },
};
