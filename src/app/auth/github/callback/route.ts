import { NextResponse, type NextRequest } from "next/server";
import { createSession, deleteSession, SESSION_COOKIE, sessionCookieOptions, upsertGithubUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  appOrigin,
  configErrorResponse,
  CALLBACK_PATH,
  exchangeCode,
  fetchGithubUser,
  githubConfig,
  STATE_COOKIE,
  statesMatch,
} from "@/lib/githubOAuth";

/** Redirects to the login page with a reason and drops the one-time state cookie. */
function failLogin(origin: string, reason: string) {
  const response = NextResponse.redirect(`${origin}/login?error=${reason}`);
  response.cookies.set(STATE_COOKIE, "", { path: "/auth/github", maxAge: 0 });
  return response;
}

/** GitHub sends the browser back here with ?code&state after the user approves. */
export async function GET(request: NextRequest) {
  let config;
  let origin;
  try {
    config = githubConfig();
    origin = appOrigin(request);
  } catch (error) {
    return configErrorResponse(error);
  }

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return failLogin(origin, "denied");
  if (!statesMatch(request.cookies.get(STATE_COOKIE)?.value, params.get("state"))) return failLogin(origin, "state");
  const code = params.get("code");
  if (!code) return failLogin(origin, "code");

  let profile;
  try {
    const accessToken = await exchangeCode(config, code, `${origin}${CALLBACK_PATH}`);
    profile = await fetchGithubUser(config, accessToken);
  } catch (error) {
    console.error(error);
    return failLogin(origin, "github");
  }

  await connectDB();
  // Logging in again replaces any session this browser already had.
  await deleteSession(request.cookies.get(SESSION_COOKIE)?.value);
  const user = await upsertGithubUser(profile);
  const { token, expiresAt } = await createSession(user!._id);

  const response = NextResponse.redirect(`${origin}/`);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  response.cookies.set(STATE_COOKIE, "", { path: "/auth/github", maxAge: 0 });
  return response;
}
