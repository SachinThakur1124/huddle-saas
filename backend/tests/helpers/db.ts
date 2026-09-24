import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { redisClient } from "../../src/lib/redis";
import { mentionQueue, searchReindexQueue } from "../../src/jobs/queues";

let replSet: MongoMemoryReplSet;

export async function connectTestDb() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri(), { dbName: "test" });
  // Mongoose builds each model's indexes (including text indexes) in the
  // background on connect; a $text query issued before that finishes fails
  // with "text index required for $text query". Wait for every registered
  // model's indexes before returning, so any test can safely run search.
  await Promise.all(
    Object.values(mongoose.connection.models).map((m) => m.init()),
  );
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
