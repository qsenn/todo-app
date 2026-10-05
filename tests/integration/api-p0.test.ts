import { describe, expect, it } from "vitest";
import { api } from "./http";

const WEEK = "2026-10-05"; // Monday; week runs to 2026-10-11

async function planWithTodos(statuses: string[], weekStart = WEEK) {
  const plan = await api.createPlan({ title: "주간", weekStart });
  const todos = [];
  for (const [i, status] of statuses.entries()) {
    todos.push(await api.createTodo({ title: `t${i}`, date: weekStart, weeklyPlanId: plan.id, status }));
  }
  return { plan, todos };
}

async function progressOf(planId: string) {
  return (await api.getPlan(planId)).body.progress;
}

describe("AC-1 todo status default and validation", () => {
  it("defaults status to todo", async () => {
    const todo = await api.createTodo({ title: "운동", date: WEEK });
    expect(todo.status).toBe("todo");
    expect(todo.weeklyPlanId).toBeNull();
  });

  it("rejects an unknown status on create and update with 400", async () => {
    const bad = await api.postTodo({ title: "x", date: WEEK, status: "blocked" });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION");

    const todo = await api.createTodo({ title: "x", date: WEEK });
    expect((await api.patchTodo(todo.id, { status: "archived" })).status).toBe(400);
    expect((await api.patchTodo(todo.id, { status: "doing" })).body.status).toBe("doing");
  });
});

describe("AC-2 todo listing filters", () => {
  it("filters by date and by weekly plan", async () => {
    const { plan } = await planWithTodos(["todo"]);
    await api.createTodo({ title: "다른 날", date: "2026-10-06" });
    await api.createTodo({ title: "미연결 같은 날", date: WEEK });

    const byDate = (await api.listTodos(`?date=${WEEK}`)).body;
    expect(byDate).toHaveLength(2);
    expect(byDate.every((t: { date: string }) => t.date === WEEK)).toBe(true);

    const byPlan = (await api.listTodos(`?weeklyPlanId=${plan.id}`)).body;
    expect(byPlan).toHaveLength(1);
    expect(byPlan[0].weeklyPlanId).toBe(plan.id);
  });

  it("rejects malformed filters with 400", async () => {
    expect((await api.listTodos("?date=2026-13-40")).status).toBe(400);
    expect((await api.listTodos("?weeklyPlanId=nope")).status).toBe(400);
  });
});

describe("AC-3 weekly progress follows every trigger", () => {
  it("recalculates on status change, delete and relink", async () => {
    const { plan, todos } = await planWithTodos(["done", "todo", "todo", "doing"]);
    expect(await progressOf(plan.id)).toBe(25);

    await api.patchTodo(todos[1].id, { status: "done" });
    expect(await progressOf(plan.id)).toBe(50);

    await api.deleteTodo(todos[0].id);
    expect(await progressOf(plan.id)).toBe(33);

    const other = await api.createPlan({ title: "다른 계획", weekStart: WEEK });
    await api.patchTodo(todos[1].id, { weeklyPlanId: other.id });
    expect(await progressOf(plan.id)).toBe(0);
    expect(await progressOf(other.id)).toBe(100);

    const listed = (await api.listPlans(`?weekStart=${WEEK}`)).body;
    const summary = Object.fromEntries(listed.map((p: { id: string; doneCount: number; totalCount: number }) => [p.id, [p.doneCount, p.totalCount]]));
    expect(summary[plan.id]).toEqual([0, 2]);
    expect(summary[other.id]).toEqual([1, 1]);
  });

  it("recalculates on create", async () => {
    const { plan } = await planWithTodos(["done"]);
    expect(await progressOf(plan.id)).toBe(100);
    await api.createTodo({ title: "new", date: WEEK, weeklyPlanId: plan.id });
    expect(await progressOf(plan.id)).toBe(50);
  });
});

describe("AC-4 empty plan", () => {
  it("reports 0 progress without dividing by zero", async () => {
    const plan = await api.createPlan({ title: "빈 계획", weekStart: WEEK });
    expect(plan.progress).toBe(0);
    expect(plan.totalCount).toBe(0);
    expect(await progressOf(plan.id)).toBe(0);
  });
});

