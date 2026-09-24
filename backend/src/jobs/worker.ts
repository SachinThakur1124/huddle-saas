import { Worker } from "bullmq";
import { env } from "../config/env";
import { mentionProcessor } from "./mentionProcessor";
import { searchReindexProcessor } from "./searchReindexProcessor";

const connection = { url: env.REDIS_URL };

export function startWorkers() {
  const mentionWorker = new Worker("mention-notification", mentionProcessor, { connection });
  const searchWorker = new Worker("search-reindex", searchReindexProcessor, { connection });
  return [mentionWorker, searchWorker];
}
