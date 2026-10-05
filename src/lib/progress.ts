export type Counts = { done: number; total: number };

function percent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/** Share of a weekly plan's linked todos that are done; 0 when it has none. */
export function weeklyProgress(done: number, total: number): number {
  return percent(done, total);
}

/** Share of a day's todos that are done; 0 when the day has none. */
export function dailyProgress(done: number, total: number): number {
  return percent(done, total);
}

/**
 * Mean of the weekly progress of plans that have at least one todo.
 * Plans with no todos yet are left out so an empty, pre-created plan does not drag
 * the goal down; null when no plan qualifies.
 */
export function goalProgress(plans: Counts[]): number | null {
  const started = plans.filter((p) => p.total > 0);
  if (started.length === 0) return null;
  const sum = started.reduce((acc, p) => acc + weeklyProgress(p.done, p.total), 0);
  return Math.round(sum / started.length);
}
