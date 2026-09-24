import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { AuthService } from "../../src/services/authService";
import { RefreshToken } from "../../src/models/RefreshToken";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("AuthService", () => {
  it("registers a user and returns a token pair", async () => {
    const result = await AuthService.register("a@x.com", "password123", "Ada");
    expect(result.user.email).toBe("a@x.com");
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
  });

  it("rejects duplicate email registration", async () => {
    await AuthService.register("dup@x.com", "password123", "Ada");
    await expect(
      AuthService.register("dup@x.com", "password123", "Ada"),
    ).rejects.toThrow(/already/i);
  });

  it("logs in with correct credentials", async () => {
    await AuthService.register("login@x.com", "password123", "Ada");
    const result = await AuthService.login("login@x.com", "password123");
    expect(result.accessToken).toEqual(expect.any(String));
  });

  it("rejects login with wrong password", async () => {
    await AuthService.register("wrong@x.com", "password123", "Ada");
    await expect(
      AuthService.login("wrong@x.com", "wrong-password"),
    ).rejects.toThrow(/invalid/i);
  });

  it("rotates refresh tokens and revokes the family on reuse", async () => {
    const { refreshToken } = await AuthService.register(
      "rotate@x.com",
      "password123",
      "Ada",
    );
    const rotated = await AuthService.refresh(refreshToken);
    expect(rotated.refreshToken).not.toBe(refreshToken);

    await expect(AuthService.refresh(refreshToken)).rejects.toThrow(
      /reuse|revoked/i,
    );
    await expect(AuthService.refresh(rotated.refreshToken)).rejects.toThrow(
      /revoked/i,
    );

    const tokens = await RefreshToken.find({});
    expect(tokens.every((t) => t.revoked)).toBe(true);
  });

  it("only one of two concurrent refreshes with the same token succeeds", async () => {
    const { refreshToken } = await AuthService.register(
      "concurrent@x.com",
      "password123",
      "Ada",
    );

    const results = await Promise.allSettled([
      AuthService.refresh(refreshToken),
      AuthService.refresh(refreshToken),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);
  });
});
