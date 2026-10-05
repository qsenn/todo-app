import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as start from "@/app/auth/github/route";
import * as callback from "@/app/auth/github/callback/route";
import * as logout from "@/app/auth/logout/route";
import { SESSION_COOKIE } from "@/lib/auth";
import { STATE_COOKIE } from "@/lib/githubOAuth";
import { Session } from "@/models/Session";
import { User } from "@/models/User";
import { client } from "./http";

const ORIGIN = "http://localhost:3000";

function req(path: string, { method = "GET", cookie, origin }: { method?: string; cookie?: string; origin?: string } = {}) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  return new NextRequest(new URL(path, ORIGIN), { method, headers });
}

/** Value of a Set-Cookie for `name`, plus its raw attributes. */
function setCookie(response: Response, name: string) {
  const raw = response.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  return raw ? { value: decodeURIComponent(raw.slice(name.length + 1).split(";")[0]), raw } : undefined;
}

type FakeGithub = { token?: { status?: number; body: unknown }; user?: { status?: number; body: unknown } };

function stubGithub(fake: FakeGithub) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (input: URL | string, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const reply = url.endsWith("/login/oauth/access_token") ? fake.token : url.endsWith("/user") ? fake.user : undefined;
    if (!reply) throw new Error(`unexpected fetch ${url}`);
    return Response.json(reply.body, { status: reply.status ?? 200 });
  });
  return calls;
}

async function begin() {
  const response = await start.GET(req("/auth/github"));
  const state = setCookie(response, STATE_COOKIE)!.value;
  return { response, state, cookie: `${STATE_COOKIE}=${state}` };
}

