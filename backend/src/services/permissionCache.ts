export const ROLE_ORDER = ["viewer", "member", "admin", "owner"] as const;
export type Role = (typeof ROLE_ORDER)[number];

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

const TTL_SECONDS = 300;

function key(userId: string, workspaceId: string) {
  return `membership:${userId}:${workspaceId}`;
}

export class PermissionCache {
  constructor(private client: RedisLike) {}

  async get(userId: string, workspaceId: string): Promise<Role | null> {
    const value = await this.client.get(key(userId, workspaceId));
    return (value as Role) ?? null;
  }

  async set(userId: string, workspaceId: string, role: Role): Promise<void> {
    await this.client.set(key(userId, workspaceId), role, "EX", TTL_SECONDS);
  }

  async invalidate(userId: string, workspaceId: string): Promise<void> {
    await this.client.del(key(userId, workspaceId));
  }
}
