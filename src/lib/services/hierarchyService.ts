import type { HierarchyDTO, HierarchyPlan, TodoDTO } from "@/lib/types";
import { Todo } from "@/models/Todo";
import { WeeklyPlan } from "@/models/WeeklyPlan";
import { YearGoal } from "@/models/YearGoal";
import { withStats, type GoalRecord } from "./goalService";
import { toTodoDTO, type TodoRecord } from "./todoService";
import { withProgress, type PlanRecord } from "./weeklyPlanService";

/**
 * Goal → weekly plan → todo tree for one year, plus the year's plans without a goal and todos
 * without a plan. A plan belongs to a year when its week starts or ends in it (the same rule as V3,
 * so every plan linked to one of this year's goals is included).
 */
export async function getHierarchy(year: number): Promise<HierarchyDTO> {
  const inYear = { $regex: `^${year}-` };
  const [goalDocs, planDocs, unlinkedTodoDocs] = await Promise.all([
    YearGoal.find({ year }).sort({ createdAt: 1 }).lean<GoalRecord[]>(),
    WeeklyPlan.find({ $or: [{ weekStart: inYear }, { weekEnd: inYear }] })
      .sort({ weekStart: 1, createdAt: 1 })
      .lean<PlanRecord[]>(),
    Todo.find({ weeklyPlanId: null, date: inYear }).sort({ date: 1, createdAt: 1 }).lean<TodoRecord[]>(),
  ]);

  const [goals, plans, planTodoDocs] = await Promise.all([
    withStats(goalDocs),
    withProgress(planDocs),
    Todo.find({ weeklyPlanId: { $in: planDocs.map((plan) => plan._id) } })
      .sort({ date: 1, createdAt: 1 })
      .lean<TodoRecord[]>(),
  ]);

  const todosByPlan = new Map<string, TodoDTO[]>();
  for (const todo of planTodoDocs.map(toTodoDTO)) {
    const planId = todo.weeklyPlanId!;
    todosByPlan.set(planId, [...(todosByPlan.get(planId) ?? []), todo]);
  }
  const withTodos = (plan: (typeof plans)[number]): HierarchyPlan => ({ ...plan, todos: todosByPlan.get(plan.id) ?? [] });

  return {
    year,
    goals: goals.map((goal) => ({
      ...goal,
      weeklyPlans: plans.filter((plan) => plan.yearGoalId === goal.id).map(withTodos),
    })),
    unlinkedWeeklyPlans: plans.filter((plan) => plan.yearGoalId === null).map(withTodos),
    unlinkedTodos: unlinkedTodoDocs.map(toTodoDTO),
  };
}