beforeEach(() => {
  vi.stubEnv("GITHUB_CLIENT_ID", "test-client-id");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "test-client-secret");
  vi.stubEnv("APP_URL", ORIGIN);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /auth/github", () => {
  it("redirects to GitHub with client_id, callback URL, scope and a random state kept in an httpOnly cookie", async () => {
    const { response, state } = await begin();
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(`${location.origin}${location.pathname}`).toBe("https://github.com/login/oauth/authorize");
    expect(location.searchParams.get("client_id")).toBe("test-client-id");
    expect(location.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/auth/github/callback`);
    expect(location.searchParams.get("scope")).toBe("read:user");
    expect(location.searchParams.get("state")).toBe(state);
    expect(state.length).toBeGreaterThanOrEqual(20);
    expect(response.headers.get("location")).not.toContain("test-client-secret");
    expect(setCookie(response, STATE_COOKIE)!.raw).toMatch(/HttpOnly/i);

    const second = await begin();
    expect(second.state).not.toBe(state);
  });

  it("explains missing configuration instead of redirecting", async () => {
    vi.stubEnv("GITHUB_CLIENT_SECRET", "");
    const response = await start.GET(req("/auth/github"));
    expect(response.status).toBe(500);
    expect(await response.text()).toContain("GITHUB_CLIENT_SECRET");
    vi.stubEnv("GITHUB_CLIENT_ID", "");
    expect((await callback.GET(req("/auth/github/callback?code=x&state=y"))).status).toBe(500);
  });

  it("requires APP_URL in production instead of trusting the Host header", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "");
    const evil = new NextRequest(new URL("/auth/github", "https://evil.example"));
    const response = await start.GET(evil);
    expect(response.status).toBe(500);
    expect(await response.text()).toContain("APP_URL");
    expect((await callback.GET(new NextRequest(new URL("/auth/github/callback?code=x&state=y", "https://evil.example")))).status).toBe(500);
    expect((await logout.POST(new NextRequest(new URL("/auth/logout", "https://evil.example"), { method: "POST" }))).status).toBe(500);
  });

  it("uses the request origin in development when APP_URL is unset", async () => {
    vi.stubEnv("APP_URL", "");
    const response = await start.GET(new NextRequest(new URL("/auth/github", "http://dev.local:4000")));
    expect(new URL(response.headers.get("location")!).searchParams.get("redirect_uri")).toBe(
      "http://dev.local:4000/auth/github/callback",
    );
  });
});

describe("GET /auth/github/callback", () => {
  const profile = { id: 4242, login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/4242" };

  it("exchanges the code, stores username and avatar, starts a session and redirects home", async () => {
    const calls = stubGithub({ token: { body: { access_token: "gh-token" } }, user: { body: profile } });
    const { state, cookie } = await begin();

    const response = await callback.GET(req(`/auth/github/callback?code=abc&state=${state}`, { cookie }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/`);

    const tokenCall = calls[0];
    expect(tokenCall.url).toBe("https://github.com/login/oauth/access_token");
    expect(JSON.parse(String(tokenCall.init!.body))).toMatchObject({
      client_id: "test-client-id",
      client_secret: "test-client-secret",
      code: "abc",
      redirect_uri: `${ORIGIN}/auth/github/callback`,
    });
    expect(calls[1].url).toBe("https://api.github.com/user");
    expect(new Headers(calls[1].init!.headers).get("authorization")).toBe("Bearer gh-token");

    const user = await User.findOne({ githubId: 4242 }).lean();
    expect(user).toMatchObject({ username: "octocat", avatarUrl: profile.avatar_url });
    expect(JSON.stringify(user)).not.toContain("gh-token");

    const session = setCookie(response, SESSION_COOKIE)!;
    expect(session.raw).toMatch(/HttpOnly/i);
    expect(session.raw).toMatch(/SameSite=lax/i);
    expect(session.raw).toMatch(/Path=\//);
    expect(setCookie(response, STATE_COOKIE)!.value).toBe("");
    expect(await Session.countDocuments({ userId: user!._id })).toBe(1);
    expect(await Session.exists({ tokenHash: session.value })).toBeNull(); // only the hash is stored

    const me = await client(() => `${SESSION_COOKIE}=${session.value}`).me();
    expect(me.body).toEqual({ username: "octocat", avatarUrl: profile.avatar_url });
  });

  it("marks the session cookie Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    stubGithub({ token: { body: { access_token: "gh-token" } }, user: { body: profile } });
    const { state, cookie } = await begin();
    const response = await callback.GET(req(`/auth/github/callback?code=abc&state=${state}`, { cookie }));
    expect(setCookie(response, SESSION_COOKIE)!.raw).toMatch(/Secure/i);
  });

  it("logging in again replaces the browser's previous session", async () => {
    stubGithub({ token: { body: { access_token: "t" } }, user: { body: profile } });
    let flow = await begin();
    const first = setCookie(await callback.GET(req(`/auth/github/callback?code=a&state=${flow.state}`, { cookie: flow.cookie })), SESSION_COOKIE)!;
    const user = await User.findOne({ githubId: 4242 }).lean();
    expect(await Session.countDocuments({ userId: user!._id })).toBe(1);

    flow = await begin();
    const both = `${flow.cookie}; ${SESSION_COOKIE}=${first.value}`;
    const second = setCookie(await callback.GET(req(`/auth/github/callback?code=b&state=${flow.state}`, { cookie: both })), SESSION_COOKIE)!;
    expect(second.value).not.toBe(first.value);
    expect(await Session.countDocuments({ userId: user!._id })).toBe(1);
    expect((await client(() => `${SESSION_COOKIE}=${first.value}`).me()).status).toBe(401);
    expect((await client(() => `${SESSION_COOKIE}=${second.value}`).me()).status).toBe(200);
  });

  it("updates username and avatar on the next login instead of creating a second user", async () => {
    stubGithub({ token: { body: { access_token: "t1" } }, user: { body: profile } });
    let flow = await begin();
    await callback.GET(req(`/auth/github/callback?code=a&state=${flow.state}`, { cookie: flow.cookie }));

    stubGithub({ token: { body: { access_token: "t2" } }, user: { body: { ...profile, login: "octo-renamed", avatar_url: "https://a/new.png" } } });
    flow = await begin();
    await callback.GET(req(`/auth/github/callback?code=b&state=${flow.state}`, { cookie: flow.cookie }));

    const users = await User.find({ githubId: 4242 }).lean();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ username: "octo-renamed", avatarUrl: "https://a/new.png" });
  });

  it.each([
    ["no state cookie", (state: string) => req(`/auth/github/callback?code=abc&state=${state}`), "state"],
    ["a different state", (_: string, cookie: string) => req("/auth/github/callback?code=abc&state=forged", { cookie }), "state"],
    ["no state parameter", (_: string, cookie: string) => req("/auth/github/callback?code=abc", { cookie }), "state"],
    ["no code", (state: string, cookie: string) => req(`/auth/github/callback?state=${state}`, { cookie }), "code"],
    ["the user denied access", (state: string, cookie: string) => req(`/auth/github/callback?error=access_denied&state=${state}`, { cookie }), "denied"],
  ])("rejects %s without contacting GitHub or creating a session", async (_label, build, reason) => {
    const calls = stubGithub({});
    const { state, cookie } = await begin();
    const usersBefore = await User.countDocuments();
    const sessionsBefore = await Session.countDocuments();
    const response = await callback.GET(build(state, cookie));
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?error=${reason}`);
    expect(setCookie(response, SESSION_COOKIE)).toBeUndefined();
    expect(calls).toHaveLength(0);
    expect(await User.countDocuments()).toBe(usersBefore);
    expect(await Session.countDocuments()).toBe(sessionsBefore);
  });

  it.each([
    ["token exchange returns an error", { token: { body: { error: "bad_verification_code" } } }],
    ["token endpoint fails", { token: { status: 500, body: {} } }],
    ["user endpoint fails", { token: { body: { access_token: "t" } }, user: { status: 401, body: {} } }],
    ["user payload is malformed", { token: { body: { access_token: "t" } }, user: { body: { login: "no-id" } } }],
  ])("sends the browser back to /login when the %s", async (_label, fake) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubGithub(fake as FakeGithub);
    const { state, cookie } = await begin();
    const sessionsBefore = await Session.countDocuments();
    const response = await callback.GET(req(`/auth/github/callback?code=abc&state=${state}`, { cookie }));
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?error=github`);
    expect(setCookie(response, SESSION_COOKIE)).toBeUndefined();
    expect(await Session.countDocuments()).toBe(sessionsBefore);
    expect(await User.countDocuments({ githubId: 4242 })).toBe(0);
  });
});

