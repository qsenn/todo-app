import { describe, expect, it } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth";
import { Session } from "@/models/Session";
import { anonymous, api, client } from "./http";
import { loginAs } from "../setup/session";

const MONDAY = "2026-10-05";
const SOME_ID = "0123456789abcdef01234567";

describe("API authentication", () => {
  const routes = (c: ReturnType<typeof client>) => [
    () => c.listTodos(),
    () => c.postTodo({ title: "x", date: MONDAY }),
    () => c.getTodo(SOME_ID),
    () => c.patchTodo(SOME_ID, { status: "done" }),
    () => c.deleteTodo(SOME_ID),
    () => c.listPlans(),
    () => c.postPlan({ title: "x", weekStart: MONDAY }),
    () => c.getPlan(SOME_ID),
    () => c.patchPlan(SOME_ID, { title: "y" }),
    () => c.deletePlan(SOME_ID),
    () => c.planImpact(SOME_ID),
    () => c.listGoals(),
    () => c.getGoal(SOME_ID),
    () => c.patchGoal(SOME_ID, { title: "y" }),
    () => c.deleteGoal(SOME_ID),
    () => c.goalImpact(SOME_ID),
    () => c.daily(`?date=${MONDAY}`),
    () => c.hierarchy("?year=2026"),
    () => c.me(),
  ];

  async function expectAll401(c: ReturnType<typeof client>) {
    for (const send of routes(c)) {
      const res = await send();
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    }
  }

  it("rejects requests without a session cookie", async () => {
    await expectAll401(anonymous);
  });

  it("rejects a forged session token", async () => {
    await expectAll401(client(() => `${SESSION_COOKIE}=forged-token`));
  });

  it("rejects an expired session", async () => {
    await Session.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await expectAll401(api);
  });

  it("rejects a session whose user no longer exists", async () => {
    const ghost = await loginAs("ghost");
    const { User } = await import("@/models/User");
    await User.deleteOne({ username: "ghost" });
    expect((await client(() => ghost.cookie).me()).status).toBe(401);
  });

  it("GET /api/me returns the logged-in user", async () => {
    const res = await api.me();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ username: "tester", avatarUrl: "https://avatars.example/tester.png" });
  });
});

describe("per-user isolation through the API", () => {
  async function aliceData() {
    const goal = await api.createGoal({ year: 2026, title: "alice goal" });
    const plan = await api.createPlan({ title: "alice plan", weekStart: MONDAY, yearGoalId: goal.id });
    const todo = await api.createTodo({ title: "alice todo", date: MONDAY, weeklyPlanId: plan.id, status: "done" });
    return { goal, plan, todo };
  }

  it("another user cannot list, read, change or delete someone else's data", async () => {
    const alice = await aliceData();
    const bob = client(() => bobCookie);
    const bobCookie = (await loginAs("bob")).cookie;

    expect((await bob.listTodos()).body).toEqual([]);
    expect((await bob.listTodos(`?date=${MONDAY}`)).body).toEqual([]);
    expect((await bob.listPlans()).body).toEqual([]);
    expect((await bob.listGoals()).body).toEqual([]);

    expect((await bob.getTodo(alice.todo.id)).status).toBe(404);
    expect((await bob.patchTodo(alice.todo.id, { title: "hacked" })).status).toBe(404);
    expect((await bob.deleteTodo(alice.todo.id)).status).toBe(404);
    expect((await bob.getPlan(alice.plan.id)).status).toBe(404);
    expect((await bob.patchPlan(alice.plan.id, { title: "hacked" })).status).toBe(404);
    expect((await bob.deletePlan(alice.plan.id, "cascade")).status).toBe(404);
    expect((await bob.planImpact(alice.plan.id)).status).toBe(404);
    expect((await bob.getGoal(alice.goal.id)).status).toBe(404);
    expect((await bob.patchGoal(alice.goal.id, { title: "hacked" })).status).toBe(404);
    expect((await bob.deleteGoal(alice.goal.id, "cascade")).status).toBe(404);
    expect((await bob.goalImpact(alice.goal.id)).status).toBe(404);

    expect((await api.getTodo(alice.todo.id)).body).toMatchObject({ title: "alice todo", status: "done" });
    expect((await api.getPlan(alice.plan.id)).body).toMatchObject({ title: "alice plan", totalCount: 1 });
    expect((await api.getGoal(alice.goal.id)).body).toMatchObject({ title: "alice goal", progress: 100 });
  });

  it("another user cannot link to someone else's plan or goal", async () => {
    const alice = await aliceData();
    const bobCookie = (await loginAs("bob")).cookie;
    const bob = client(() => bobCookie);

    expect((await bob.postTodo({ title: "x", date: MONDAY, weeklyPlanId: alice.plan.id })).status).toBe(404);
    expect((await bob.postPlan({ title: "x", weekStart: MONDAY, yearGoalId: alice.goal.id })).status).toBe(404);
    const own = await bob.createTodo({ title: "bob todo", date: MONDAY });
    expect((await bob.patchTodo(own.id, { weeklyPlanId: alice.plan.id })).status).toBe(404);
    expect((await api.getPlan(alice.plan.id)).body.totalCount).toBe(1);
  });

  it("progress, daily progress and hierarchy only count the caller's data", async () => {
    const alice = await aliceData();
    const bobCookie = (await loginAs("bob")).cookie;
    const bob = client(() => bobCookie);
    const bobGoal = await bob.createGoal({ year: 2026, title: "bob goal" });
    const bobPlan = await bob.createPlan({ title: "bob plan", weekStart: MONDAY, yearGoalId: bobGoal.id });
    await bob.createTodo({ title: "b1", date: MONDAY, weeklyPlanId: bobPlan.id });
    await bob.createTodo({ title: "b2", date: MONDAY, weeklyPlanId: bobPlan.id });

    expect((await api.daily(`?date=${MONDAY}`)).body).toMatchObject({ doneCount: 1, totalCount: 1, progress: 100 });
    expect((await bob.daily(`?date=${MONDAY}`)).body).toMatchObject({ doneCount: 0, totalCount: 2, progress: 0 });
    expect((await api.getPlan(alice.plan.id)).body).toMatchObject({ doneCount: 1, totalCount: 1 });
    expect((await bob.getGoal(bobGoal.id)).body.progress).toBe(0);

    const aliceTree = (await api.hierarchy("?year=2026")).body;
    expect(aliceTree.goals.map((g: { title: string }) => g.title)).toEqual(["alice goal"]);
    expect(aliceTree.goals[0].weeklyPlans[0].todos.map((t: { title: string }) => t.title)).toEqual(["alice todo"]);
    const bobTree = (await bob.hierarchy("?year=2026")).body;
    expect(bobTree.goals.map((g: { title: string }) => g.title)).toEqual(["bob goal"]);
  });
});
