import type { TodoStatus } from "./schemas";

export const STATUS_LABELS: Record<TodoStatus, string> = {
  todo: "할 일",
  doing: "진행 중",
  done: "완료",
};

export function formatWeek(weekStart: string, weekEnd: string) {
  return `${weekStart} ~ ${weekEnd}`;
}
