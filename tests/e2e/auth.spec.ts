import type { Browser } from "@playwright/test";
import { expect, test } from "./fixtures";
import { SESSION_COOKIE } from "../../src/lib/auth";
import {
  card,
  countSessionsOf,
  endSessionsOf,
  findTodoStatus,
  loginWithGithub,
  openBoard,
} from "./helpers";

const MONDAY = "2026-10-05";
const anonymous = { storageState: { cookies: [], origins: [] } };

/** A GitHub login unique to this test run, so repeated runs against one database never collide. */
const unique = (name: string) => `${name}-${test.info().testId}-${test.info().repeatEachIndex}`;

/** A fresh browser context logged in as `login` through the fake GitHub. */
async function loggedIn(browser: Browser, login: string) {
  const context = await browser.newContext(anonymous);
  const page = await context.newPage();
  await loginWithGithub(page, login);
  return { context, page };
}

// These tests drive the real login flow through the fake GitHub, whose "next login" is shared
// state, so they run one after another in a single worker.
test.describe.configure({ mode: "default" });

test.describe("not logged in", () => {
  test.use(anonymous);

  test("every app page redirects to /login and the API answers 401", { tag: "@smoke" }, async ({ page, request }) => {
    for (const path of ["/", "/weekly", "/goals", "/hierarchy", "/unlinked"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
    await expect(page.getByRole("link", { name: "GitHub로 로그인" })).toBeVisible();
    for (const path of ["/api/todos", "/api/weekly-plans", "/api/goals", "/api/me"]) {
      const response = await request.get(path);
      expect(response.status()).toBe(401);
    }
  });

  test("a rejected login shows the reason on the login page", async ({ page }) => {
    await page.goto("/auth/github/callback?code=x&state=forged");
    await expect(page).toHaveURL(/\/login\?error=state$/);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("로그인 요청이 만료되었거나");
  });
});

test("after login the sidebar shows the GitHub username and avatar", async ({ browser }) => {
  const login = unique("avatar-user");
  const { context, page } = await loggedIn(browser, login);
  await expect(page.getByTestId("current-username")).toHaveText(login);
  const avatar = page.getByRole("img", { name: `${login} 아바타` });
  await expect(avatar).toBeVisible();
  expect(await avatar.getAttribute("src")).toMatch(new RegExp(`/avatars/${login}\.png$`));
  await expect.poll(() => avatar.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  await page.goto("/login");
  await expect(page).toHaveURL(/\/$/);
  await context.close();
});

test("logout deletes the session and the old cookie stops working", { tag: "@smoke" }, async ({ browser }) => {
  const login = unique("leaving-user");
  const { context, page } = await loggedIn(browser, login);
  const cookie = (await context.cookies()).find((c) => c.name === SESSION_COOKIE)!;
  expect(cookie.httpOnly).toBe(true);
  const sessionsBefore = await countSessionsOf(login);

  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await countSessionsOf(login)).toBe(sessionsBefore - 1);
  expect((await context.cookies()).find((c) => c.name === SESSION_COOKIE)).toBeUndefined();

  const replay = await page.request.get("/api/todos", { headers: { cookie: `${SESSION_COOKIE}=${cookie.value}` } });
  expect(replay.status()).toBe(401);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await context.close();
});

test("two users never see each other's todos", async ({ browser }) => {
  const aliceLogin = unique("alice");
  const alice = await loggedIn(browser, aliceLogin);
  expect((await alice.page.request.post("/api/todos", { data: { title: "앨리스의 일", date: MONDAY } })).status()).toBe(201);
  await openBoard(alice.page, MONDAY);
  await expect(card(alice.page, "앨리스의 일")).toBeVisible();

  const bob = await loggedIn(browser, unique("bob"));
  expect((await bob.page.request.post("/api/todos", { data: { title: "밥의 일", date: MONDAY } })).status()).toBe(201);
  await openBoard(bob.page, MONDAY);
  await expect(card(bob.page, "밥의 일")).toBeVisible();
  await expect(card(bob.page, "앨리스의 일")).toHaveCount(0);
  expect(await (await bob.page.request.get(`/api/todos?date=${MONDAY}`)).json()).toHaveLength(1);

  await alice.page.reload();
  await alice.page.locator("#board-date").fill(MONDAY);
  await expect(card(alice.page, "앨리스의 일")).toBeVisible();
  await expect(card(alice.page, "밥의 일")).toHaveCount(0);
  expect(await findTodoStatus("앨리스의 일", aliceLogin)).toBe("todo");

  await alice.context.close();
  await bob.context.close();
});

test("when the session ends while the app is open, the next request goes to /login", async ({ browser }) => {
  const login = unique("expiring-user");
  const { context, page } = await loggedIn(browser, login);
  await openBoard(page, MONDAY);
  await endSessionsOf(login);
  await page.locator("#board-date").fill("2026-10-06");
  await expect(page).toHaveURL(/\/login$/);
  await context.close();
});
