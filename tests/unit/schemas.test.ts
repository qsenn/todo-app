import { describe, expect, it } from "vitest";
import { todoCreateSchema, todoUpdateSchema, weeklyPlanCreateSchema, goalCreateSchema } from "@/lib/schemas";

describe("schemas", () => {
  it("defaults todo status to todo and weeklyPlanId to null", () => {
    const parsed = todoCreateSchema.parse({ title: "운동", date: "2026-10-05" });
    expect(parsed).toEqual({ title: "운동", date: "2026-10-05", status: "todo", weeklyPlanId: null });
  });

  it("rejects blank and over-long titles", () => {
    expect(todoCreateSchema.safeParse({ title: "   ", date: "2026-10-05" }).success).toBe(false);
    expect(todoCreateSchema.safeParse({ title: "a".repeat(201), date: "2026-10-05" }).success).toBe(false);
    expect(todoCreateSchema.safeParse({ title: "a".repeat(200), date: "2026-10-05" }).success).toBe(true);
  });

  it("trims titles", () => {
    expect(todoCreateSchema.parse({ title: "  책 읽기 ", date: "2026-10-05" }).title).toBe("책 읽기");
  });

  it("rejects unknown status and malformed dates", () => {
    expect(todoCreateSchema.safeParse({ title: "x", date: "2026-10-05", status: "blocked" }).success).toBe(false);
    expect(todoCreateSchema.safeParse({ title: "x", date: "2026/10/05" }).success).toBe(false);
    expect(todoCreateSchema.safeParse({ title: "x", date: "2026-02-30" }).success).toBe(false);
  });

  it("rejects malformed ObjectIds and unknown fields", () => {
    expect(todoCreateSchema.safeParse({ title: "x", date: "2026-10-05", weeklyPlanId: "123" }).success).toBe(false);
    expect(todoCreateSchema.safeParse({ title: "x", date: "2026-10-05", extra: 1 }).success).toBe(false);
  });

  it("requires a Monday weekStart", () => {
    expect(weeklyPlanCreateSchema.safeParse({ title: "1주차", weekStart: "2026-10-06" }).success).toBe(false);
    expect(weeklyPlanCreateSchema.safeParse({ title: "1주차", weekStart: "2026-10-05" }).success).toBe(true);
  });

  it("rejects empty updates and accepts null unlinking", () => {
    expect(todoUpdateSchema.safeParse({}).success).toBe(false);
    expect(todoUpdateSchema.parse({ weeklyPlanId: null })).toEqual({ weeklyPlanId: null });
  });

  it("validates goal year", () => {
    expect(goalCreateSchema.safeParse({ year: 2026.5, title: "x" }).success).toBe(false);
    expect(goalCreateSchema.safeParse({ year: 2026, title: "x" }).success).toBe(true);
  });
});