describe("AC-5 week boundaries", () => {
  it("rejects a non-Monday weekStart and derives weekEnd", async () => {
    const bad = await api.postPlan({ title: "x", weekStart: "2026-10-06" });
    expect(bad.status).toBe(400);
    const plan = await api.createPlan({ title: "x", weekStart: "2026-12-28" });
    expect(plan.weekEnd).toBe("2027-01-03");
  });

  it("rejects a client-supplied weekEnd (it is always derived)", async () => {
    const res = await api.postPlan({ title: "x", weekStart: WEEK, weekEnd: "2026-12-31" });
    expect(res.status).toBe(400);
  });
});

describe("AC-6 todo date must fit its plan (V2)", () => {
  it("rejects linking a todo outside the week", async () => {
    const plan = await api.createPlan({ title: "x", weekStart: WEEK });
    const res = await api.postTodo({ title: "x", date: "2026-10-12", weeklyPlanId: plan.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("V2_DATE_OUT_OF_WEEK");
    expect((await api.postTodo({ title: "x", date: "2026-10-11", weeklyPlanId: plan.id })).status).toBe(201);
  });

  it("returns 404 for a missing plan (V4)", async () => {
    const res = await api.postTodo({ title: "x", date: WEEK, weeklyPlanId: "0123456789abcdef01234567" });
    expect(res.status).toBe(404);
  });
});

describe("AC-7 plan year must match goal (V3)", () => {
  it("rejects a mismatched year and allows boundary weeks for both years", async () => {
    const g2026 = await api.createGoal({ year: 2026, title: "2026" });
    const g2027 = await api.createGoal({ year: 2027, title: "2027" });
    const g2025 = await api.createGoal({ year: 2025, title: "2025" });

    const bad = await api.postPlan({ title: "x", weekStart: WEEK, yearGoalId: g2025.id });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("V3_YEAR_MISMATCH");

    expect((await api.postPlan({ title: "a", weekStart: "2026-12-28", yearGoalId: g2026.id })).status).toBe(201);
    expect((await api.postPlan({ title: "b", weekStart: "2026-12-28", yearGoalId: g2027.id })).status).toBe(201);
  });

  it("returns 404 for a missing goal (V4)", async () => {
    const res = await api.postPlan({ title: "x", weekStart: WEEK, yearGoalId: "0123456789abcdef01234567" });
    expect(res.status).toBe(404);
  });
});

describe("AC-8 deleting a weekly plan", () => {
  it("requires a mode when todos are linked", async () => {
    const { plan } = await planWithTodos(["todo"]);
    const res = await api.deletePlan(plan.id);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "HAS_CHILDREN", todoCount: 1 });
    expect((await api.getPlan(plan.id)).status).toBe(200);
  });

  it("deletes an empty plan without a mode", async () => {
    const plan = await api.createPlan({ title: "x", weekStart: WEEK });
    expect((await api.deletePlan(plan.id)).status).toBe(204);
    expect((await api.getPlan(plan.id)).status).toBe(404);
  });

  it("unlink keeps todos and clears their link", async () => {
    const { plan, todos } = await planWithTodos(["todo", "done"]);
    expect((await api.deletePlan(plan.id, "unlink")).status).toBe(204);
    for (const t of todos) expect((await api.getTodo(t.id)).body.weeklyPlanId).toBeNull();
    expect((await api.getPlan(plan.id)).status).toBe(404);
  });

  it("cascade deletes linked todos", async () => {
    const { plan, todos } = await planWithTodos(["todo", "done"]);
    const keep = await api.createTodo({ title: "keep", date: WEEK });
    expect((await api.deletePlan(plan.id, "cascade")).status).toBe(204);
    for (const t of todos) expect((await api.getTodo(t.id)).status).toBe(404);
    expect((await api.getTodo(keep.id)).status).toBe(200);
  });

  it("rejects an unknown mode", async () => {
    const plan = await api.createPlan({ title: "x", weekStart: WEEK });
    expect((await api.deletePlan(plan.id, "purge")).status).toBe(400);
  });
});

