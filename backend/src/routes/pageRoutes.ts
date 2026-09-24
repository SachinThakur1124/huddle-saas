import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { validateObjectIdParams } from "../middleware/validateObjectId";
import { PageService } from "../services/pageService";

export const pageRoutes = Router({ mergeParams: true });

pageRoutes.use(requireAuth, requireRole("viewer"));
pageRoutes.use("/:pageId", validateObjectIdParams("pageId"));

pageRoutes.get("/", async (req: WorkspaceScopedRequest, res) => {
  const pages = await PageService.listForWorkspace(req.params.workspaceId);
  res.json(pages);
});

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
