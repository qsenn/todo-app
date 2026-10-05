import { Types } from "mongoose";
import { yearOf } from "@/lib/dates";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { goalProgress, type Counts } from "@/lib/progress";
import type { DeleteMode, GoalCreate, GoalUpdate } from "@/lib/schemas";
import type { GoalDTO, GoalImpact } from "@/lib/types";
import { Todo } from "@/models/Todo";
import { WeeklyPlan } from "@/models/WeeklyPlan";
import { YearGoal, type YearGoalDoc } from "@/models/YearGoal";
import { countTodosByPlan } from "./weeklyPlanService";

export type GoalRecord = YearGoalDoc & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

function toGoalDTO(doc: GoalRecord, plans: Counts[] = []): GoalDTO {
  return {
    id: String(doc._id),
    year: doc.year,
    title: doc.title,
    description: doc.description ?? "",
    progress: goalProgress(plans),
    weeklyPlanCount: plans.length,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Adds plan counts and progress: one query for the plans, one aggregation for their todos. */
export async function withStats(docs: GoalRecord[]): Promise<GoalDTO[]> {
  const plans = await WeeklyPlan.find({ yearGoalId: { $in: docs.map((doc) => doc._id) } }, { yearGoalId: 1 }).lean();
  const todoCounts = await countTodosByPlan(plans.map((plan) => plan._id));
  const byGoal = new Map<string, Counts[]>();
  for (const plan of plans) {
    const key = String(plan.yearGoalId);
    byGoal.set(key, [...(byGoal.get(key) ?? []), todoCounts.get(String(plan._id)) ?? { done: 0, total: 0 }]);
  }
  return docs.map((doc) => toGoalDTO(doc, byGoal.get(String(doc._id))));
}

export async function listGoals(filter: { year?: number } = {}): Promise<GoalDTO[]> {
  const query = filter.year !== undefined ? { year: filter.year } : {};
  const docs = await YearGoal.find(query).sort({ year: -1, createdAt: 1 }).lean<GoalRecord[]>();
  return withStats(docs);
}

export async function getGoal(id: string): Promise<GoalDTO> {
  const doc = await YearGoal.findById(id).lean<GoalRecord>();
  if (!doc) throw notFound("1년 목표");
  return (await withStats([doc]))[0];
}

export async function createGoal(input: GoalCreate): Promise<GoalDTO> {
  const doc = await YearGoal.create(input);
  return toGoalDTO(doc.toObject() as GoalRecord);
}

export async function updateGoal(id: string, patch: GoalUpdate): Promise<GoalDTO> {
  const current = await YearGoal.findById(id).lean<GoalRecord>();
  if (!current) throw notFound("1년 목표");

  // V6: changing the year must keep every linked plan valid under V3.
  if (patch.year !== undefined && patch.year !== current.year) {
    const plans = await WeeklyPlan.find({ yearGoalId: current._id }, { weekStart: 1, weekEnd: 1 }).lean();
    const mismatched = plans.filter((p) => yearOf(p.weekStart) !== patch.year && yearOf(p.weekEnd) !== patch.year);
    if (mismatched.length > 0) {
      throw badRequest(
        "V6_YEAR_MISMATCH",
        `연결된 주간 계획 ${mismatched.length}개가 ${patch.year}년에 속하지 않습니다. 먼저 연결을 해제하세요.`,
        { count: mismatched.length, goalYear: patch.year },
      );
    }
  }

  const updated = await YearGoal.findByIdAndUpdate(
    id,
    { $set: patch },
    { returnDocument: "after", runValidators: true },
  ).lean<GoalRecord>();
  if (!updated) throw notFound("1년 목표");
  return (await withStats([updated]))[0];
}

async function loadChildren(id: string) {
  if (!(await YearGoal.exists({ _id: id }))) throw notFound("1년 목표");
  const planIds = (await WeeklyPlan.find({ yearGoalId: id }, { _id: 1 }).lean()).map((p) => p._id);
  const todoCount = planIds.length ? await Todo.countDocuments({ weeklyPlanId: { $in: planIds } }) : 0;
  return { planIds, todoCount };
}

export async function getGoalImpact(id: string): Promise<GoalImpact> {
  const { planIds, todoCount } = await loadChildren(id);
  return { weeklyPlanCount: planIds.length, todoCount };
}

/** Deletes leaves first (todos, then plans, then the goal) so a retried cascade completes. */
export async function deleteGoal(id: string, mode: DeleteMode): Promise<void> {
  const { planIds, todoCount } = await loadChildren(id);
  const weeklyPlanCount = planIds.length;
  if (weeklyPlanCount > 0 && !mode) {
    throw conflict(
      "HAS_CHILDREN",
      `연결된 주간 계획 ${weeklyPlanCount}개가 있습니다. 처리 방식(mode)을 선택하세요.`,
      { weeklyPlanCount, todoCount },
    );
  }
  if (mode === "unlink") {
    await WeeklyPlan.updateMany({ yearGoalId: id }, { $set: { yearGoalId: null } });
  }
  if (mode === "cascade") {
    await Todo.deleteMany({ weeklyPlanId: { $in: planIds } });
    await WeeklyPlan.deleteMany({ _id: { $in: planIds } });
  }
  await YearGoal.deleteOne({ _id: id });
}
