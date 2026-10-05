import { describe, expect, it } from "vitest";
import { addDays, isMonday, isValidDate, isWithinWeek, toWeekStart, today, weekEnd, yearOf } from "@/lib/dates";

describe("dates", () => {
  it("validates real calendar dates only", () => {
    expect(isValidDate("2026-10-05")).toBe(true);
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(isValidDate("2026-02-29")).toBe(false);
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("2026-1-5")).toBe(false);
    expect(isValidDate("not-a-date")).toBe(false);
  });

  it("detects Mondays", () => {
    expect(isMonday("2026-10-05")).toBe(true);
    expect(isMonday("2026-10-04")).toBe(false);
    expect(isMonday("2026-12-28")).toBe(true);
  });

  it("finds the Monday of a week, including Sunday and year boundaries", () => {
    expect(toWeekStart("2026-10-05")).toBe("2026-10-05");
    expect(toWeekStart("2026-10-11")).toBe("2026-10-05");
    expect(toWeekStart("2027-01-03")).toBe("2026-12-28");
    expect(toWeekStart("2027-01-01")).toBe("2026-12-28");
  });

  it("computes week end as start + 6 days across month, year and leap boundaries", () => {
    expect(weekEnd("2026-10-05")).toBe("2026-10-11");
    expect(weekEnd("2026-12-28")).toBe("2027-01-03");
    expect(weekEnd("2028-02-28")).toBe("2028-03-05");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("checks whether a date falls inside a week", () => {
    expect(isWithinWeek("2026-12-28", "2026-12-28")).toBe(true);
    expect(isWithinWeek("2027-01-03", "2026-12-28")).toBe(true);
    expect(isWithinWeek("2027-01-04", "2026-12-28")).toBe(false);
    expect(isWithinWeek("2026-12-27", "2026-12-28")).toBe(false);
    expect(isWithinWeek("2028-02-29", "2028-02-28")).toBe(true);
    expect(isWithinWeek("2028-03-05", "2028-02-28")).toBe(true);
  });

  it("extracts the year and formats local today", () => {
    expect(yearOf("2027-01-03")).toBe(2027);
    expect(today(new Date(2026, 0, 7, 23, 59))).toBe("2026-01-07");
  });
});
