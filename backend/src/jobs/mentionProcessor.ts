import { Job } from "bullmq";
import { User } from "../models/User";
import { Notification } from "../models/Notification";

export function extractMentions(body: string): string[] {
  const matches = body.match(/@([a-zA-Z0-9_]+)/g) ?? [];
  return matches.map((m) => m.slice(1));
}

interface MentionJobData {
  body: string;
  authorId: string;
  workspaceId: string;
  messageId: string;
}

export async function mentionProcessor(job: Job<MentionJobData>) {
  const { body, workspaceId, messageId } = job.data;
  const handles = extractMentions(body);
  if (handles.length === 0) return;

  // "handle" maps to the local part of the email for demo purposes, since
  // the app has no separate @username field.
  const emailPrefixes = handles.map((h) => new RegExp(`^${h}@`, "i"));
  const users = await User.find({ email: { $in: emailPrefixes } });

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u._id,
        workspaceId,
        type: "mention",
        payload: { messageId },
      }),
    ),
  );
}
