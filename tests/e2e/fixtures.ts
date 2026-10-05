// Every test runs as its own freshly created user, so tests share no data and run in parallel.
import { test as base } from "@playwright/test";
import { SESSION_COOKIE } from "../../src/lib/auth";
import { closeDatabase, createTestUser } from "./helpers";

type TestUser = { id: string; username: string; token: string };

export const test = base.extend<{ user: TestUser }>({
  user: async ({}, provide, testInfo) => {
    await provide(await createTestUser(`user-${testInfo.testId}-${testInfo.repeatEachIndex}-${testInfo.retry}`));
  },
  // The page context and the `request` fixture both carry this user's session cookie.
  storageState: async ({ user }, provide) => {
    await provide({
      cookies: [
        {
          name: SESSION_COOKIE,
          value: user.token,
          domain: "localhost",
          path: "/",
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    });
  },
});

test.afterAll(async () => {
  await closeDatabase();
});

export { expect } from "@playwright/test";
