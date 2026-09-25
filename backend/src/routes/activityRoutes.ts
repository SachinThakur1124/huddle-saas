import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { ActivityService } from "../services/activityService";
import { parseIntParam } from "../lib/pagination";

export const activityRoutes = Router({ mergeParams: true });

activityRoutes.use(requireAuth, requireRole("viewer"));

/**
 * @openapi
 * /workspaces/{workspaceId}/activity:
 *   get:
 *     summary: Recent pages/cards/messages in a workspace, merged and newest-first
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *       - { name: limit, in: query, required: false, schema: { type: integer, minimum: 1, maximum: 100 } }
 *     responses:
 *       200: { description: Array of activity entries }
 *       400: { description: Invalid limit }
 */
activityRoutes.get("/", async (req: WorkspaceScopedRequest, res) => {
  const limit = parseIntParam(req.query.limit, { default: 20, min: 1, max: 100 });
  if (limit === null) return res.status(400).json({ error: "Invalid limit" });
  const feed = await ActivityService.getRecent(req.params.workspaceId, limit);
  res.json(feed);
});