describe("AC-9 deleting a goal", () => {
  async function goalTree() {
    const goal = await api.createGoal({ year: 2026, title: "목표" });
    const p1 = await api.createPlan({ title: "p1", weekStart: WEEK, yearGoalId: goal.id });
    const p2 = await api.createPlan({ title: "p2", weekStart: "2026-10-12", yearGoalId: goal.id });
    const t1 = await api.createTodo({ title: "t1", date: WEEK, weeklyPlanId: p1.id });
    const t2 = await api.createTodo({ title: "t2", date: "2026-10-12", weeklyPlanId: p2.id });
    const t3 = await api.createTodo({ title: "t3", date: "2026-10-13", weeklyPlanId: p2.id });
    return { goal, plans: [p1, p2], todos: [t1, t2, t3] };
  }

  it("reports impact counts", async () => {
    const { goal, plans } = await goalTree();
    expect((await api.goalImpact(goal.id)).body).toEqual({ weeklyPlanCount: 2, todoCount: 3 });
    expect((await api.planImpact(plans[1].id)).body).toEqual({ todoCount: 2 });
    expect((await api.goalImpact("0123456789abcdef01234567")).status).toBe(404);
  });

  it("requires a mode when plans are linked", async () => {
    const { goal } = await goalTree();
    const res = await api.deleteGoal(goal.id);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "HAS_CHILDREN", weeklyPlanCount: 2, todoCount: 3 });
  });

  it("cascade removes plans and their todos", async () => {
    const { goal, plans, todos } = await goalTree();
    const outside = await api.createTodo({ title: "outside", date: WEEK });
    expect((await api.deleteGoal(goal.id, "cascade")).status).toBe(204);
    for (const p of plans) expect((await api.getPlan(p.id)).status).toBe(404);
    for (const t of todos) expect((await api.getTodo(t.id)).status).toBe(404);
    expect((await api.getTodo(outside.id)).status).toBe(200);
    expect((await api.getGoal(goal.id)).status).toBe(404);
  });

  it("unlink keeps plans and todos, clearing yearGoalId", async () => {
    const { goal, plans, todos } = await goalTree();
    expect((await api.deleteGoal(goal.id, "unlink")).status).toBe(204);
    for (const p of plans) expect((await api.getPlan(p.id)).body.yearGoalId).toBeNull();
    for (const t of todos) expect((await api.getTodo(t.id)).body.weeklyPlanId).not.toBeNull();
  });
});

