import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { redisClient } from "../../src/lib/redis";

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
}
