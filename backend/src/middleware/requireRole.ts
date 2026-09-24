import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AuthedRequest } from "./requireAuth";
import { Membership } from "../models/Membership";
import { PermissionCache, ROLE_ORDER, Role } from "../services/permissionCache";
import { redisClient } from "../lib/redis";

export interface WorkspaceScopedRequest extends AuthedRequest {
  membership?: { role: Role };
}

const cache = new PermissionCache(redisClient);

export function requireRole(minRole: Role) {
  return async (
    req: WorkspaceScopedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    const workspaceId = req.params.workspaceId;
    const userId = req.userId!;
    if (!workspaceId) {
      return res.status(400).json({ error: "workspaceId param required" });
    }
    if (!Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ error: "Invalid workspaceId" });
    }

    let role = await cache.get(userId, workspaceId);
    if (!role) {
      const membership = await Membership.findOne({ userId, workspaceId });
      if (!membership) {
        return res.status(403).json({ error: "Not a member of this workspace" });
      }
      role = membership.role;
      await cache.set(userId, workspaceId, role);
    }

    if (ROLE_ORDER.indexOf(role) < ROLE_ORDER.indexOf(minRole)) {
      return res.status(403).json({ error: `Requires role >= ${minRole}` });
    }

    req.membership = { role };
    next();
  };
}

export async function invalidateMembershipCache(userId: string, workspaceId: string) {
  await cache.invalidate(userId, workspaceId);
}
