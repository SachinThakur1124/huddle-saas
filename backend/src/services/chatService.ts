import { Channel } from "../models/Channel";
import { Message } from "../models/Message";

interface ListOptions {
  limit?: number;
  before?: string; // opaque cursor: the _id of the oldest message already seen
}

export const ChatService = {
  async createChannel(workspaceId: string, name: string) {
    return Channel.create({ workspaceId, name });
  },

  async postMessage(channelId: string, authorId: string, workspaceId: string, body: string) {
    return Message.create({ channelId, authorId, workspaceId, body });
  },

  async listMessages(channelId: string, options: ListOptions) {
    const limit = options.limit ?? 25;
    const query: Record<string, unknown> = { channelId };
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
