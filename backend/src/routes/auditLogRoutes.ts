import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { AuditService } from "../services/auditService";
import { parseIntParam } from "../lib/pagination";

export const auditLogRoutes = Router({ mergeParams: true });

auditLogRoutes.use(requireAuth, requireRole("admin"));

/**
 * @openapi
 * /workspaces/{workspaceId}/audit-log:
 *   get:
 *     summary: List audit log entries for a workspace, newest first (admin+ only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *       - { name: page, in: query, required: false, schema: { type: integer, minimum: 1 } }
 *     responses:
 *       200: { description: Array of audit log entries }
 *       400: { description: Invalid page }
 */
auditLogRoutes.get("/", async (req: WorkspaceScopedRequest, res) => {
  const page = parseIntParam(req.query.page, { default: 1, min: 1 });
  if (page === null) return res.status(400).json({ error: "Invalid page" });
  const entries = await AuditService.listForWorkspace(req.params.workspaceId, page);
  res.json(entries);
});
