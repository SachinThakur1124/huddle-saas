import { Job } from "bullmq";
import { Page } from "../models/Page";

interface ReindexJobData {
  entityType: "page" | "card" | "message";
  entityId: string;
}

/**
 * Mongo text indexes update automatically on write, so there is no separate
 * index to rebuild; this job's real job is to bump `updatedAt` so any
 * downstream cache (e.g. a search results cache) knows the document changed.
 */
export async function searchReindexProcessor(job: Job<ReindexJobData>) {
  const { entityType, entityId } = job.data;
  if (entityType === "page") {
    await Page.findByIdAndUpdate(entityId, { updatedAt: new Date() });
  }
}
