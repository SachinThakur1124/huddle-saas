import { PermissionCache } from "../../src/services/permissionCache";

class FakeRedis {
  private store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.store.set(key, value);
    return "OK";
  }
  async del(key: string) {
    this.store.delete(key);
    return 1;
  }
}

describe("PermissionCache", () => {
  it("caches and returns a role", async () => {
    const cache = new PermissionCache(new FakeRedis() as never);
    await cache.set("u1", "w1", "admin");
    expect(await cache.get("u1", "w1")).toBe("admin");
  });

  it("returns null on cache miss", async () => {
    const cache = new PermissionCache(new FakeRedis() as never);
    expect(await cache.get("nope", "w1")).toBeNull();
  });

  it("invalidate clears the entry", async () => {
    const cache = new PermissionCache(new FakeRedis() as never);
    await cache.set("u1", "w1", "owner");
    await cache.invalidate("u1", "w1");
    expect(await cache.get("u1", "w1")).toBeNull();
  });
});
