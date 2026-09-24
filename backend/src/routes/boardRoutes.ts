import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { validateObjectIdParams } from "../middleware/validateObjectId";
import { BoardService } from "../services/boardService";
import { emitToWorkspace } from "../sockets/index";

export const boardRoutes = Router({ mergeParams: true });

boardRoutes.use(requireAuth, requireRole("viewer"));

const createBoardSchema = z.object({ title: z.string().min(1).max(100) });

boardRoutes.get("/", async (req: WorkspaceScopedRequest, res) => {
  const boards = await BoardService.listBoards(req.params.workspaceId);
  res.json(boards);
});

boardRoutes.post("/", requireRole("member"), async (req: WorkspaceScopedRequest, res) => {
  const parsed = createBoardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const board = await BoardService.createBoard(
    req.params.workspaceId,
    req.userId!,
    parsed.data.title,
  );
  res.status(201).json(board);
});

boardRoutes.get(
  "/:boardId",
  validateObjectIdParams("boardId"),
  async (req: WorkspaceScopedRequest, res) => {
    const result = await BoardService.getBoard(req.params.workspaceId, req.params.boardId);
    if (!result) return res.status(404).json({ error: "Board not found" });
    res.json(result);
  },
);

boardRoutes.post(
  "/:boardId/lists",
  validateObjectIdParams("boardId"),
  requireRole("member"),
  async (req: WorkspaceScopedRequest, res) => {
    const parsed = createBoardSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const list = await BoardService.createList(
      req.params.workspaceId,
      req.params.boardId,
      parsed.data.title,
    );
    res.status(201).json(list);
  },
);

boardRoutes.post(
  "/:boardId/lists/:listId/cards",
  validateObjectIdParams("boardId", "listId"),
  requireRole("member"),
  async (req: WorkspaceScopedRequest, res) => {
    const parsed = createBoardSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const card = await BoardService.createCard(
      req.params.workspaceId,
      req.userId!,
      req.params.listId,
      parsed.data.title,
    );
    res.status(201).json(card);
  },
);

const moveSchema = z.object({
  toListId: z.string().min(1),
  toPosition: z.number().int().min(0),
});

boardRoutes.post(
  "/cards/:cardId/move",
  validateObjectIdParams("cardId"),
  requireRole("member"),
  async (req: WorkspaceScopedRequest, res) => {
    const parsed = moveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    if (!/^[a-f0-9]{24}$/i.test(parsed.data.toListId)) {
      return res.status(400).json({ error: "Invalid toListId" });
    }
    await BoardService.moveCard(
      req.params.workspaceId,
      req.userId!,
      req.params.cardId,
      parsed.data.toListId,
      parsed.data.toPosition,
    );
    emitToWorkspace(req.params.workspaceId, "card:moved", {
      cardId: req.params.cardId,
      toListId: parsed.data.toListId,
      toPosition: parsed.data.toPosition,
    });
    res.status(200).json({ ok: true });
  },
);

boardRoutes.get(
  "/:boardId/stats",
  validateObjectIdParams("boardId"),
  async (req: WorkspaceScopedRequest, res) => {
    const stats = await BoardService.getStats(req.params.workspaceId, req.params.boardId);
    res.json(stats);
  },
);
