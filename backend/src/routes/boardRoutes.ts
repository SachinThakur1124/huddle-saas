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

/**
 * @openapi
 * /workspaces/{workspaceId}/boards:
 *   get:
 *     summary: List boards in a workspace
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Array of boards }
 *   post:
 *     summary: Create a board
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
 *     responses:
 *       201: { description: Board created }
 */
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

/**
 * @openapi
 * /workspaces/{workspaceId}/boards/{boardId}:
 *   get:
 *     summary: Get a board with its lists and cards
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *       - { name: boardId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: "{ board, lists, cards }" }
 *       404: { description: Board not found (or belongs to another workspace) }
 */
boardRoutes.get(
  "/:boardId",
  validateObjectIdParams("boardId"),
  async (req: WorkspaceScopedRequest, res) => {
    const result = await BoardService.getBoard(req.params.workspaceId, req.params.boardId);
    if (!result) return res.status(404).json({ error: "Board not found" });
    res.json(result);
  },
);

/**
 * @openapi
 * /workspaces/{workspaceId}/boards/{boardId}:
 *   delete:
 *     summary: Delete a board and cascade-delete its lists and cards (admin+ only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *       - { name: boardId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       204: { description: Deleted }
 *       404: { description: Board not found (or belongs to another workspace) }
 */
boardRoutes.delete(
  "/:boardId",
  validateObjectIdParams("boardId"),
  requireRole("admin"),
  async (req: WorkspaceScopedRequest, res) => {
    await BoardService.deleteBoard(req.params.workspaceId, req.userId!, req.params.boardId);
    emitToWorkspace(req.params.workspaceId, "board:deleted", { boardId: req.params.boardId });
    res.status(204).send();
  },
);

/**
 * @openapi
 * /workspaces/{workspaceId}/boards/{boardId}/lists:
 *   post:
 *     summary: Create a list on a board
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *       - { name: boardId, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *     responses:
 *       201: { description: List created }
 *       404: { description: Board not found }
 */
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

/**
 * @openapi
 * /workspaces/{workspaceId}/boards/{boardId}/lists/{listId}:
 *   delete:
 *     summary: Delete a list and cascade-delete its cards, closing the position gap left in the board's remaining lists
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *       - { name: boardId, in: path, required: true, schema: { type: string } }
 *       - { name: listId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       204: { description: Deleted }
 *       404: { description: List not found (or belongs to a different board/workspace) }
 */
boardRoutes.delete(
  "/:boardId/lists/:listId",
  validateObjectIdParams("boardId", "listId"),
  requireRole("member"),
  async (req: WorkspaceScopedRequest, res) => {
    await BoardService.deleteList(
      req.params.workspaceId,
      req.userId!,
      req.params.boardId,
      req.params.listId,
    );
    emitToWorkspace(req.params.workspaceId, "list:deleted", { listId: req.params.listId });
    res.status(204).send();
  },
);

/**
 * @openapi
 * /workspaces/{workspaceId}/boards/{boardId}/lists/{listId}/cards:
 *   post:
 *     summary: Create a card at the end of a list
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *       - { name: boardId, in: path, required: true, schema: { type: string } }
 *       - { name: listId, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *     responses:
 *       201: { description: Card created }
 *       404: { description: List not found }
 */
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

/**
 * @openapi
 * /workspaces/{workspaceId}/boards/cards/{cardId}/move:
 *   post:
 *     summary: Move a card to a (possibly different) list and position, keeping positions dense in both lists (broadcasts card:moved over Socket.io)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *       - { name: cardId, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [toListId, toPosition]
 *             properties:
 *               toListId: { type: string }
 *               toPosition: { type: integer, minimum: 0 }
 *     responses:
 *       200: { description: "{ ok: true }" }
 *       404: { description: Card or target list not found }
 */
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

/**
 * @openapi
 * /workspaces/{workspaceId}/boards/cards/{cardId}:
 *   delete:
 *     summary: Delete a card, closing the position gap left in its list
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *       - { name: cardId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       204: { description: Deleted }
 *       404: { description: Card not found (or belongs to another workspace) }
 */
boardRoutes.delete(
  "/cards/:cardId",
  validateObjectIdParams("cardId"),
  requireRole("member"),
  async (req: WorkspaceScopedRequest, res) => {
    await BoardService.deleteCard(req.params.workspaceId, req.userId!, req.params.cardId);
    emitToWorkspace(req.params.workspaceId, "card:deleted", { cardId: req.params.cardId });
    res.status(204).send();
  },
);

/**
 * @openapi
 * /workspaces/{workspaceId}/boards/{boardId}/stats:
 *   get:
 *     summary: Card counts per list on a board (Mongo aggregation)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *       - { name: boardId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: "Array of { listId, count }" }
 */
boardRoutes.get(
  "/:boardId/stats",
  validateObjectIdParams("boardId"),
  async (req: WorkspaceScopedRequest, res) => {
    const stats = await BoardService.getStats(req.params.workspaceId, req.params.boardId);
    res.json(stats);
  },
);
