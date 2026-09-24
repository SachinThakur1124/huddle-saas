import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { validateObjectIdParams } from "../middleware/validateObjectId";
import { PageService } from "../services/pageService";

export const pageRoutes = Router({ mergeParams: true });

pageRoutes.use(requireAuth, requireRole("viewer"));
pageRoutes.use("/:pageId", validateObjectIdParams("pageId"));

/**
 * @openapi
 * /workspaces/{workspaceId}/pages:
 *   get:
 *     summary: List pages in a workspace
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Array of pages }
 */
pageRoutes.get("/", async (req: WorkspaceScopedRequest, res) => {
  const pages = await PageService.listForWorkspace(req.params.workspaceId);
  res.json(pages);
});

/**
 * @openapi
 * /workspaces/{workspaceId}/pages/{pageId}:
 *   get:
 *     summary: Get a single page
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *       - { name: pageId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Page found }
 *       404: { description: Page not found (or belongs to another workspace) }
 *   patch:
 *     summary: Update a page's title, content, or parent
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *       - { name: pageId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Page updated }
 *       400: { description: "Invalid parentId (self, a descendant, or another workspace's page)" }
 *   delete:
 *     summary: Delete a page and cascade-delete its descendants (admin+ only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *       - { name: pageId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       204: { description: Deleted (or already didn't exist) }
 */
pageRoutes.get("/:pageId", async (req: WorkspaceScopedRequest, res) => {
  const page = await PageService.get(req.params.workspaceId, req.params.pageId);
  if (!page) return res.status(404).json({ error: "Page not found" });
  res.json(page);
});

const createSchema = z.object({
  title: z.string().min(1).max(200),
  contentJson: z.unknown().optional(),
  parentId: z.string().nullable().optional(),
});

/**
 * @openapi
 * /workspaces/{workspaceId}/pages:
 *   post:
 *     summary: Create a page (optionally nested under a parent page)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               contentJson: { type: object }
 *               parentId: { type: string, nullable: true }
 *     responses:
 *       201: { description: Page created }
 */
pageRoutes.post("/", requireRole("member"), async (req: WorkspaceScopedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const page = await PageService.create(req.params.workspaceId, req.userId!, parsed.data);
  res.status(201).json(page);
});

pageRoutes.patch("/:pageId", requireRole("member"), async (req: WorkspaceScopedRequest, res) => {
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const page = await PageService.update(
    req.params.workspaceId,
    req.userId!,
    req.params.pageId,
    parsed.data,
  );
  if (!page) return res.status(404).json({ error: "Page not found" });
  res.json(page);
});

pageRoutes.delete("/:pageId", requireRole("admin"), async (req: WorkspaceScopedRequest, res) => {
  await PageService.delete(req.params.workspaceId, req.userId!, req.params.pageId);
  res.status(204).send();
});
