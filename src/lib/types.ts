// Shapes returned by the API; shared by server and client code.
import type { TodoStatus } from "./schemas";

export type TodoDTO = {
  id: string;
  title: string;
  date: string;
  weeklyPlanId: string | null;
  status: TodoStatus;
  createdAt: string;
  updatedAt: string;
};

export type WeeklyPlanDTO = {
  id: string;
  title: string;
  weekStart: string;
  weekEnd: string;
  yearGoalId: string | null;
  doneCount: number;
  totalCount: number;
  progress: number;
  createdAt: string;
  updatedAt: string;
};

export type GoalDTO = {
  id: string;
  year: number;
  title: string;
  description: string;
  /** Mean progress of linked plans that have todos; null when none do. */
  progress: number | null;
  weeklyPlanCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DailyProgressDTO = { date: string; doneCount: number; totalCount: number; progress: number };

export type HierarchyPlan = WeeklyPlanDTO & { todos: TodoDTO[] };
export type HierarchyDTO = {
  year: number;
  goals: (GoalDTO & { weeklyPlans: HierarchyPlan[] })[];
  unlinkedWeeklyPlans: HierarchyPlan[];
  unlinkedTodos: TodoDTO[];
};

export type WeeklyPlanImpact = { todoCount: number };
export type GoalImpact = { weeklyPlanCount: number; todoCount: number };
