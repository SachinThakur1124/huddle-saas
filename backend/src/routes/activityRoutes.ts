import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { ActivityService } from "../services/activityService";

export const activityRoutes = Router({ mergeParams: true });

activityRoutes.use(requireAuth, requireRole("viewer"));

activityRoutes.get("/", async (req: WorkspaceScopedRequest, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const feed = await ActivityService.getRecent(req.params.workspaceId, limit);
  res.json(feed);
});
