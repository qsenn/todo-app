import { NextResponse, type NextRequest } from "next/server";
import { deleteSession, SESSION_COOKIE } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { appOrigin } from "@/lib/githubOAuth";

/** Deletes the session record and expires the cookie; 303 turns the form POST into a GET of /login. */
export async function POST(request: NextRequest) {
  const origin = appOrigin(request);
  // Browsers send Origin on form POSTs; refuse cross-site ones so other sites cannot log users out.
  const from = request.headers.get("origin");
  if (from && from !== origin) return new Response("Cross-origin logout is not allowed.", { status: 403 });

  await connectDB();
  await deleteSession(request.cookies.get(SESSION_COOKIE)?.value);
  const response = NextResponse.redirect(`${origin}/login`, 303);
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
