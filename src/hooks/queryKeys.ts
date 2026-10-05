import type { QueryClient } from "@tanstack/react-query";

export const keys = {
  todos: (filter: Record<string, unknown> = {}) => ["todos", filter] as const,
  weeklyPlans: (filter: Record<string, unknown> = {}) => ["weekly-plans", filter] as const,
  goals: (filter: Record<string, unknown> = {}) => ["goals", filter] as const,
  dailyProgress: (date: string) => ["progress", "daily", date] as const,
  hierarchy: (year: number) => ["hierarchy", year] as const,
  impact: (kind: "weekly-plan" | "goal", id: string) => ["impact", kind, id] as const,
};

/**
 * Everything derived from todos/plans/goals: refetch after any change to the tree.
 * In-flight fetches are cancelled first: one that started before the change would otherwise be
 * reused by the refetch (react-query dedupes a first load) and show pre-change data.
 */
export function invalidateTree(queryClient: QueryClient) {
  return Promise.all(
    ["todos", "weekly-plans", "goals", "progress", "hierarchy"].map(async (key) => {
      await queryClient.cancelQueries({ queryKey: [key] });
      await queryClient.invalidateQueries({ queryKey: [key] });
    }),
  );
}
