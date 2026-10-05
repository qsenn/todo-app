import { expect, test } from "./fixtures";
import { card, column, dragTo, findTodoStatus, openBoard, seed } from "./helpers";

const MONDAY = "2026-10-05";


test("E1: goal → weekly plan → todo created in the UI shows up in the todo column", { tag: "@smoke" }, async ({ page }) => {
  await page.goto("/goals");
  const goalForm = page.getByRole("form", { name: "만들기" });
  await goalForm.getByLabel("연도").fill("2026");
  await goalForm.getByLabel("제목").fill("건강한 한 해");
  await goalForm.getByRole("button", { name: "만들기" }).click();
  await expect(page.getByRole("listitem", { name: "1년 목표: 건강한 한 해" })).toBeVisible();

  await page.goto("/weekly");
  const planForm = page.getByRole("form", { name: "만들기" });
  await planForm.getByLabel("제목").fill("10월 1주");
  await planForm.getByLabel(/^주/).fill("2026-10-07");
  await expect(planForm.getByText("기간: 2026-10-05 ~ 2026-10-11")).toBeVisible();
  await planForm.getByLabel("1년 목표").selectOption({ label: "2026년 · 건강한 한 해" });
  await planForm.getByRole("button", { name: "만들기" }).click();
  const plan = page.getByRole("listitem", { name: "주간 계획: 10월 1주" });
  await expect(plan).toContainText("2026-10-05 ~ 2026-10-11");
  await expect(plan).toContainText("목표: 2026년 · 건강한 한 해");

  await openBoard(page, "2026-10-07");
  const addForm = page.getByRole("form", { name: "추가" });
  await addForm.getByLabel("제목").fill("아침 달리기");
  await addForm.getByLabel("주간 계획").selectOption({ label: "10월 1주 (2026-10-05 ~ 2026-10-11)" });
  await addForm.getByRole("button", { name: "추가" }).click();

  const created = card(column(page, "todo"), "아침 달리기");
  await expect(created).toBeVisible();
  await expect(created).toContainText("10월 1주");
});

test("E2: dragging todo → done persists and updates weekly progress", { tag: "@smoke" }, async ({ page, request }) => {
  const plan = await seed.plan(request, { title: "진행률 주", weekStart: MONDAY });
  await seed.todo(request, { title: "보고서 쓰기", date: MONDAY, weeklyPlanId: plan.id });
  await seed.todo(request, { title: "메일 정리", date: MONDAY, weeklyPlanId: plan.id });
  await openBoard(page, MONDAY);

  const saved = page.waitForResponse((r) => r.request().method() === "PATCH" && r.ok());
  await dragTo(page, card(page, "보고서 쓰기"), column(page, "done"));
  await expect(card(column(page, "done"), "보고서 쓰기")).toBeVisible();
  await saved;

  await page.reload();
  await page.locator("#board-date").fill(MONDAY);
  await expect(card(column(page, "done"), "보고서 쓰기")).toBeVisible();

  await page.goto("/weekly");
  const item = page.getByRole("listitem", { name: "주간 계획: 진행률 주" });
  await expect(item.getByTestId("plan-counts")).toHaveText("완료 1 / 전체 2");
  await expect(item.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
});

test("E3: a failed status change rolls the card back and shows an error toast", async ({ user, page, request }) => {
  await seed.todo(request, { title: "실패할 카드", date: MONDAY });
  await page.route("**/api/todos/*", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({ status: 500, json: { error: { code: "INTERNAL", message: "서버 오류가 발생했습니다." } } })
      : route.continue(),
  );
  await openBoard(page, MONDAY);

  await dragTo(page, card(page, "실패할 카드"), column(page, "doing"));
  await expect(page.getByRole("alert").filter({ hasText: "상태를 바꾸지 못했습니다" })).toBeVisible();
  await expect(card(column(page, "todo"), "실패할 카드")).toBeVisible();
  await expect(card(column(page, "doing"), "실패할 카드")).toHaveCount(0);
  expect(await findTodoStatus("실패할 카드", user.username)).toBe("todo");
});

test("E6: rapid drags on one card are sent in order and the last state wins", async ({ user, page, request }) => {
  await seed.todo(request, { title: "빠른 카드", date: MONDAY });
  const log: { n: number; event: "start" | "end"; at: number; status?: string }[] = [];
  let count = 0;
  await page.route("**/api/todos/*", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    const n = ++count;
    log.push({ n, event: "start", at: Date.now(), status: route.request().postDataJSON().status });
    if (n === 1) await new Promise((resolve) => setTimeout(resolve, 800));
    const response = await route.fetch();
    log.push({ n, event: "end", at: Date.now() });
    await route.fulfill({ response });
  });
  await openBoard(page, MONDAY);

  await dragTo(page, card(page, "빠른 카드"), column(page, "doing"));
  await expect(card(column(page, "doing"), "빠른 카드")).toBeVisible();
  await dragTo(page, card(page, "빠른 카드"), column(page, "done"));
  // The screen follows the second drop at once, while the first request is still delayed.
  await expect(card(column(page, "done"), "빠른 카드")).toBeVisible({ timeout: 1_000 });
  expect(log.filter((e) => e.event === "end")).toHaveLength(0);

  await expect.poll(() => log.filter((e) => e.event === "end").length, { timeout: 10_000 }).toBe(2);
  const end1 = log.find((e) => e.n === 1 && e.event === "end")!;
  const start2 = log.find((e) => e.n === 2 && e.event === "start")!;
  expect(log.filter((e) => e.event === "start").map((e) => e.status)).toEqual(["doing", "done"]);
  expect(start2.at).toBeGreaterThanOrEqual(end1.at);

  await page.reload();
  await page.locator("#board-date").fill(MONDAY);
  await expect(card(column(page, "done"), "빠른 카드")).toBeVisible();
  expect(await findTodoStatus("빠른 카드", user.username)).toBe("done");
});

