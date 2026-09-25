import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { SearchService } from "../services/searchService";

export const searchRoutes = Router({ mergeParams: true });

searchRoutes.use(requireAuth, requireRole("viewer"));

/**
 * @openapi
 * /workspaces/{workspaceId}/search:
 *   get:
 *     summary: Full-text search across a workspace's pages, cards, and messages
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *       - { name: q, in: query, required: true, schema: { type: string }, description: "Empty/whitespace-only returns []" }
 *     responses:
 *       200: { description: "Array of { type, id, title } ranked results" }
 */
searchRoutes.get("/", async (req: WorkspaceScopedRequest, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  if (!q.trim()) return res.json([]);
  const results = await SearchService.search(req.params.workspaceId, q);
  res.json(results);
});
