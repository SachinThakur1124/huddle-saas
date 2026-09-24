import { Page } from "../models/Page";
import { Card } from "../models/Card";
import { Message } from "../models/Message";

export interface SearchResult {
  type: "page" | "card" | "message";
  id: string;
  workspaceId: string;
  title: string;
  score: number;
}

export const SearchService = {
  async search(workspaceId: string, query: string): Promise<SearchResult[]> {
    const filter = { workspaceId, $text: { $search: query } };
    const projection = { score: { $meta: "textScore" } };

    const [pages, cards, messages] = await Promise.all([
      Page.find(filter, projection).sort(projection).limit(10).lean(),
      Card.find(filter, projection).sort(projection).limit(10).lean(),
      Message.find(filter, projection).sort(projection).limit(10).lean(),
    ]);

    const results: SearchResult[] = [
      ...pages.map((p) => ({
        type: "page" as const,
        id: p._id.toString(),
        workspaceId: p.workspaceId.toString(),
        title: p.title,
        score: (p as unknown as { score: number }).score,
      })),
      ...cards.map((c) => ({
        type: "card" as const,
        id: c._id.toString(),
        workspaceId: c.workspaceId.toString(),
        title: c.title,
        score: (c as unknown as { score: number }).score,
      })),
      ...messages.map((m) => ({
        type: "message" as const,
        id: m._id.toString(),
        workspaceId: m.workspaceId.toString(),
        title: m.body.slice(0, 80),
        score: (m as unknown as { score: number }).score,
      })),
    ];

    return results.sort((a, b) => b.score - a.score);
  },
};