describe("AC-14 update integrity (V6)", () => {
  it("(a) rejects moving a linked todo's date outside the week and keeps it unchanged", async () => {
    const { plan, todos } = await planWithTodos(["todo"]);
    const res = await api.patchTodo(todos[0].id, { date: "2026-10-12" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "V6_TODO_OUT_OF_WEEK", count: 1 });
    const after = (await api.getTodo(todos[0].id)).body;
    expect(after.date).toBe(WEEK);
    expect(after.weeklyPlanId).toBe(plan.id);
  });

  it("(a) rejects relinking a todo to a plan whose week excludes its date", async () => {
    const { todos } = await planWithTodos(["todo"]);
    const later = await api.createPlan({ title: "later", weekStart: "2026-10-12" });
    expect((await api.patchTodo(todos[0].id, { weeklyPlanId: later.id })).status).toBe(400);
    expect((await api.patchTodo(todos[0].id, { weeklyPlanId: later.id, date: "2026-10-14" })).status).toBe(200);
  });

  it("(b) rejects shifting a plan's week when linked todos fall outside, with the count", async () => {
    const plan = await api.createPlan({ title: "x", weekStart: WEEK });
    const inside = await api.createTodo({ title: "sun", date: "2026-10-11", weeklyPlanId: plan.id });
    await api.createTodo({ title: "mon", date: "2026-10-05", weeklyPlanId: plan.id });
    await api.createTodo({ title: "tue", date: "2026-10-06", weeklyPlanId: plan.id });

    const res = await api.patchPlan(plan.id, { weekStart: "2026-10-12" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "V6_TODOS_OUT_OF_RANGE", count: 3 });
    const unchanged = (await api.getPlan(plan.id)).body;
    expect([unchanged.weekStart, unchanged.weekEnd]).toEqual([WEEK, "2026-10-11"]);
    expect((await api.getTodo(inside.id)).body.weeklyPlanId).toBe(plan.id);
  });

  // Weeks are fixed Monday–Sunday, so two different weeks never overlap: "every linked todo still
  // fits" after a real shift means the plan has no linked todos.
  it("(b) allows shifting a plan's week when no linked todo falls outside", async () => {
    const empty = await api.createPlan({ title: "empty", weekStart: WEEK });
    const moved = await api.patchPlan(empty.id, { weekStart: "2026-10-12" });
    expect(moved.status).toBe(200);
    expect(moved.body.weekEnd).toBe("2026-10-18");

    const plan = await api.createPlan({ title: "x", weekStart: WEEK });
    await api.createTodo({ title: "sun", date: "2026-10-11", weeklyPlanId: plan.id });
    expect((await api.patchPlan(plan.id, { weekStart: WEEK, title: "renamed" })).status).toBe(200);
  });

  it("(c) rejects moving a linked plan to a goal of another year or shifting it out of its goal's year", async () => {
    const g2026 = await api.createGoal({ year: 2026, title: "2026" });
    const g2025 = await api.createGoal({ year: 2025, title: "2025" });
    const plan = await api.createPlan({ title: "x", weekStart: WEEK, yearGoalId: g2026.id });

    const relink = await api.patchPlan(plan.id, { yearGoalId: g2025.id });
    expect(relink.status).toBe(400);
    expect(relink.body.error).toMatchObject({ code: "V6_YEAR_MISMATCH", count: 1 });

    const shift = await api.patchPlan(plan.id, { weekStart: "2027-01-04" });
    expect(shift.status).toBe(400);
    expect(shift.body.error).toMatchObject({ code: "V6_YEAR_MISMATCH", count: 1 });

    expect((await api.getPlan(plan.id)).body).toMatchObject({ weekStart: WEEK, yearGoalId: g2026.id });
    expect((await api.patchPlan(plan.id, { weekStart: "2026-12-28" })).status).toBe(200);
  });

  it("(c) rejects changing a goal's year when linked plans no longer fit", async () => {
    const goal = await api.createGoal({ year: 2026, title: "x" });
    await api.createPlan({ title: "x", weekStart: WEEK, yearGoalId: goal.id });
    const res = await api.patchGoal(goal.id, { year: 2027 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "V6_YEAR_MISMATCH", count: 1 });
    expect((await api.getGoal(goal.id)).body.year).toBe(2026);
  });

  it("(d) never unlinks automatically after a 400", async () => {
    const { plan, todos } = await planWithTodos(["todo", "todo"]);
    await api.patchPlan(plan.id, { weekStart: "2026-10-19" });
    await api.patchTodo(todos[0].id, { date: "2026-09-01" });
    for (const t of todos) expect((await api.getTodo(t.id)).body.weeklyPlanId).toBe(plan.id);
  });
});

describe("error response format", () => {
  it("returns 400 for malformed ids, 404 for missing ids", async () => {
    const bad = await api.getTodo("not-an-id");
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("INVALID_ID");
    const missing = await api.getTodo("0123456789abcdef01234567");
    expect(missing.status).toBe(404);
    expect(missing.body.error).toMatchObject({ code: "NOT_FOUND" });
    expect(typeof missing.body.error.message).toBe("string");
  });

  it("returns 400 for invalid JSON and empty updates", async () => {
    expect((await api.postTodo("{not json")).body.error.code).toBe("INVALID_JSON");
    const todo = await api.createTodo({ title: "x", date: WEEK });
    expect((await api.patchTodo(todo.id, {})).status).toBe(400);
  });

  it("validates goal CRUD input", async () => {
    const goal = await api.createGoal({ year: 2026, title: "  목표  ", description: "설명" });
    expect(goal).toMatchObject({ title: "목표", description: "설명", weeklyPlanCount: 0 });
    expect((await api.patchGoal(goal.id, { title: "" })).status).toBe(400);
    expect((await api.patchGoal(goal.id, { title: "새 이름" })).body.title).toBe("새 이름");
    expect((await api.listGoals("?year=abc")).status).toBe(400);
    expect((await api.listGoals("?year=2026")).body).toHaveLength(1);
    expect((await api.deleteGoal(goal.id)).status).toBe(204);
  });
});
