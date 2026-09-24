import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
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
