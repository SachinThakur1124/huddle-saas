import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { redisClient } from "../../src/lib/redis";
import { mentionQueue, searchReindexQueue } from "../../src/jobs/queues";

let replSet: MongoMemoryReplSet;

export async function connectTestDb() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri(), { dbName: "test" });
}

export async function clearTestDb() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

export async function disconnectTestDb() {
  await mongoose.disconnect();
  await replSet.stop();
  redisClient.disconnect();
  // app.ts pulls in chatRoutes -> jobs/queues.ts unconditionally, so every
  // route test file that calls createApp() opens these two BullMQ/ioredis
  // connections at import time, whether or not it exercises chat endpoints.
  await mentionQueue.close();
  await searchReindexQueue.close();
}
