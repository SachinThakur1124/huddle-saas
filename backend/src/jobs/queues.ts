import { Queue } from "bullmq";
import { env } from "../config/env";

const connection = { url: env.REDIS_URL };

export const mentionQueue = new Queue("mention-notification", { connection });
export const searchReindexQueue = new Queue("search-reindex", { connection });
