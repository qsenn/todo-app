import mongoose, { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { confirmTarget, describeHost, migrateUserId, OWNED_COLLECTIONS } from "../../scripts/migrate-user-id.mjs";

const db = () => mongoose.connection.db!;
const owner = new Types.ObjectId();

async function seed() {
  for (const name of OWNED_COLLECTIONS as string[]) {
    // Raw driver writes: legacy documents never went through the owner plugin.
    await db().collection(name).insertMany([{ legacy: 1 }, { legacy: 2, userId: null }, { userId: owner }]);
  }
}

describe("migrate:user-id", () => {
  it("dry run reports documents without userId and deletes nothing", async () => {
    await seed();
    const lines: string[] = [];
    const result = await migrateUserId(db(), { log: (line: string) => lines.push(line) });
    expect(result).toEqual({ todos: 2, weeklyplans: 2, yeargoals: 2 });
    for (const name of OWNED_COLLECTIONS as string[]) expect(await db().collection(name).countDocuments()).toBe(3);
    expect(lines).toHaveLength(OWNED_COLLECTIONS.length);
  });

  it("parses --confirm=<dbName> and shows the host without credentials", () => {
    expect(confirmTarget(["node", "x"])).toBeUndefined();
    expect(confirmTarget(["node", "x", "--confirm=prod"])).toBe("prod");
    expect(confirmTarget(["node", "x", "--confirm"])).toBe("");
    expect(describeHost("mongodb+srv://user:secret@cluster0.abc.mongodb.net/app?retryWrites=true")).toBe(
      "cluster0.abc.mongodb.net",
    );
    expect(describeHost("mongodb://127.0.0.1:27017/app")).toBe("127.0.0.1:27017");
  });

  it("--confirm deletes only documents without userId and is safe to rerun", async () => {
    await seed();
    const silent = () => {};
    expect(await migrateUserId(db(), { confirm: true, log: silent })).toEqual({ todos: 2, weeklyplans: 2, yeargoals: 2 });
    for (const name of OWNED_COLLECTIONS as string[]) {
      const left = await db().collection(name).find().toArray();
      expect(left).toHaveLength(1);
      expect(String(left[0].userId)).toBe(String(owner));
    }
    expect(await migrateUserId(db(), { confirm: true, log: silent })).toEqual({ todos: 0, weeklyplans: 0, yeargoals: 0 });
  });

  it("targets the collections the owned models actually use", async () => {
    const { Todo } = await import("@/models/Todo");
    const { WeeklyPlan } = await import("@/models/WeeklyPlan");
    const { YearGoal } = await import("@/models/YearGoal");
    expect([Todo, WeeklyPlan, YearGoal].map((m) => m.collection.collectionName)).toEqual(OWNED_COLLECTIONS);
  });
});
