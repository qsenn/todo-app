// A tiny stand-in for GitHub's OAuth web flow, used only by the E2E server.
// POST /__fake/next-login {"login":"name"} chooses which account the next login returns.
import { createServer } from "node:http";

export const FAKE_CLIENT_ID = "e2e-client-id";
export const FAKE_CLIENT_SECRET = "e2e-client-secret";

// 1x1 transparent PNG for avatar URLs.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const githubId = (login) => [...login].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) % 1_000_000_007, 7);

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

export function startFakeGithub(port) {
  let nextLogin = "e2e-user";
  const base = `http://127.0.0.1:${port}`;

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, base);
    const json = (status, body) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };

    if (request.method === "POST" && url.pathname === "/__fake/next-login") {
      nextLogin = (await readJson(request)).login || "e2e-user";
      return json(200, { login: nextLogin });
    }
    if (request.method === "GET" && url.pathname === "/login/oauth/authorize") {
      if (url.searchParams.get("client_id") !== FAKE_CLIENT_ID) return json(400, { error: "bad client_id" });
      const back = new URL(url.searchParams.get("redirect_uri"));
      back.searchParams.set("code", `code-${nextLogin}`);
      back.searchParams.set("state", url.searchParams.get("state") ?? "");
      response.writeHead(302, { location: back.toString() });
      return response.end();
    }
    if (request.method === "POST" && url.pathname === "/login/oauth/access_token") {
      const body = await readJson(request);
      if (body.client_id !== FAKE_CLIENT_ID || body.client_secret !== FAKE_CLIENT_SECRET) {
        return json(200, { error: "incorrect_client_credentials" });
      }
      if (!String(body.code).startsWith("code-")) return json(200, { error: "bad_verification_code" });
      return json(200, { access_token: `token-${String(body.code).slice(5)}`, token_type: "bearer" });
    }
    if (request.method === "GET" && url.pathname === "/user") {
      const token = (request.headers.authorization ?? "").replace(/^Bearer /, "");
      if (!token.startsWith("token-")) return json(401, { message: "Bad credentials" });
      const login = token.slice(6);
      return json(200, { id: githubId(login), login, avatar_url: `${base}/avatars/${login}.png` });
    }
    if (request.method === "GET" && url.pathname.startsWith("/avatars/")) {
      response.writeHead(200, { "content-type": "image/png" });
      return response.end(PIXEL);
    }
    json(404, { message: "Not Found" });
  });

  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, base })));
}
