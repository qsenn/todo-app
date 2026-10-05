import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import mongoose from "mongoose";

export const E2E_MONGO_URI = `mongodb://127.0.0.1:${process.env.E2E_MONGO_PORT ?? 27999}/kgt-e2e`;

let connection: mongoose.Connection | undefined;

async function db() {
  connection ??= await mongoose.createConnection(E2E_MONGO_URI).asPromise();
  return connection.db!;
}

/** Clears app data but keeps users and sessions, so the shared login stays valid. */
export async function resetDatabase() {
  const collections = await (await db()).collections();
  await Promise.all(
    collections
      .filter((c) => !["users", "sessions"].includes(c.collectionName))
      .map((c) => c.deleteMany({})),
  );
}

export async function countSessions() {
  return (await db()).collection("sessions").countDocuments();
}

const FAKE_GITHUB = `http://127.0.0.1:${process.env.E2E_GITHUB_PORT ?? 3199}`;

/** Logs in through /login → /auth/github → fake GitHub → callback, as the given GitHub login. */
export async function loginWithGithub(page: Page, login: string) {
  await page.request.post(`${FAKE_GITHUB}/__fake/next-login`, { data: { login } });
  await page.goto("/login");
  await page.getByRole("link", { name: "GitHub로 로그인" }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

/** Deletes every session of one user (the session ended, e.g. logout elsewhere). */
export async function endSessionsOf(username: string) {
  const conn = await db();
  const user = await conn.collection("users").findOne({ username });
  if (user) await conn.collection("sessions").deleteMany({ userId: user._id });
}

export async function findTodoStatus(title: string) {
  const doc = await (await db()).collection("todos").findOne({ title });
  return doc?.status as string | undefined;
}

export async function closeDatabase() {
  await connection?.close();
  connection = undefined;
}

async function post<T>(request: APIRequestContext, path: string, data: object): Promise<T> {
  const response = await request.post(path, { data });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as T;
}

export const seed = {
  goal: (request: APIRequestContext, data: { year: number; title: string }) =>
    post<{ id: string }>(request, "/api/goals", data),
  plan: (request: APIRequestContext, data: { title: string; weekStart: string; yearGoalId?: string }) =>
    post<{ id: string }>(request, "/api/weekly-plans", data),
  todo: (request: APIRequestContext, data: { title: string; date: string; weeklyPlanId?: string; status?: string }) =>
    post<{ id: string }>(request, "/api/todos", data),
};

export async function openBoard(page: Page, date: string) {
  await page.goto("/");
  await page.locator("#board-date").fill(date);
  await expect(page.locator("#board-date")).toHaveValue(date);
}

export const column = (page: Page, status: "todo" | "doing" | "done") => page.getByTestId(`column-${status}`);
// Cards carry dnd-kit's role="button" (draggable), so find them by test id and label.
export const card = (scope: Page | Locator, title: string) =>
  scope.locator(`[data-testid="todo-card"][aria-label="할 일: ${title}"]`);

/** Drags a card onto a column with real pointer events (dnd-kit needs intermediate moves). */
export async function dragTo(page: Page, source: Locator, target: Locator) {
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 15 });
  await page.mouse.up();
}
