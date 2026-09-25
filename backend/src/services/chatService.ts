import { Channel } from "../models/Channel";
import { Message } from "../models/Message";
import { withTransaction } from "../lib/withTransaction";
import { AuditService } from "./auditService";
import { HttpError } from "../lib/httpError";

interface ListOptions {
  limit?: number;
  before?: string; // opaque cursor: the _id of the oldest message already seen
}

const MAX_LIMIT = 100;

export const ChatService = {
  async createChannel(workspaceId: string, name: string) {
    return Channel.create({ workspaceId, name });
  },

  async listChannels(workspaceId: string) {
    return Channel.find({ workspaceId }).sort({ createdAt: 1 });
  },

  async postMessage(workspaceId: string, channelId: string, authorId: string, body: string) {
    const channel = await Channel.exists({ _id: channelId, workspaceId });
    if (!channel) throw new HttpError(404, "Channel not found");
    return Message.create({ channelId, authorId, workspaceId, body });
  },

  async deleteChannel(workspaceId: string, actorId: string, channelId: string) {
    return withTransaction(async (session) => {
      const channel = await Channel.findOne({ _id: channelId, workspaceId }).session(session);
      if (!channel) throw new HttpError(404, "Channel not found");

      await Message.deleteMany({ channelId }, { session });
      await Channel.deleteOne({ _id: channelId }, { session });

      await AuditService.record({
        actorId,
        workspaceId,
        action: "channel.deleted",
        targetType: "Channel",
        targetId: channel._id,
        session,
      });
    });
  },

  async listMessages(workspaceId: string, channelId: string, options: ListOptions) {
    const channel = await Channel.exists({ _id: channelId, workspaceId });
    if (!channel) throw new HttpError(404, "Channel not found");

    const rawLimit = options.limit ?? 25;
    const limit = Math.min(Math.max(1, rawLimit), MAX_LIMIT);
    const query: Record<string, unknown> = { channelId, workspaceId };
    if (options.before) {
      query._id = { $lt: options.before };
    }
    const rows = await Message.find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .lean();

    return {
      messages: rows.reverse(),
      nextCursor: rows.length === limit ? rows[0]._id.toString() : null,
    };
  },
};
