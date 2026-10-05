import { expect, test } from "@playwright/test";
import { card, closeDatabase, column, dragTo, openBoard, resetDatabase, seed } from "./helpers";

const MONDAY = "2026-10-05";

test.beforeEach(async () => {
  await resetDatabase();
});

test.afterAll(async () => {
  await closeDatabase();
});

test("E5: linking an unlinked todo removes it from the list and grows the plan's denominator", async ({ page, request }) => {
  await seed.plan(request, { title: "연결 대상", weekStart: MONDAY });
  await seed.todo(request, { title: "떠도는 일", date: "2026-10-06" });

  await page.goto("/weekly");
  const plan = page.getByRole("listitem", { name: "주간 계획: 연결 대상" });
  await expect(plan.getByTestId("plan-counts")).toHaveText("완료 0 / 전체 0");

  await page.goto("/unlinked");
  const row = page.getByRole("listitem", { name: "미연결 할 일: 떠도는 일" });
  await row.getByLabel("연결할 주간 계획").selectOption({ label: "연결 대상" });
  await row.getByRole("button", { name: "연결" }).click();
  await expect(row).toHaveCount(0);
  await expect(page.getByText("모든 할 일이 주간 계획에 연결되어 있습니다.")).toBeVisible();

  await page.goto("/weekly");
  await expect(plan.getByTestId("plan-counts")).toHaveText("완료 0 / 전체 1");
});

test("unlinked: choosing a plan from another week shows the V2 error and keeps the todo", async ({ page, request }) => {
  await seed.plan(request, { title: "다음 주 계획", weekStart: "2026-10-12" });
  await seed.todo(request, { title: "이번 주 일", date: MONDAY });

  await page.goto("/unlinked");
  const row = page.getByRole("listitem", { name: "미연결 할 일: 이번 주 일" });
  await row.getByLabel("연결할 주간 계획").selectOption({ label: "다음 주 계획 (2026-10-12 ~ 2026-10-18)" });
  await row.getByRole("button", { name: "연결" }).click();
  await expect(row.getByRole("alert")).toContainText("기간(2026-10-12~2026-10-18) 밖입니다");
  await page.reload();
  await expect(page.getByRole("listitem", { name: "미연결 할 일: 이번 주 일" })).toBeVisible();
});

test("goal progress: 'no todos yet' until a plan has todos, then the average", async ({ page, request }) => {
  const goal = await seed.goal(request, { year: 2026, title: "운동" });
  const plan = await seed.plan(request, { title: "운동 1주", weekStart: MONDAY, yearGoalId: goal.id });

  await page.goto("/goals");
  await page.locator("#goal-year-filter").selectOption("2026");
  const item = page.getByRole("listitem", { name: "1년 목표: 운동" });
  await expect(item).toContainText("아직 할 일 없음");

  await seed.todo(request, { title: "뛰기", date: MONDAY, weeklyPlanId: plan.id, status: "done" });
  await seed.todo(request, { title: "걷기", date: MONDAY, weeklyPlanId: plan.id });
  await page.reload();
  await page.locator("#goal-year-filter").selectOption("2026");
  await expect(item.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
});

test("board daily progress follows status changes", async ({ page, request }) => {
  await seed.todo(request, { title: "하나", date: MONDAY, status: "done" });
  await seed.todo(request, { title: "둘", date: MONDAY, status: "done" });
  await seed.todo(request, { title: "셋", date: MONDAY });
  await seed.todo(request, { title: "다른 날", date: "2026-10-06" });
  await openBoard(page, MONDAY);

  const bar = page.getByRole("progressbar", { name: "일일 진행률" });
  await expect(bar).toHaveAttribute("aria-valuenow", "67");
  await expect(page.getByTestId("daily-counts")).toHaveText("완료 2 / 전체 3");

  await dragTo(page, card(page, "셋"), column(page, "done"));
  await expect(bar).toHaveAttribute("aria-valuenow", "100");
});

test("hierarchy shows goal → plan → todo with progress and collapses", async ({ page, request }) => {
  const goal = await seed.goal(request, { year: 2026, title: "독서" });
  const plan = await seed.plan(request, { title: "책 주간", weekStart: MONDAY, yearGoalId: goal.id });
  await seed.todo(request, { title: "1장", date: MONDAY, weeklyPlanId: plan.id, status: "done" });
  await seed.todo(request, { title: "2장", date: MONDAY, weeklyPlanId: plan.id });
  await seed.plan(request, { title: "외톨이 계획", weekStart: "2026-11-02" });
  await seed.todo(request, { title: "외톨이 일", date: "2026-11-03" });

  await page.goto("/hierarchy");
  const yearInput = page.locator("#tree-year");
  await yearInput.fill("");
  await yearInput.pressSequentially("2025");
  await expect(yearInput).toHaveValue("2025");
  await expect(page.getByText("2025년 목표가 없습니다.")).toBeVisible();
  await yearInput.press("Backspace");
  await yearInput.pressSequentially("6");
  await expect(yearInput).toHaveValue("2026");
  const goalNode = page.getByTestId("tree-goal");
  await expect(goalNode).toContainText("독서");
  await expect(goalNode.getByRole("progressbar", { name: "독서 진행률" })).toHaveAttribute("aria-valuenow", "50");

  const planNode = goalNode.getByTestId("tree-plan");
  await expect(planNode.getByText("1장")).toBeHidden();
  await planNode.locator("summary").click();
  await expect(planNode.getByText("1장")).toBeVisible();
  await expect(planNode.getByText("2장")).toBeVisible();

  await goalNode.locator("summary").first().click();
  await expect(planNode).toBeHidden();

  await expect(page.getByRole("region", { name: "목표 미연결 주간 계획" })).toContainText("외톨이 계획");
  await expect(page.getByRole("region", { name: "주간 계획 미연결 할 일" })).toContainText("외톨이 일");
});

test("unlinked weekly plans can be linked to a same-year goal; other years are refused", async ({ page, request }) => {
  await seed.goal(request, { year: 2026, title: "올해 목표" });
  await seed.goal(request, { year: 2025, title: "작년 목표" });
  const plan = await seed.plan(request, { title: "떠도는 계획", weekStart: MONDAY });
  await seed.todo(request, { title: "계획의 일", date: MONDAY, weeklyPlanId: plan.id, status: "done" });

  await page.goto("/unlinked");
  const row = page.getByRole("listitem", { name: "미연결 주간 계획: 떠도는 계획" });
  await expect(row).toContainText("완료 1 / 전체 1");

  await row.getByLabel("연결할 1년 목표").selectOption({ label: "2025년 · 작년 목표" });
  await row.getByRole("button", { name: "연결" }).click();
  await expect(row.getByRole("alert")).toContainText("2025년 목표에 연결할 수 없습니다");

  await row.getByLabel("연결할 1년 목표").selectOption({ label: "2026년 · 올해 목표" });
  await row.getByRole("button", { name: "연결" }).click();
  await expect(row).toHaveCount(0);
  await expect(page.getByText("모든 주간 계획이 1년 목표에 연결되어 있습니다.")).toBeVisible();

  await page.goto("/goals");
  await page.locator("#goal-year-filter").selectOption("2026");
  const goal = page.getByRole("listitem", { name: "1년 목표: 올해 목표" });
  await expect(goal).toContainText("주간 계획 1개");
  await expect(goal.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
});
