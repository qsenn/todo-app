import { describe, expect, it } from "vitest";
import { dailyProgress, goalProgress, weeklyProgress } from "@/lib/progress";

describe("weeklyProgress / dailyProgress", () => {
  it.each([
    [0, 0, 0],
    [0, 4, 0],
    [1, 4, 25],
    [1, 3, 33],
    [2, 3, 67],
    [3, 3, 100],
  ])("%i done of %i -> %i", (done, total, expected) => {
    expect(weeklyProgress(done, total)).toBe(expected);
    expect(dailyProgress(done, total)).toBe(expected);
  });
});

describe("goalProgress", () => {
  it("averages plans that have todos", () => {
    expect(goalProgress([{ done: 2, total: 2 }, { done: 1, total: 2 }, { done: 0, total: 3 }])).toBe(50);
  });

  it("ignores plans with no todos", () => {
    expect(
      goalProgress([{ done: 2, total: 2 }, { done: 1, total: 2 }, { done: 0, total: 3 }, { done: 0, total: 0 }]),
    ).toBe(50);
  });

  it("returns null when no plan has todos", () => {
    expect(goalProgress([])).toBeNull();
    expect(goalProgress([{ done: 0, total: 0 }])).toBeNull();
  });

  it("rounds the mean of rounded weekly values", () => {
    // 33 and 67 -> 50; 33 and 33 and 100 -> 55
    expect(goalProgress([{ done: 1, total: 3 }, { done: 2, total: 3 }])).toBe(50);
    expect(goalProgress([{ done: 1, total: 3 }, { done: 1, total: 3 }, { done: 1, total: 1 }])).toBe(55);
  });
});
