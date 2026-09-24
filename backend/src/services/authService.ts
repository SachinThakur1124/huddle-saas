import argon2 from "argon2";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User, UserDoc } from "../models/User";
import { RefreshToken } from "../models/RefreshToken";
import { env } from "../config/env";

const ACCESS_TTL = "15m";
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function issueAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TTL,
  });
}

async function issueRefreshToken(userId: string, familyId: string) {
  const raw = crypto.randomBytes(40).toString("hex");
  await RefreshToken.create({
    userId,
    familyId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return raw;
}

function toPublicUser(u: UserDoc) {
  return { id: u._id.toString(), email: u.email, name: u.name };
}

export const AuthService = {
  async register(email: string, password: string, name: string) {
    const existing = await User.findOne({ email });
    if (existing) throw new Error("Email already registered");

    const passwordHash = await argon2.hash(password);
    const user = await User.create({ email, passwordHash, name });
    const familyId = crypto.randomUUID();
    const accessToken = issueAccessToken(user._id.toString());
    const refreshToken = await issueRefreshToken(user._id.toString(), familyId);
    return { user: toPublicUser(user), accessToken, refreshToken };
  },

  async login(email: string, password: string) {
    const user = await User.findOne({ email });
    if (!user) throw new Error("Invalid email or password");
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new Error("Invalid email or password");

    const familyId = crypto.randomUUID();
    const accessToken = issueAccessToken(user._id.toString());
    const refreshToken = await issueRefreshToken(user._id.toString(), familyId);
    return { user: toPublicUser(user), accessToken, refreshToken };
  },

  async refresh(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    const record = await RefreshToken.findOne({ tokenHash });
    if (!record) throw new Error("Invalid refresh token");

    if (record.revoked) {
      await RefreshToken.updateMany(
        { familyId: record.familyId },
        { revoked: true },
      );
      throw new Error("Refresh token has been revoked (reuse detected)");
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new Error("Refresh token expired");
    }

    record.revoked = true;
    await record.save();

    const accessToken = issueAccessToken(record.userId.toString());
    const refreshToken = await issueRefreshToken(
      record.userId.toString(),
      record.familyId,
    );
    return { accessToken, refreshToken };
  },

  async logout(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    const record = await RefreshToken.findOne({ tokenHash });
    if (record) {
      await RefreshToken.updateMany(
        { familyId: record.familyId },
        { revoked: true },
      );
    }
  },

  verifyAccessToken(token: string): { sub: string } {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string };
  },
};