test("keyboard: Space, Arrow Right, Space moves a card to the next column", async ({ user, page, request }) => {
  await seed.todo(request, { title: "키보드 카드", date: MONDAY });
  await openBoard(page, MONDAY);

  const target = card(page, "키보드 카드");
  await target.focus();
  const saved = page.waitForResponse((r) => r.request().method() === "PATCH" && r.ok());
  await page.keyboard.press("Space");
  await expect(target).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("‘진행 중’ 컬럼 위에 있습니다")).toBeAttached();
  await page.keyboard.press("Space");
  await expect(card(column(page, "doing"), "키보드 카드")).toBeVisible();
  await saved;
  expect(await findTodoStatus("키보드 카드", user.username)).toBe("doing");
});

test("board CRUD: edit and delete a todo, filter by plan", async ({ page, request }) => {
  const plan = await seed.plan(request, { title: "필터 계획", weekStart: MONDAY });
  await seed.todo(request, { title: "연결된 일", date: MONDAY, weeklyPlanId: plan.id });
  await seed.todo(request, { title: "혼자인 일", date: MONDAY });
  await openBoard(page, MONDAY);

  await page.locator("#board-plan-filter").selectOption({ label: "미연결" });
  await expect(card(page, "혼자인 일")).toBeVisible();
  await expect(card(page, "연결된 일")).toHaveCount(0);
  await page.locator("#board-plan-filter").selectOption({ label: "필터 계획" });
  await expect(card(page, "연결된 일")).toBeVisible();
  await expect(card(page, "혼자인 일")).toHaveCount(0);
  await page.locator("#board-plan-filter").selectOption({ label: "전체" });

  await card(page, "혼자인 일").getByRole("button", { name: "수정" }).click();
  const dialog = page.getByRole("dialog", { name: "할 일 수정" });
  await dialog.getByLabel("제목").fill("이름 바뀐 일");
  await dialog.getByLabel("상태").selectOption({ label: "진행 중" });
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(card(column(page, "doing"), "이름 바뀐 일")).toBeVisible();

  // V6 rejection is explained in the form, and nothing changes.
  await card(page, "연결된 일").getByRole("button", { name: "수정" }).click();
  const edit = page.getByRole("dialog", { name: "할 일 수정" });
  await edit.getByLabel("날짜").fill("2026-10-20");
  await edit.getByRole("button", { name: "저장" }).click();
  await expect(edit.getByRole("alert")).toContainText("연결을 해제하세요");
  await edit.getByRole("button", { name: "취소" }).click();

  await card(page, "이름 바뀐 일").getByRole("button", { name: "삭제" }).click();
  await page.getByRole("dialog", { name: "할 일 삭제" }).getByRole("button", { name: "삭제" }).click();
  await expect(card(page, "이름 바뀐 일")).toHaveCount(0);
});

