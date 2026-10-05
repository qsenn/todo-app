import { NextResponse, type NextRequest } from "next/server";
import {
  appOrigin,
  configErrorResponse,
  authorizeUrl,
  CALLBACK_PATH,
  githubConfig,
  newState,
  STATE_COOKIE,
} from "@/lib/githubOAuth";

/** Starts GitHub login: remembers a random state in a cookie and sends the browser to GitHub. */
export async function GET(request: NextRequest) {
  try {
    const config = githubConfig();
    const state = newState();
    const response = NextResponse.redirect(authorizeUrl(config, `${appOrigin(request)}${CALLBACK_PATH}`, state), 302);
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/auth/github",
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    return configErrorResponse(error);
  }
}
