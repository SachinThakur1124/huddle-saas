import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { validateObjectIdParams } from "../middleware/validateObjectId";
import { WorkspaceService } from "../services/workspaceService";

export const workspaceRoutes = Router();

workspaceRoutes.use(requireAuth);

const createSchema = z.object({ name: z.string().min(1).max(100) });

/**
 * @openapi
 * /workspaces:
 *   post:
 *     summary: Create a workspace (caller becomes its owner)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       201: { description: Workspace created }
 *   get:
 *     summary: List workspaces the caller is a member of
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of workspaces }
 */
workspaceRoutes.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const workspace = await WorkspaceService.create(req.userId!, parsed.data.name);
  res.status(201).json(workspace);
});

workspaceRoutes.get("/", async (req: AuthedRequest, res) => {
  const workspaces = await WorkspaceService.listForUser(req.userId!);
  res.status(200).json(workspaces);
});

const roleSchema = z.object({
  userId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid userId"),
  role: z.enum(["viewer", "member", "admin", "owner"]),
});

/**
 * @openapi
 * /workspaces/{workspaceId}/members:
 *   get:
 *     summary: List members of a workspace with their role
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: "Array of { userId, name, email, role }" }
 *   post:
 *     summary: Set (or grant) a member's role (admin+ only; only an owner may grant owner/admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, role]
 *             properties:
 *               userId: { type: string }
 *               role: { type: string, enum: [viewer, member, admin, owner] }
 *     responses:
 *       200: { description: Membership updated }
 *       403: { description: Insufficient privilege to grant this role or act on this member }
 */
workspaceRoutes.get(
  "/:workspaceId/members",
  requireRole("viewer"),
  async (req: WorkspaceScopedRequest, res) => {
    const members = await WorkspaceService.listMembers(req.params.workspaceId);
    res.json(members);
  },
);

workspaceRoutes.post(
  "/:workspaceId/members",
  requireRole("admin"),
  async (req: WorkspaceScopedRequest, res) => {
    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const membership = await WorkspaceService.setRole(
      req.params.workspaceId,
      req.userId!,
      req.membership!.role,
      parsed.data.userId,
      parsed.data.role,
    );
    res.status(200).json(membership);
  },
);

/**
 * @openapi
 * /workspaces/{workspaceId}/members/{userId}:
 *   delete:
 *     summary: Remove a member from the workspace (admin+ only; cannot remove an equal/higher-ranked member unless caller is owner, or the last owner)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *       - { name: userId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       204: { description: Removed }
 *       400: { description: Cannot remove the last owner }
 *       403: { description: Insufficient privilege }
 *       404: { description: Membership not found }
 */
workspaceRoutes.delete(
  "/:workspaceId/members/:userId",
  validateObjectIdParams("userId"),
  requireRole("admin"),
  async (req: WorkspaceScopedRequest, res) => {
    await WorkspaceService.removeMember(
      req.params.workspaceId,
      req.userId!,
      req.membership!.role,
      req.params.userId,
    );
    res.status(204).send();
  },
);
