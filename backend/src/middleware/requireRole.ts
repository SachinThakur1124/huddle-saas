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

    // A Redis outage must degrade to a slower Mongo lookup, not fail every
    // workspace request — cache errors are swallowed here deliberately.
    let role: Role | null = null;
    try {
      role = await cache.get(userId, workspaceId);
    } catch {
      // fall through to the Mongo lookup below; role stays null
    }

    if (!role) {
      const membership = await Membership.findOne({ userId, workspaceId });
      if (!membership) {
        return res.status(403).json({ error: "Not a member of this workspace" });
      }
      role = membership.role;
      try {
        await cache.set(userId, workspaceId, role);
      } catch {
        // best-effort cache write; a failed one just means the next
        // request pays the Mongo lookup cost again
      }
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
