// Prevent the real .env file on disk from repopulating deleted keys —
// this test needs full control over process.env.
jest.mock("dotenv/config", () => ({}));

describe("env config", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("throws instead of using the dev fallback secret when NODE_ENV=production and no secret is set", () => {
    process.env.NODE_ENV = "production";
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    process.env.MONGO_URI = "mongodb://real-prod-host/huddle";
    process.env.REDIS_URL = "redis://real-prod-host:6379";

    expect(() => require("../../src/config/env")).toThrow(/JWT_ACCESS_SECRET/);
  });

  it("still allows the dev fallback outside production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.JWT_ACCESS_SECRET;

    const { env } = require("../../src/config/env");
    expect(env.JWT_ACCESS_SECRET).toBe("dev-access-secret");
  });
});
