"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { useToast } from "@/components/Toast";
import { apiFetch, errorMessage, send, toQuery } from "@/lib/client";
import type { TodoCreate, TodoStatus, TodoUpdate } from "@/lib/schemas";
import type { TodoDTO } from "@/lib/types";
import { invalidateTree, keys } from "./queryKeys";

export type TodoFilter = { date?: string; weeklyPlanId?: string; unlinked?: boolean };

export function useTodos(filter: TodoFilter, enabled = true) {
  return useQuery({
    queryKey: keys.todos(filter),
    queryFn: () => apiFetch<TodoDTO[]>(`/api/todos${toQuery(filter)}`),
    enabled,
  });
}

export function useCreateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<TodoCreate> & Pick<TodoCreate, "title" | "date">) =>
      send<TodoDTO>("POST", "/api/todos", input),
    onSuccess: () => invalidateTree(queryClient),
  });
}

export function useUpdateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TodoUpdate }) => send<TodoDTO>("PATCH", `/api/todos/${id}`, patch),
    onSuccess: () => invalidateTree(queryClient),
  });
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => send<void>("DELETE", `/api/todos/${id}`),
    onSuccess: () => invalidateTree(queryClient),
  });
}

const STATUS_KEY = "todo-status";

/**
 * Last status the server confirmed for each card with status changes in flight. Kept at module
 * level because a card remounts when it moves to another column while its requests are pending.
 */
const confirmedStatus = new Map<string, TodoStatus>();

function setCachedStatus(queryClient: QueryClient, todoId: string, status: TodoStatus) {
  queryClient.setQueriesData<TodoDTO[]>({ queryKey: ["todos"] }, (todos) =>
    todos?.map((todo) => (todo.id === todoId ? { ...todo, status } : todo)),
  );
}

function cachedStatus(queryClient: QueryClient, todoId: string): TodoStatus | undefined {
  for (const [, todos] of queryClient.getQueriesData<TodoDTO[]>({ queryKey: ["todos"] })) {
    const found = todos?.find((todo) => todo.id === todoId);
    if (found) return found.status;
  }
}

/**
 * Status change for one card. Requests for the same card share a mutation scope, so they are sent
 * one after another in drop order; onMutate still runs immediately, so the board updates on every drop.
 * A failure rolls back only this card, to the status the server last confirmed.
 */
export function useMoveTodo(todoId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  // Callbacks run while the mutation is still pending, so a count of 1 means "only this one".
  const isLastFor = (mutationKey: QueryKey) => queryClient.isMutating({ mutationKey }) <= 1;

  return useMutation({
    mutationKey: [STATUS_KEY, todoId],
    scope: { id: `todo-${todoId}` },
    mutationFn: (status: TodoStatus) => send<TodoDTO>("PATCH", `/api/todos/${todoId}`, { status }),
    onMutate: async (status) => {
      // Stop in-flight list fetches so a stale response cannot overwrite the optimistic state.
      await queryClient.cancelQueries({ queryKey: ["todos"] });
      const current = cachedStatus(queryClient, todoId);
      if (!confirmedStatus.has(todoId) && current) confirmedStatus.set(todoId, current);
      setCachedStatus(queryClient, todoId, status);
    },
    onSuccess: (todo) => {
      confirmedStatus.set(todoId, todo.status);
    },
    onError: (error) => {
      // A later queued drop for this card owns the screen; only the last one rolls back.
      const confirmed = confirmedStatus.get(todoId);
      if (confirmed && isLastFor([STATUS_KEY, todoId])) setCachedStatus(queryClient, todoId, confirmed);
      toast(`상태를 바꾸지 못했습니다: ${errorMessage(error)}`);
    },
    onSettled: () => {
      if (isLastFor([STATUS_KEY, todoId])) confirmedStatus.delete(todoId);
      // Resync from the server once no card has a status change in flight.
      if (isLastFor([STATUS_KEY])) return invalidateTree(queryClient);
    },
  });
}
