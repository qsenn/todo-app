"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, send, toQuery } from "@/lib/client";
import type { DeleteMode, GoalCreate, GoalUpdate } from "@/lib/schemas";
import type { GoalDTO, GoalImpact } from "@/lib/types";
import { invalidateTree, keys } from "./queryKeys";

export function useGoals(filter: { year?: number } = {}) {
  return useQuery({
    queryKey: keys.goals(filter),
    queryFn: () => apiFetch<GoalDTO[]>(`/api/goals${toQuery(filter)}`),
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GoalCreate) => send<GoalDTO>("POST", "/api/goals", input),
    onSuccess: () => invalidateTree(queryClient),
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: GoalUpdate }) => send<GoalDTO>("PATCH", `/api/goals/${id}`, patch),
    onSuccess: () => invalidateTree(queryClient),
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mode }: { id: string; mode?: DeleteMode }) =>
      send<void>("DELETE", `/api/goals/${id}${toQuery({ mode })}`),
    // Not awaited: the confirm dialog closes right away and the lists refresh when the refetch lands.
    onSuccess: () => {
      void invalidateTree(queryClient);
    },
  });
}

export function fetchGoalImpact(id: string) {
  return apiFetch<GoalImpact>(`/api/goals/${id}/impact`);
}