describe("POST /auth/logout", () => {
  it("deletes the session record, expires the cookie, and the old cookie stops working", async () => {
    const { loginAs } = await import("../setup/session");
    const alice = await loginAs("alice");
    const aliceApi = client(() => alice.cookie);
    expect((await aliceApi.me()).status).toBe(200);
    const sessionsBefore = await Session.countDocuments();

    const response = await logout.POST(req("/auth/logout", { method: "POST", cookie: alice.cookie }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login`);
    const cleared = setCookie(response, SESSION_COOKIE)!;
    expect(cleared.value).toBe("");
    expect(cleared.raw).toMatch(/Max-Age=0/i);
    expect(await Session.countDocuments()).toBe(sessionsBefore - 1);

    expect((await aliceApi.me()).status).toBe(401);
    expect((await aliceApi.listTodos()).status).toBe(401);
  });

  it("refuses a cross-site logout and keeps the session", async () => {
    const { loginAs } = await import("../setup/session");
    const alice = await loginAs("alice");
    const response = await logout.POST(req("/auth/logout", { method: "POST", cookie: alice.cookie, origin: "https://evil.example" }));
    expect(response.status).toBe(403);
    expect(setCookie(response, SESSION_COOKIE)).toBeUndefined();
    expect((await client(() => alice.cookie).me()).status).toBe(200);

    const sameSite = await logout.POST(req("/auth/logout", { method: "POST", cookie: alice.cookie, origin: ORIGIN }));
    expect(sameSite.status).toBe(303);
    expect((await client(() => alice.cookie).me()).status).toBe(401);
  });

  it("is harmless without a session", async () => {
    const response = await logout.POST(req("/auth/logout", { method: "POST" }));
    expect(response.status).toBe(303);
  });
});
