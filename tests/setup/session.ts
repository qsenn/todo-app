import { createSession, SESSION_COOKIE, upsertGithubUser } from "@/lib/auth";

/** Session of the default test user, recreated before every test. */
export const testAuth = { cookie: "", userId: "" };

let nextGithubId = 1000;

/** Creates a GitHub user with a live session and returns its Cookie header value. */
export async function loginAs(username: string) {
  const user = await upsertGithubUser({ id: nextGithubId++, login: username, avatar_url: `https://avatars.example/${username}.png` });
  const { token } = await createSession(user!._id);
  return { cookie: `${SESSION_COOKIE}=${token}`, token, userId: String(user!._id) };
}
