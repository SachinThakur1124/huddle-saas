import { Channel } from "../models/Channel";
import { Message } from "../models/Message";
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
