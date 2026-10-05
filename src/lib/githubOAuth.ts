// GitHub OAuth (web application flow). Credentials come only from the environment.
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const STATE_COOKIE = "kgt_oauth_state";
export const CALLBACK_PATH = "/auth/github/callback";

class OAuthConfigError extends Error {}

/** Turns a missing-configuration error into a 500 with setup instructions; rethrows anything else. */
export function configErrorResponse(error: unknown): Response {
  if (error instanceof OAuthConfigError) return new Response(error.message, { status: 500 });
  throw error;
}

type GithubConfig = { clientId: string; clientSecret: string; oauthBase: string; apiBase: string };
type GithubProfile = { id: number; login: string; avatar_url: string };

export function githubConfig(): GithubConfig {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new OAuthConfigError(
      "GitHub OAuth가 설정되지 않았습니다. GITHUB_CLIENT_ID와 GITHUB_CLIENT_SECRET 환경 변수를 설정하세요 (docs/GITHUB_OAUTH.md 참고).",
    );
  }
  return {
    clientId,
    clientSecret,
    // Overridable so tests can point at a fake GitHub.
    oauthBase: process.env.GITHUB_OAUTH_URL ?? "https://github.com",
    apiBase: process.env.GITHUB_API_URL ?? "https://api.github.com",
  };
}

/** Public origin of this app: APP_URL when set (so the callback URL matches the OAuth App), else the request's. */
export function appOrigin(request: NextRequest): string {
  return (process.env.APP_URL || request.nextUrl.origin).replace(/\/+$/, "");
}

export const newState = () => randomBytes(16).toString("base64url");

export function statesMatch(expected: string | undefined, actual: string | null): boolean {
  if (!expected || !actual) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function authorizeUrl(config: GithubConfig, redirectUri: string, state: string): URL {
  const url = new URL("/login/oauth/authorize", config.oauthBase);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);
  return url;
}

/** Exchanges the authorization code for an access token, which is used once and never stored. */
export async function exchangeCode(config: GithubConfig, code: string, redirectUri: string): Promise<string> {
  const response = await fetch(new URL("/login/oauth/access_token", config.oauthBase), {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!response.ok || !body.access_token) throw new Error(`GitHub token exchange failed: ${body.error ?? response.status}`);
  return body.access_token;
}

export async function fetchGithubUser(config: GithubConfig, accessToken: string): Promise<GithubProfile> {
  const response = await fetch(new URL("/user", config.apiBase), {
    headers: { accept: "application/vnd.github+json", authorization: `Bearer ${accessToken}`, "user-agent": "todo-app" },
  });
  if (!response.ok) throw new Error(`GitHub user request failed: ${response.status}`);
  const user = (await response.json()) as Partial<GithubProfile>;
  if (typeof user.id !== "number" || !user.login) throw new Error("GitHub user response is missing id or login");
  return { id: user.id, login: user.login, avatar_url: user.avatar_url ?? "" };
}
