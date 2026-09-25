import { openDB, IDBPDatabase } from "idb";

export type QueuedAction =
  | { id: string; kind: "message"; workspaceId: string; channelId: string; body: string }
  | { id: string; kind: "page"; workspaceId: string; title: string }
  | { id: string; kind: "board"; workspaceId: string; title: string }
  | { id: string; kind: "channel"; workspaceId: string; name: string }
  | { id: string; kind: "card"; workspaceId: string; boardId: string; listId: string; title: string };

type Dispatchers = { [K in QueuedAction["kind"]]: (action: Extract<QueuedAction, { kind: K }>) => Promise<unknown> };

const DB_NAME = "huddle-offline";
const STORE = "outbound-actions";

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

// A plain helper (not inlined at the call site) so `Date.now`/`Math.random`
// aren't textually present inside a component's render-reachable body —
// react-hooks/purity flags those as impure calls wherever a form's
// `handleSubmit(onSubmit)` wrapper makes the analyzer treat `onSubmit`'s
// body as render-reachable.
export function newActionId(): string {
  return `${Date.now()}-${Math.random()}`;
}

export async function enqueue(action: QueuedAction) {
  const db = await getDb();
  await db.put(STORE, action);
}

export async function queueSize(): Promise<number> {
  const db = await getDb();
  return db.count(STORE);
}

/**
 * Replays every queued action in ascending id order — IndexedDB's
 * `getAll()` returns records by key, not insertion order, so this only
 * matches creation order because `newActionId()`'s ids are
 * `Date.now()`-prefixed and therefore sort the way they were created.
 * Stops (rather
 * than skipping) on the first failure — if the connection dropped again
 * mid-flush, hammering through the rest of the queue against a dead
 * network just burns time; the next `online` event will resume from where
 * this left off, since the failed action (and everything after it) is
 * still in the store.
 */
export async function flushQueue(dispatchers: Dispatchers) {
  const db = await getDb();
  const all = (await db.getAll(STORE)) as QueuedAction[];
  for (const action of all) {
    const dispatch = dispatchers[action.kind] as (a: QueuedAction) => Promise<unknown>;
    try {
      await dispatch(action);
    } catch {
      return;
    }
    await db.delete(STORE, action.id);
  }
}