test.describe("status rollback with queued drops", () => {
  async function routePatches(page: import("@playwright/test").Page, plan: (n: number) => { delay?: number; fail?: boolean }) {
    let count = 0;
    const done: number[] = [];
    await page.route("**/api/todos/*", async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      const n = ++count;
      const { delay = 0, fail = false } = plan(n);
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (fail) await route.fulfill({ status: 500, json: { error: { code: "INTERNAL", message: "서버 오류" } } });
      else await route.fulfill({ response: await route.fetch() });
      done.push(n);
    });
    return done;
  }

  test("first request fails while a second is queued: the second wins", async ({ user, page, request }) => {
    await seed.todo(request, { title: "큐 카드", date: MONDAY });
    const done = await routePatches(page, (n) => (n === 1 ? { delay: 600, fail: true } : {}));
    await openBoard(page, MONDAY);

    await dragTo(page, card(page, "큐 카드"), column(page, "doing"));
    await expect(card(column(page, "doing"), "큐 카드")).toBeVisible();
    await dragTo(page, card(page, "큐 카드"), column(page, "done"));
    await expect(page.getByRole("alert").filter({ hasText: "상태를 바꾸지 못했습니다" })).toBeVisible();
    await expect.poll(() => done.length).toBe(2);
    await expect(card(column(page, "done"), "큐 카드")).toBeVisible();
    expect(await findTodoStatus("큐 카드", user.username)).toBe("done");
  });

  test("second request fails after the first succeeded: the card shows the first result", async ({ user, page, request }) => {
    await seed.todo(request, { title: "반쪽 카드", date: MONDAY });
    const done = await routePatches(page, (n) => (n === 1 ? { delay: 600 } : { fail: true }));
    await openBoard(page, MONDAY);

    await dragTo(page, card(page, "반쪽 카드"), column(page, "doing"));
    await expect(card(column(page, "doing"), "반쪽 카드")).toBeVisible();
    await dragTo(page, card(page, "반쪽 카드"), column(page, "done"));
    await expect.poll(() => done.length).toBe(2);
    await expect(card(column(page, "doing"), "반쪽 카드")).toBeVisible();
    await expect(card(column(page, "done"), "반쪽 카드")).toHaveCount(0);
    expect(await findTodoStatus("반쪽 카드", user.username)).toBe("doing");
  });

  test("a failure on one card does not undo another card's move", async ({ user, page, request }) => {
    await seed.todo(request, { title: "실패 카드", date: MONDAY });
    await seed.todo(request, { title: "성공 카드", date: MONDAY });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/api/todos/*", async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      if (route.request().postDataJSON().status === "doing") {
        await gate;
        return route.fulfill({ status: 500, json: { error: { code: "INTERNAL", message: "서버 오류" } } });
      }
      // The other card's request is held too, so it is still pending when the first one fails.
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.fulfill({ response: await route.fetch() });
    });
    await openBoard(page, MONDAY);

    await dragTo(page, card(page, "실패 카드"), column(page, "doing"));
    await expect(card(column(page, "doing"), "실패 카드")).toBeVisible();
    await dragTo(page, card(page, "성공 카드"), column(page, "done"));
    await expect(card(column(page, "done"), "성공 카드")).toBeVisible();
    release();
    await expect(page.getByRole("alert").filter({ hasText: "상태를 바꾸지 못했습니다" })).toBeVisible();
    await expect(card(column(page, "todo"), "실패 카드")).toBeVisible();
    await expect(card(column(page, "done"), "성공 카드")).toBeVisible({ timeout: 500 });
    await expect.poll(() => findTodoStatus("성공 카드", user.username)).toBe("done");
    await expect(card(column(page, "done"), "성공 카드")).toBeVisible();
  });
});
