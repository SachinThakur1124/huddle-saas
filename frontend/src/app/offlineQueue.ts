import { openDB, IDBPDatabase } from "idb";

export interface QueuedMessage {
  id: string;
  workspaceId: string;
  channelId: string;
  body: string;
}

const DB_NAME = "huddle-offline";
const STORE = "outbound-messages";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export async function enqueue(message: QueuedMessage) {
  const db = await getDb();
  await db.put(STORE, message);
}

export async function flushQueue(send: (message: QueuedMessage) => Promise<void>) {
  const db = await getDb();
  const all = await db.getAll(STORE);
  for (const message of all) {
    await send(message);
    await db.delete(STORE, message.id);
  }
}
