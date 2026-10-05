import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE, type AuthUser } from "./auth";
import { connectDB } from "./db";

/** The logged-in user for a Server Component, or null. */
export async function currentUser(): Promise<AuthUser | null> {
  await connectDB();
  return getSessionUser((await cookies()).get(SESSION_COOKIE)?.value);
}
