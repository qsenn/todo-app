import { expect, test } from "@playwright/test";
import { closeDatabase, resetDatabase, seed } from "./helpers";

const MONDAY = "2026-10-05";

test.beforeEach(async () => {
  await resetDatabase();
});

test.afterAll(async () => {
  await closeDatabase();
});

test("E4: deleting a weekly plan with todos shows counts and 'unlink' keeps the todos", async ({ page, request }) => {
  const plan = await seed.plan(request, { title: "지울 계획", weekStart: MONDAY });
  await seed.todo(request, { title: "남을 일 1", date: MONDAY, weeklyPlanId: plan.id });
  await seed.todo(request, { title: "남을 일 2", date: "2026-10-06", weeklyPlanId: plan.id });

  await page.goto("/weekly");
  await page.getByRole("listitem", { name: "주간 계획: 지울 계획" }).getByRole("button", { name: "삭제" }).click();
  const dialog = page.getByRole("dialog", { name: "주간 계획 삭제" });
  await expect(dialog.getByTestId("impact-counts")).toHaveText("할 일 2개");
  const impactAfterDelete: string[] = [];
  const deleted = page.waitForResponse((r) => r.request().method() === "DELETE");
  await dialog.getByRole("button", { name: "연결만 해제" }).click();
  page.on("request", (r) => r.url().includes("/impact") && impactAfterDelete.push(r.url()));
  expect((await deleted).status()).toBe(204);
  // Once the delete lands the dialog closes promptly and never refetches the deleted plan's impact.
  await expect(dialog).toBeHidden({ timeout: 500 });
  await expect(page.getByRole("listitem", { name: "주간 계획: 지울 계획" })).toHaveCount(0);
  expect(impactAfterDelete).toEqual([]);

  const unlinked = await (await request.get("/api/todos?unlinked=true")).json();
  expect(unlinked.map((t: { title: string }) => t.title).sort()).toEqual(["남을 일 1", "남을 일 2"]);
});

test("cascade delete of a goal removes its plans and todos", async ({ page, request }) => {
  const goal = await seed.goal(request, { year: 2026, title: "지울 목표" });
  const plan = await seed.plan(request, { title: "딸린 계획", weekStart: MONDAY, yearGoalId: goal.id });
  await seed.todo(request, { title: "딸린 일", date: MONDAY, weeklyPlanId: plan.id });

  await page.goto("/goals");
  await page.getByLabel("연도").first().selectOption("2026");
  await page.getByRole("listitem", { name: "1년 목표: 지울 목표" }).getByRole("button", { name: "삭제" }).click();
  const dialog = page.getByRole("dialog", { name: "1년 목표 삭제" });
  await expect(dialog.getByTestId("impact-counts")).toContainText("주간 계획 1개");
  await expect(dialog.getByTestId("impact-counts")).toContainText("할 일 1개");
  await dialog.getByRole("button", { name: "하위 항목까지 삭제" }).click();
  await expect(page.getByRole("listitem", { name: "1년 목표: 지울 목표" })).toHaveCount(0);

  expect(await (await request.get("/api/weekly-plans")).json()).toEqual([]);
  expect(await (await request.get("/api/todos")).json()).toEqual([]);
});

test("deleting a plan with no todos uses a plain confirmation", async ({ page, request }) => {
  await seed.plan(request, { title: "빈 계획", weekStart: MONDAY });
  await page.goto("/weekly");
  await page.getByRole("listitem", { name: "주간 계획: 빈 계획" }).getByRole("button", { name: "삭제" }).click();
  const dialog = page.getByRole("dialog", { name: "주간 계획 삭제" });
  await expect(dialog.getByRole("button", { name: "연결만 해제" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByRole("listitem", { name: "주간 계획: 빈 계획" })).toHaveCount(0);
});

test("V6: shifting a plan's week with todos outside is refused with the reason", async ({ page, request }) => {
  const plan = await seed.plan(request, { title: "고정 계획", weekStart: MONDAY });
  await seed.todo(request, { title: "월요일 일", date: MONDAY, weeklyPlanId: plan.id });

  await page.goto("/weekly");
  await page.getByRole("listitem", { name: "주간 계획: 고정 계획" }).getByRole("button", { name: "수정" }).click();
  const dialog = page.getByRole("dialog", { name: "주간 계획 수정" });
  await dialog.getByLabel(/^주/).fill("2026-10-14");
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog.getByRole("alert")).toContainText("할 일 1개");
  await expect(dialog.getByRole("alert")).toContainText("먼저 연결을 해제");
  await dialog.getByRole("button", { name: "취소" }).click();
  await expect(page.getByRole("listitem", { name: "주간 계획: 고정 계획" })).toContainText("2026-10-05 ~ 2026-10-11");
});

test("weekly plan shows its todos and goal page lists linked plans", async ({ page, request }) => {
  const goal = await seed.goal(request, { year: 2026, title: "독서" });
  const plan = await seed.plan(request, { title: "책 주간", weekStart: MONDAY, yearGoalId: goal.id });
  await seed.todo(request, { title: "1장 읽기", date: MONDAY, weeklyPlanId: plan.id, status: "done" });

  await page.goto("/weekly");
  const item = page.getByRole("listitem", { name: "주간 계획: 책 주간" });
  await item.getByRole("button", { name: "할 일 보기" }).click();
  await expect(item).toContainText("1장 읽기");
  await expect(item.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");

  await page.goto("/goals");
  await page.getByLabel("연도").first().selectOption("2026");
  const goalItem = page.getByRole("listitem", { name: "1년 목표: 독서" });
  await expect(goalItem).toContainText("주간 계획 1개");
  await goalItem.getByRole("button", { name: "주간 계획 보기" }).click();
  await expect(goalItem).toContainText("책 주간");
});
