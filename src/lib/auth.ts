// Cookie sessions backed by MongoDB. The cookie holds a random token; the database keeps its hash.
import { createHash, randomBytes } from "node:crypto";
import type { Types } from "mongoose";
import { Session } from "@/models/Session";
import { User } from "@/models/User";

export const SESSION_COOKIE = "kgt_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type AuthUser = { id: string; username: string; avatarUrl: string };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export async function createSession(userId: Types.ObjectId | string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await Session.create({ tokenHash: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

/** The user behind a session token, or null when the token is missing, unknown or expired. */
export async function getSessionUser(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).lean();
  if (!session) return null;
  const user = await User.findById(session.userId).lean();
  if (!user) return null;
  return { id: String(user._id), username: user.username, avatarUrl: user.avatarUrl };
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (token) await Session.deleteOne({ tokenHash: hashToken(token) });
}

/** Creates or refreshes the user for a GitHub account; the GitHub access token is never stored. */
export async function upsertGithubUser(profile: { id: number; login: string; avatar_url: string }) {
  return User.findOneAndUpdate(
    { githubId: profile.id },
    { $set: { username: profile.login, avatarUrl: profile.avatar_url ?? "" } },
    { upsert: true, returnDocument: "after", runValidators: true },
  ).lean();
}
