import { defineConfig, devices } from "@playwright/test";

const APP_PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  // Each test runs as its own user (tests/e2e/fixtures.ts), so tests share no data and run in parallel.
  workers: 6,
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: `http://localhost:${APP_PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
