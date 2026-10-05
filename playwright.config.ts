import { defineConfig, devices } from "@playwright/test";

const APP_PORT = 3100;
/** Logged-in browser state written by tests/e2e/auth.setup.ts (fake GitHub user "e2e-user"). */
export const AUTH_STATE = "tests/e2e/.auth/user.json";

export default defineConfig({
  testDir: "tests/e2e",
  // All tests share one in-memory database, so run them serially.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: `http://localhost:${APP_PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
