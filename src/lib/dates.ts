// Calendar dates are plain "YYYY-MM-DD" strings; all arithmetic happens in UTC so
// the server's and browser's time zones never shift a date by a day.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function isValidDate(date: string): boolean {
  return DATE_PATTERN.test(date) && fromUtc(toUtc(date)) === date;
}

export function addDays(date: string, days: number): string {
  return fromUtc(new Date(toUtc(date).getTime() + days * DAY_MS));
}

export function isMonday(date: string): boolean {
  return toUtc(date).getUTCDay() === 1;
}

/** Monday of the week containing `date` (weeks run Monday–Sunday). */
export function toWeekStart(date: string): string {
  const daysSinceMonday = (toUtc(date).getUTCDay() + 6) % 7;
  return addDays(date, -daysSinceMonday);
}

export function weekEnd(weekStart: string): string {
  return addDays(weekStart, 6);
}

export function isWithinWeek(date: string, weekStart: string): boolean {
  // ISO date strings sort lexicographically in calendar order.
  return date >= weekStart && date <= weekEnd(weekStart);
}

export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

/** Today's date in the caller's local time zone. */
export function today(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
