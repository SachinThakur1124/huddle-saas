import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { ChatService } from "../services/chatService";
import { emitToWorkspace } from "../sockets/index";

export const chatRoutes = Router({ mergeParams: true });

chatRoutes.use(requireAuth, requireRole("viewer"));

const createChannelSchema = z.object({ name: z.string().min(1).max(80) });

chatRoutes.post("/", requireRole("member"), async (req: WorkspaceScopedRequest, res) => {
  const parsed = createChannelSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const channel = await ChatService.createChannel(req.params.workspaceId, parsed.data.name);
  res.status(201).json(channel);
});

const messageSchema = z.object({ body: z.string().min(1).max(4000) });

chatRoutes.post(
  "/:channelId/messages",
  requireRole("member"),
  async (req: WorkspaceScopedRequest, res) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const message = await ChatService.postMessage(
      req.params.channelId,
      req.userId!,
      req.params.workspaceId,
      parsed.data.body,
    );
    emitToWorkspace(req.params.workspaceId, "message:new", message);
    res.status(201).json(message);
  },
);

chatRoutes.get("/:channelId/messages", async (req: WorkspaceScopedRequest, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const before = typeof req.query.before === "string" ? req.query.before : undefined;
  const page = await ChatService.listMessages(req.params.channelId, { limit, before });
  res.json(page);
});
