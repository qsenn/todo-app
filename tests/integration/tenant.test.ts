import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { runAsUser, runUnscoped } from "@/lib/tenant";
import { Todo } from "@/models/Todo";
import { WeeklyPlan } from "@/models/WeeklyPlan";
import { YearGoal } from "@/models/YearGoal";
import { loginAs, testAuth } from "../setup/session";

async function seedFor(userId: string) {
  return runAsUser(userId, async () => {
    const goal = await YearGoal.create({ year: 2026, title: "goal" });
    const plan = await WeeklyPlan.create({ title: "plan", weekStart: "2026-10-05", weekEnd: "2026-10-11", yearGoalId: goal._id });
    const todo = await Todo.create({ title: "todo", date: "2026-10-05", weeklyPlanId: plan._id, status: "done" });
    return { goal, plan, todo };
  });
}

describe("owner scoping plugin", () => {
  it("confines every query, update, delete and aggregation to the scoped user", async () => {
    const a = await seedFor(testAuth.userId);
    const bob = await loginAs("bob");

    await runAsUser(bob.userId, async () => {
      expect(await Todo.find()).toHaveLength(0);
      expect(await Todo.findById(a.todo._id)).toBeNull();
      expect(await Todo.exists({ _id: a.todo._id })).toBeNull();
      expect(await Todo.countDocuments()).toBe(0);
      expect(await WeeklyPlan.distinct("_id")).toEqual([]);
      expect((await Todo.updateMany({}, { $set: { title: "hacked" } })).modifiedCount).toBe(0);
      expect((await Todo.updateOne({ _id: a.todo._id }, { $set: { title: "hacked" } })).modifiedCount).toBe(0);
      expect(await Todo.findOneAndUpdate({ _id: a.todo._id }, { $set: { title: "hacked" } })).toBeNull();
      expect(await Todo.findOneAndDelete({ _id: a.todo._id })).toBeNull();
      expect((await Todo.deleteOne({ _id: a.todo._id })).deletedCount).toBe(0);
      expect((await YearGoal.deleteMany({})).deletedCount).toBe(0);
      expect(await Todo.aggregate([{ $group: { _id: null, n: { $sum: 1 } } }])).toEqual([]);
    });

    await runAsUser(testAuth.userId, async () => {
      expect((await Todo.findById(a.todo._id))!.title).toBe("todo");
      expect(await Todo.countDocuments()).toBe(1);
      expect(await Todo.aggregate([{ $group: { _id: null, n: { $sum: 1 } } }])).toEqual([{ _id: null, n: 1 }]);
    });
  });

  it("stamps new documents with the scoped user and refuses to save another user's document", async () => {
    const bob = await loginAs("bob");
    const todo = await runAsUser(bob.userId, () => Todo.create({ title: "bob's", date: "2026-10-05" }));
    expect(String(todo.get("userId"))).toBe(bob.userId);

    await runAsUser(testAuth.userId, async () => {
      todo.title = "stolen";
      await expect(todo.save()).rejects.toThrow(/another user/);
      const forged = new Todo({ title: "forged", date: "2026-10-05" });
      forged.set("userId", bob.userId);
      await expect(forged.save()).rejects.toThrow(/another user/);
    });
  });

  it("refuses operations that could reach another user's data", async () => {
    const a = await seedFor(testAuth.userId);
    const bob = await loginAs("bob");

    await runAsUser(bob.userId, async () => {
      await expect(Todo.bulkWrite([{ updateMany: { filter: {}, update: { $set: { title: "pwned" } } } }])).rejects.toThrow(
        /bulkWrite/,
      );
      await expect(Todo.estimatedDocumentCount()).rejects.toThrow(/estimatedDocumentCount/);
      const lookup = { $lookup: { from: "weeklyplans", localField: "weeklyPlanId", foreignField: "_id", as: "plan" } };
      await expect(Todo.aggregate([lookup])).rejects.toThrow(/\$lookup/);
      await expect(Todo.aggregate([{ $facet: { joined: [lookup] } }])).rejects.toThrow(/\$lookup/);
      await expect(Todo.aggregate([{ $unionWith: "todos" }])).rejects.toThrow(/\$unionWith/);
    });

    await runAsUser(testAuth.userId, async () => {
      expect((await Todo.findById(a.todo._id))!.title).toBe("todo");
    });
  });

  it("never lets an update change the owner", async () => {
    const a = await seedFor(testAuth.userId);
    const bob = await loginAs("bob");

    await runAsUser(testAuth.userId, async () => {
      await expect(Todo.updateOne({ _id: a.todo._id }, { $set: { userId: bob.userId } })).rejects.toThrow(/userId/);
      await expect(Todo.updateMany({}, { userId: bob.userId })).rejects.toThrow(/userId/);
      await expect(Todo.findOneAndUpdate({ _id: a.todo._id }, { $unset: { userId: 1 } })).rejects.toThrow(/userId/);
      await expect(
        Todo.updateOne({ _id: a.todo._id }, [{ $set: { userId: bob.userId } }], { updatePipeline: true }),
      ).rejects.toThrow(/userId/);
      const gift = [{ $replaceWith: { $mergeObjects: ["$$ROOT", { userId: new Types.ObjectId(bob.userId) }] } }];
      await expect(Todo.updateOne({ _id: a.todo._id }, gift, { updatePipeline: true })).rejects.toThrow(/pipeline/);
      await expect(Todo.updateOne({ _id: a.todo._id }, [{ $unset: "userId" }], { updatePipeline: true })).rejects.toThrow(
        /pipeline/,
      );
      await expect(Todo.updateOne({ _id: a.todo._id }, { $rename: { title: "userId" } })).rejects.toThrow(/userId/);
      await expect(Todo.updateOne({ _id: a.todo._id }, { $rename: { userId: "owner" } })).rejects.toThrow(/userId/);
      // Ordinary updates still work.
      expect((await Todo.updateOne({ _id: a.todo._id }, { $set: { title: "renamed" } })).modifiedCount).toBe(1);

      // A replacement without userId keeps the scoped owner instead of orphaning the document.
      await Todo.replaceOne({ _id: a.todo._id }, { title: "replaced", date: "2026-10-05", status: "todo" });
      const replaced = await Todo.findById(a.todo._id);
      expect(replaced!.title).toBe("replaced");
      expect(String(replaced!.get("userId"))).toBe(testAuth.userId);
    });

    expect(await runAsUser(bob.userId, () => Todo.countDocuments())).toBe(0);
  });

  it("fails closed without a user context", async () => {
    await expect(Todo.find()).rejects.toThrow(/No user context/);
    await expect(Todo.countDocuments()).rejects.toThrow(/No user context/);
    await expect(Todo.aggregate([{ $match: {} }])).rejects.toThrow(/No user context/);
    await expect(Todo.create({ title: "x", date: "2026-10-05" })).rejects.toThrow(/No user context/);
    await expect(Todo.deleteMany({})).rejects.toThrow(/No user context/);
  });

  it("keeps the scope for lazily executed queries", async () => {
    await seedFor(testAuth.userId);
    // The query object is returned, not awaited, inside the callback.
    expect(await runAsUser(testAuth.userId, () => Todo.countDocuments())).toBe(1);
    expect(await runAsUser((await loginAs("carol")).userId, () => Todo.find())).toEqual([]);
  });

  it("runUnscoped sees every user's documents (maintenance only)", async () => {
    await seedFor(testAuth.userId);
    await seedFor((await loginAs("bob")).userId);
    expect(await runUnscoped(() => Todo.countDocuments())).toBe(2);
  });

  it("requires an owner on every document", async () => {
    // Unscoped saves get no automatic owner, so a document without userId is rejected.
    await expect(runUnscoped(() => Todo.create({ title: "orphan", date: "2026-10-05" }))).rejects.toThrow(/userId/);
  });
});
