// Starts an in-memory MongoDB on a fixed port, a fake GitHub OAuth server, then `next dev` against both.
// Playwright tests reset the same database directly between tests.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { MongoMemoryServer } from "mongodb-memory-server";
import { FAKE_CLIENT_ID, FAKE_CLIENT_SECRET, startFakeGithub } from "./fake-github.mjs";

const MONGO_PORT = Number(process.env.E2E_MONGO_PORT ?? 27999);
const GITHUB_PORT = Number(process.env.E2E_GITHUB_PORT ?? 3199);
const APP_PORT = process.env.E2E_APP_PORT ?? "3100";

const mongo = await MongoMemoryServer.create({ instance: { port: MONGO_PORT } });
const uri = `mongodb://127.0.0.1:${MONGO_PORT}/kgt-e2e`;
console.log(`[e2e] mongo ready at ${uri}`);
const github = await startFakeGithub(GITHUB_PORT);
console.log(`[e2e] fake GitHub at ${github.base}`);

// Run Next's CLI directly (no shell) so killing this child stops the dev server itself.
// These variables take precedence over any .env file, so E2E never touches real GitHub or a real DB.
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const next = spawn(process.execPath, [nextBin, "dev", "--port", APP_PORT], {
  stdio: "inherit",
  env: {
    ...process.env,
    MONGODB_URI: uri,
    NEXT_DIST_DIR: ".next-e2e",
    APP_URL: `http://localhost:${APP_PORT}`,
    GITHUB_CLIENT_ID: FAKE_CLIENT_ID,
    GITHUB_CLIENT_SECRET: FAKE_CLIENT_SECRET,
    GITHUB_OAUTH_URL: github.base,
    GITHUB_API_URL: github.base,
  },
});

const shutdown = async () => {
  next.kill();
  github.server.close();
  await mongo.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
next.on("exit", async (code) => {
  github.server.close();
  await mongo.stop();
  process.exit(code ?? 0);
});
