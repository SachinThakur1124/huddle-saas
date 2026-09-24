import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { validateObjectIdParams } from "../middleware/validateObjectId";
import { ChatService } from "../services/chatService";
import { emitToWorkspace } from "../sockets/index";
import { mentionQueue } from "../jobs/queues";

export const chatRoutes = Router({ mergeParams: true });

chatRoutes.use(requireAuth, requireRole("viewer"));

const createChannelSchema = z.object({ name: z.string().min(1).max(80) });

chatRoutes.get("/", async (req: WorkspaceScopedRequest, res) => {
  const channels = await ChatService.listChannels(req.params.workspaceId);
  res.json(channels);
});

chatRoutes.post("/", requireRole("member"), async (req: WorkspaceScopedRequest, res) => {
  const parsed = createChannelSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const channel = await ChatService.createChannel(req.params.workspaceId, parsed.data.name);
  res.status(201).json(channel);
});

const messageSchema = z.object({ body: z.string().min(1).max(4000) });

/**
 * @openapi
 * /workspaces/{workspaceId}/channels/{channelId}/messages:
 *   post:
 *     summary: Post a message to a channel (broadcasts message:new over Socket.io)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *       - { name: channelId, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body: { type: string, maxLength: 4000 }
 *     responses:
 *       201: { description: Message created }
 *       404: { description: Channel not found (or belongs to another workspace) }
 *   get:
 *     summary: List messages in a channel, newest page first, oldest-first within the page
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *       - { name: channelId, in: path, required: true, schema: { type: string } }
 *       - { name: before, in: query, required: false, schema: { type: string }, description: "Cursor — the _id of the oldest message already seen" }
 *       - { name: limit, in: query, required: false, schema: { type: integer, minimum: 1, maximum: 100 } }
 *     responses:
 *       200: { description: "{ messages, nextCursor }" }
 */
chatRoutes.post(
  "/:channelId/messages",
  validateObjectIdParams("channelId"),
  requireRole("member"),
  async (req: WorkspaceScopedRequest, res) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const message = await ChatService.postMessage(
      req.params.workspaceId,
      req.params.channelId,
      req.userId!,
      parsed.data.body,
    );
    emitToWorkspace(req.params.workspaceId, "message:new", message);
    await mentionQueue.add("mention", {
      body: parsed.data.body,
      authorId: req.userId,
      workspaceId: req.params.workspaceId,
      messageId: message._id.toString(),
    });
    res.status(201).json(message);
  },
);

chatRoutes.get(
  "/:channelId/messages",
  validateObjectIdParams("channelId"),
  async (req: WorkspaceScopedRequest, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const before = typeof req.query.before === "string" ? req.query.before : undefined;
    const page = await ChatService.listMessages(req.params.workspaceId, req.params.channelId, {
      limit,
      before,
    });
    res.json(page);
  },
);
