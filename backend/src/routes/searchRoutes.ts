import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { SearchService } from "../services/searchService";

export const searchRoutes = Router({ mergeParams: true });

searchRoutes.use(requireAuth, requireRole("viewer"));

searchRoutes.get("/", async (req: WorkspaceScopedRequest, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  if (!q.trim()) return res.json([]);
  const results = await SearchService.search(req.params.workspaceId, q);
  res.json(results);
});
