"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, toQuery } from "@/lib/client";
import type { DailyProgressDTO, HierarchyDTO } from "@/lib/types";
import { keys } from "./queryKeys";

export function useDailyProgress(date: string) {
  return useQuery({
    queryKey: keys.dailyProgress(date),
    queryFn: () => apiFetch<DailyProgressDTO>(`/api/progress/daily${toQuery({ date })}`),
  });
}

export function useHierarchy(year: number) {
  return useQuery({
    queryKey: keys.hierarchy(year),
    queryFn: () => apiFetch<HierarchyDTO>(`/api/hierarchy${toQuery({ year })}`),
  });
}
