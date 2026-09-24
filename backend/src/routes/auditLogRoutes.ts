import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { AuditService } from "../services/auditService";

export const auditLogRoutes = Router({ mergeParams: true });

auditLogRoutes.use(requireAuth, requireRole("admin"));

auditLogRoutes.get("/", async (req: WorkspaceScopedRequest, res) => {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const entries = await AuditService.listForWorkspace(req.params.workspaceId, page);
  res.json(entries);
});
