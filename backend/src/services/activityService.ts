import mongoose from "mongoose";
import { Page } from "../models/Page";
import { Card } from "../models/Card";
import { Message } from "../models/Message";

export interface ActivityEntry {
  type: "page" | "card" | "message";
  id: string;
  workspaceId: string;
  title: string;
  createdAt: Date;
}

const DEFAULT_LIMIT = 20;

export const ActivityService = {
  async getRecent(workspaceId: string, limit = DEFAULT_LIMIT): Promise<ActivityEntry[]> {
    const wsId = new mongoose.Types.ObjectId(workspaceId);

    const [pages, cards, messages] = await Promise.all([
      Page.find({ workspaceId: wsId }).sort({ createdAt: -1 }).limit(limit).lean(),
      Card.find({ workspaceId: wsId }).sort({ createdAt: -1 }).limit(limit).lean(),
      Message.find({ workspaceId: wsId }).sort({ createdAt: -1 }).limit(limit).lean(),
    ]);

    const entries: ActivityEntry[] = [
      ...pages.map((p) => ({
        type: "page" as const,
        id: p._id.toString(),
        workspaceId: p.workspaceId.toString(),
        title: p.title,
        createdAt: p.createdAt,
      })),
      ...cards.map((c) => ({
        type: "card" as const,
        id: c._id.toString(),
        workspaceId: c.workspaceId.toString(),
        title: c.title,
        createdAt: c.createdAt,
      })),
      ...messages.map((m) => ({
        type: "message" as const,
        id: m._id.toString(),
        workspaceId: m.workspaceId.toString(),
        title: m.body.slice(0, 80),
        createdAt: m.createdAt,
      })),
    ];

    return entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  },
};
