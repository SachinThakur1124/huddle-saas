import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { WorkspaceService } from "../services/workspaceService";

export const workspaceRoutes = Router();

workspaceRoutes.use(requireAuth);

const createSchema = z.object({ name: z.string().min(1).max(100) });

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
  userId: z.string().min(1),
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
      parsed.data.userId,
      parsed.data.role,
    );
    res.status(200).json(membership);
  },
);
