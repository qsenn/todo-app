"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, send, toQuery } from "@/lib/client";
import type { DeleteMode, WeeklyPlanCreate, WeeklyPlanUpdate } from "@/lib/schemas";
import type { WeeklyPlanDTO, WeeklyPlanImpact } from "@/lib/types";
import { invalidateTree, keys } from "./queryKeys";

export type WeeklyPlanFilter = { goalId?: string; weekStart?: string; unlinked?: boolean };

export function useWeeklyPlans(filter: WeeklyPlanFilter = {}, enabled = true) {
  return useQuery({
    queryKey: keys.weeklyPlans(filter),
    queryFn: () => apiFetch<WeeklyPlanDTO[]>(`/api/weekly-plans${toQuery(filter)}`),
    enabled,
  });
}

export function useCreateWeeklyPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<WeeklyPlanCreate> & Pick<WeeklyPlanCreate, "title" | "weekStart">) =>
      send<WeeklyPlanDTO>("POST", "/api/weekly-plans", input),
    onSuccess: () => invalidateTree(queryClient),
  });
}

export function useUpdateWeeklyPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: WeeklyPlanUpdate }) =>
      send<WeeklyPlanDTO>("PATCH", `/api/weekly-plans/${id}`, patch),
    onSuccess: () => invalidateTree(queryClient),
  });
}

export function useDeleteWeeklyPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mode }: { id: string; mode?: DeleteMode }) =>
      send<void>("DELETE", `/api/weekly-plans/${id}${toQuery({ mode })}`),
    // Not awaited: the confirm dialog closes right away and the lists refresh when the refetch lands.
    onSuccess: () => {
      void invalidateTree(queryClient);
    },
  });
}

export function fetchWeeklyPlanImpact(id: string) {
  return apiFetch<WeeklyPlanImpact>(`/api/weekly-plans/${id}/impact`);
}
