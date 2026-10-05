import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE, type AuthUser } from "./auth";
import { connectDB } from "./db";

/** The logged-in user for a Server Component, or null. */
export async function currentUser(): Promise<AuthUser | null> {
  // Read the cookie first: it marks the page as request-time rendered, so the build never needs a
  // database, and visitors without a session cookie skip the database entirely.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await connectDB();
  return getSessionUser(token);
}
