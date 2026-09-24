import { Job } from "bullmq";
import { Membership } from "../models/Membership";
import { Notification } from "../models/Notification";

export function extractMentions(body: string): string[] {
  const matches = body.match(/@([a-zA-Z0-9_.]+)/g) ?? [];
  return matches.map((m) => m.slice(1));
}

interface MentionJobData {
  body: string;
  authorId: string;
  workspaceId: string;
  messageId: string;
}

interface PopulatedUser {
  _id: unknown;
  email: string;
}

export async function mentionProcessor(job: Job<MentionJobData>) {
  const { body, workspaceId, messageId } = job.data;
  const handles = extractMentions(body);
  if (handles.length === 0) return;

  const handleSet = new Set(handles.map((h) => h.toLowerCase()));

  // Only notify people who are actually members of THIS workspace — a
  // system-wide email lookup would let a message in one workspace notify
  // (and confirm the existence of) a user who has nothing to do with it.
  const memberships = await Membership.find({ workspaceId }).populate<{
    userId: PopulatedUser;
  }>("userId");

  const matched = memberships.filter((m) => {
    const localPart = m.userId.email.split("@")[0]?.toLowerCase();
    return localPart !== undefined && handleSet.has(localPart);
  });

  await Promise.all(
    matched.map((m) =>
      Notification.create({
        userId: m.userId._id,
        workspaceId,
        type: "mention",
        payload: { messageId },
      }),
    ),
  );
}
