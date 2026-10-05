import { describe, expect, it } from "vitest";
import { api } from "./http";

async function plan(goalId: string, weekStart: string, statuses: string[]) {
  const created = await api.createPlan({ title: `plan ${weekStart}`, weekStart, yearGoalId: goalId });
  for (const [i, status] of statuses.entries()) {
    await api.createTodo({ title: `t${i}`, date: weekStart, weeklyPlanId: created.id, status });
  }
  return created;
}

describe("AC-10 goal progress", () => {
  it("averages plans that have todos and ignores empty ones", async () => {
    const goal = await api.createGoal({ year: 2026, title: "목표" });
    await plan(goal.id, "2026-10-05", ["done", "done"]); // 100
    await plan(goal.id, "2026-10-12", ["done", "todo"]); // 50
    await plan(goal.id, "2026-10-19", ["todo", "doing"]); // 0, but has todos
    expect((await api.getGoal(goal.id)).body.progress).toBe(50);

    await plan(goal.id, "2026-10-26", []); // no todos yet
    const after = (await api.getGoal(goal.id)).body;
    expect(after.progress).toBe(50);
    expect(after.weeklyPlanCount).toBe(4);
    expect((await api.listGoals("?year=2026")).body[0].progress).toBe(50);
  });

  it("is null without plans or when every plan is empty", async () => {
    const none = await api.createGoal({ year: 2026, title: "빈 목표" });
    expect(none.progress).toBeNull();
    expect((await api.getGoal(none.id)).body.progress).toBeNull();

    const empty = await api.createGoal({ year: 2026, title: "빈 계획 목표" });
    await plan(empty.id, "2026-10-05", []);
    expect((await api.getGoal(empty.id)).body.progress).toBeNull();
  });

  it("follows status changes", async () => {
    const goal = await api.createGoal({ year: 2026, title: "목표" });
    const p = await plan(goal.id, "2026-10-05", ["todo", "todo"]);
    expect((await api.getGoal(goal.id)).body.progress).toBe(0);
    const [first] = (await api.listTodos(`?weeklyPlanId=${p.id}`)).body;
    await api.patchTodo(first.id, { status: "done" });
    expect((await api.getGoal(goal.id)).body.progress).toBe(50);
  });
});

describe("AC-11 daily progress", () => {
  it("is done share of the day's todos, 0 for an empty day", async () => {
    await api.createTodo({ title: "a", date: "2026-10-05", status: "done" });
    await api.createTodo({ title: "b", date: "2026-10-05", status: "done" });
    await api.createTodo({ title: "c", date: "2026-10-05", status: "doing" });
    await api.createTodo({ title: "other day", date: "2026-10-06", status: "todo" });
    expect((await api.daily("?date=2026-10-05")).body).toEqual({
      date: "2026-10-05",
      doneCount: 2,
      totalCount: 3,
      progress: 67,
    });
    expect((await api.daily("?date=2026-10-07")).body.progress).toBe(0);
  });

  it("requires a valid date", async () => {
    expect((await api.daily("")).status).toBe(400);
    expect((await api.daily("?date=2026-02-30")).status).toBe(400);
  });
});

describe("AC-12 hierarchy", () => {
  it("nests goal → plan → todo and groups unlinked plans and todos for the year", async () => {
    const goal = await api.createGoal({ year: 2026, title: "2026 목표" });
    await api.createGoal({ year: 2027, title: "다른 해 목표" });
    const linked = await plan(goal.id, "2026-10-05", ["done", "todo"]);
    const loose = await api.createPlan({ title: "미연결 계획", weekStart: "2026-11-02" });
    await api.createTodo({ title: "loose todo", date: "2026-11-03", weeklyPlanId: loose.id });
    await api.createTodo({ title: "미연결 할 일", date: "2026-12-01" });
    await api.createTodo({ title: "작년 할 일", date: "2025-12-01" });
    await api.createPlan({ title: "작년 계획", weekStart: "2025-06-02" });

    const { status, body } = await api.hierarchy("?year=2026");
    expect(status).toBe(200);
    expect(body.year).toBe(2026);
    expect(body.goals).toHaveLength(1);
    expect(body.goals[0]).toMatchObject({ id: goal.id, progress: 50 });
    expect(body.goals[0].weeklyPlans).toHaveLength(1);
    expect(body.goals[0].weeklyPlans[0]).toMatchObject({ id: linked.id, progress: 50, totalCount: 2 });
    expect(body.goals[0].weeklyPlans[0].todos.map((t: { title: string }) => t.title)).toEqual(["t0", "t1"]);
    expect(body.unlinkedWeeklyPlans.map((p: { title: string }) => p.title)).toEqual(["미연결 계획"]);
    expect(body.unlinkedWeeklyPlans[0].todos.map((t: { title: string }) => t.title)).toEqual(["loose todo"]);
    expect(body.unlinkedTodos.map((t: { title: string }) => t.title)).toEqual(["미연결 할 일"]);
  });

  it("includes a boundary week under the following year's goal", async () => {
    const goal2027 = await api.createGoal({ year: 2027, title: "2027" });
    await api.createPlan({ title: "경계 주", weekStart: "2026-12-28", yearGoalId: goal2027.id });
    const body = (await api.hierarchy("?year=2027")).body;
    expect(body.goals[0].weeklyPlans.map((p: { title: string }) => p.title)).toEqual(["경계 주"]);
  });

  it("requires a valid year", async () => {
    expect((await api.hierarchy("")).status).toBe(400);
    expect((await api.hierarchy("?year=abc")).status).toBe(400);
  });
});

describe("AC-13 unlinked todos", () => {
  it("returns only todos without a weekly plan", async () => {
    const p = await api.createPlan({ title: "p", weekStart: "2026-10-05" });
    await api.createTodo({ title: "linked", date: "2026-10-05", weeklyPlanId: p.id });
    await api.createTodo({ title: "free 1", date: "2026-10-05" });
    await api.createTodo({ title: "free 2", date: "2026-10-20" });
    const body = (await api.listTodos("?unlinked=true")).body;
    expect(body.map((t: { title: string }) => t.title).sort()).toEqual(["free 1", "free 2"]);
    expect(body.every((t: { weeklyPlanId: string | null }) => t.weeklyPlanId === null)).toBe(true);
    expect((await api.listTodos("?unlinked=false")).body).toHaveLength(3);
  });
});

describe("unlinked weekly plans", () => {
  it("returns only plans without a year goal", async () => {
    const goal = await api.createGoal({ year: 2026, title: "g" });
    await api.createPlan({ title: "linked", weekStart: "2026-10-05", yearGoalId: goal.id });
    await api.createPlan({ title: "free", weekStart: "2026-10-12" });
    const body = (await api.listPlans("?unlinked=true")).body;
    expect(body.map((p: { title: string }) => p.title)).toEqual(["free"]);
    expect((await api.listPlans("?unlinked=false")).body).toHaveLength(2);
    expect((await api.listPlans("?unlinked=yes")).status).toBe(400);
  });
});
