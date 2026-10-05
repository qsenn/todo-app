import type { Collection } from "mongoose";
import { describe, expect, it } from "vitest";
import { runAsUser } from "@/lib/tenant";
import { Session } from "@/models/Session";
import { Todo } from "@/models/Todo";
import { User } from "@/models/User";
import { WeeklyPlan } from "@/models/WeeklyPlan";
import { YearGoal } from "@/models/YearGoal";
import { testAuth } from "../setup/session";

async function indexKeys(model: { collection: Collection }) {
  return (await model.collection.indexes()).map((index) => index.key);
}

const asTester = <T>(fn: () => Promise<T>) => runAsUser(testAuth.userId, fn);

describe("models", () => {
  it("declare the planned indexes, owned ones prefixed by userId", async () => {
    expect(await indexKeys(Todo)).toEqual(
      expect.arrayContaining([{ userId: 1, date: 1 }, { userId: 1, weeklyPlanId: 1, status: 1 }]),
    );
    expect(await indexKeys(WeeklyPlan)).toEqual(
      expect.arrayContaining([{ userId: 1, yearGoalId: 1 }, { userId: 1, weekStart: 1 }]),
    );
    expect(await indexKeys(YearGoal)).toEqual(expect.arrayContaining([{ userId: 1, year: 1 }]));
    expect(await indexKeys(User)).toEqual(expect.arrayContaining([{ githubId: 1 }]));
    expect(await indexKeys(Session)).toEqual(expect.arrayContaining([{ tokenHash: 1 }, { expiresAt: 1 }]));
    const ttl = (await Session.collection.indexes()).find((index) => index.key.expiresAt === 1);
    expect(ttl?.expireAfterSeconds).toBe(0);
    const unique = (await User.collection.indexes()).find((index) => index.key.githubId === 1);
    expect(unique?.unique).toBe(true);
  });

  it("applies defaults and stamps the owner", async () => {
    await asTester(async () => {
      const todo = await Todo.create({ title: "x", date: "2026-10-05" });
      expect(todo.status).toBe("todo");
      expect(todo.weeklyPlanId).toBeNull();
      expect(String(todo.get("userId"))).toBe(testAuth.userId);
      const plan = await WeeklyPlan.create({ title: "w", weekStart: "2026-10-05", weekEnd: "2026-10-11" });
      expect(plan.yearGoalId).toBeNull();
      expect(String(plan.get("userId"))).toBe(testAuth.userId);
    });
  });

  it("rejects an invalid status at the model layer", async () => {
    await asTester(() =>
      expect(Todo.create({ title: "x", date: "2026-10-05", status: "nope" as "todo" })).rejects.toThrow(),
    );
  });
});
