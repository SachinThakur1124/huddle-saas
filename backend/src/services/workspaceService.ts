import { Workspace } from "../models/Workspace";
import { Membership } from "../models/Membership";
import { Role } from "./permissionCache";
import { invalidateMembershipCache } from "../middleware/requireRole";

function slugify(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
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

  async setRole(workspaceId: string, targetUserId: string, role: Role) {
    const membership = await Membership.findOneAndUpdate(
      { userId: targetUserId, workspaceId },
      { role },
      { upsert: true, new: true },
    );
    await invalidateMembershipCache(targetUserId, workspaceId);
    return membership;
  },
};
