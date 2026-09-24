import { Workspace } from "../models/Workspace";
import { Membership } from "../models/Membership";
import { User } from "../models/User";
import { ROLE_ORDER, Role } from "./permissionCache";
import { invalidateMembershipCache } from "../middleware/requireRole";
import { withTransaction } from "../lib/withTransaction";
import { AuditService } from "./auditService";
import { HttpError } from "../lib/httpError";

function slugify(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
}

function rank(role: Role): number {
  return ROLE_ORDER.indexOf(role);
}

export const WorkspaceService = {
  async create(ownerId: string, name: string) {
    const workspace = await Workspace.create({ name, slug: slugify(name) });
    await Membership.create({ userId: ownerId, workspaceId: workspace._id, role: "owner" });
    return workspace;
  },

  async listForUser(userId: string) {
    const memberships = await Membership.find({ userId }).populate("workspaceId");
    return memberships.map((m) => m.workspaceId);
  },

  async setRole(
    workspaceId: string,
    actorId: string,
    actorRole: Role,
    targetUserId: string,
    role: Role,
  ) {
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw new HttpError(400, "Target user does not exist");

    const existing = await Membership.findOne({ userId: targetUserId, workspaceId });
    const currentRole: Role = existing?.role ?? "viewer";

    // Nobody may act on a member who outranks or matches them, and only an
    // owner may grant "owner" or "admin" — otherwise any admin could
    // promote themselves to owner or demote the real owner.
    if (rank(currentRole) >= rank(actorRole) && actorRole !== "owner") {
      throw new HttpError(403, "Cannot change a member with an equal or higher role");
    }
    if ((role === "owner" || role === "admin") && actorRole !== "owner") {
      throw new HttpError(403, "Only an owner can grant owner or admin");
    }

    if (currentRole === "owner" && role !== "owner") {
      const ownerCount = await Membership.countDocuments({ workspaceId, role: "owner" });
      if (ownerCount <= 1) {
        throw new HttpError(400, "Cannot demote the last owner of a workspace");
      }
    }

    return withTransaction(async (session) => {
      const membership = await Membership.findOneAndUpdate(
        { userId: targetUserId, workspaceId },
        { role },
        { upsert: true, new: true, session },
      );
      await AuditService.record({
        actorId,
        workspaceId,
        action: "membership.role_changed",
        targetType: "Membership",
        targetId: membership._id,
        session,
      });
      await invalidateMembershipCache(targetUserId, workspaceId);
      return membership;
    });
  },
};
