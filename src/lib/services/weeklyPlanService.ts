import { Types } from "mongoose";
import { weekEnd, yearOf } from "@/lib/dates";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { weeklyProgress, type Counts } from "@/lib/progress";
import type { DeleteMode, WeeklyPlanCreate, WeeklyPlanUpdate } from "@/lib/schemas";
import type { WeeklyPlanDTO, WeeklyPlanImpact } from "@/lib/types";
import { Todo } from "@/models/Todo";
import { WeeklyPlan, type WeeklyPlanDoc } from "@/models/WeeklyPlan";
import { YearGoal } from "@/models/YearGoal";

export type PlanRecord = WeeklyPlanDoc & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

/** Done/total todo counts per weekly plan, computed in one aggregation. */
export async function countTodosByPlan(planIds: Types.ObjectId[]): Promise<Map<string, Counts>> {
  const rows = await Todo.aggregate<{ _id: Types.ObjectId; total: number; done: number }>([
    { $match: { weeklyPlanId: { $in: planIds } } },
    {
      $group: {
        _id: "$weeklyPlanId",
        total: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((row) => [String(row._id), { done: row.done, total: row.total }]));
}

function toPlanDTO(doc: PlanRecord, counts: Counts = { done: 0, total: 0 }): WeeklyPlanDTO {
  return {
    id: String(doc._id),
    title: doc.title,
    weekStart: doc.weekStart,
    weekEnd: doc.weekEnd,
    yearGoalId: doc.yearGoalId ? String(doc.yearGoalId) : null,
    doneCount: counts.done,
    totalCount: counts.total,
    progress: weeklyProgress(counts.done, counts.total),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function withProgress(docs: PlanRecord[]): Promise<WeeklyPlanDTO[]> {
  const counts = await countTodosByPlan(docs.map((doc) => doc._id));
  return docs.map((doc) => toPlanDTO(doc, counts.get(String(doc._id))));
}

export type WeeklyPlanFilter = { goalId?: string; weekStart?: string; unlinked?: boolean };

export async function listWeeklyPlans(filter: WeeklyPlanFilter = {}): Promise<WeeklyPlanDTO[]> {
  const query: Record<string, unknown> = {};
  if (filter.goalId) query.yearGoalId = new Types.ObjectId(filter.goalId);
  if (filter.weekStart) query.weekStart = filter.weekStart;
  if (filter.unlinked) query.yearGoalId = null;
  const docs = await WeeklyPlan.find(query).sort({ weekStart: 1, createdAt: 1 }).lean<PlanRecord[]>();
  return withProgress(docs);
}

export async function getWeeklyPlan(id: string): Promise<WeeklyPlanDTO> {
  const doc = await WeeklyPlan.findById(id).lean<PlanRecord>();
  if (!doc) throw notFound("주간 계획");
  return (await withProgress([doc]))[0];
}

/** V3/V4: a plan linked to a goal must have its start or end in the goal's year. */
async function assertFitsGoal(weekStart: string, yearGoalId: string, code: string) {
  const goal = await YearGoal.findById(yearGoalId).lean();
  if (!goal) throw notFound("1년 목표");
  const end = weekEnd(weekStart);
  if (yearOf(weekStart) !== goal.year && yearOf(end) !== goal.year) {
    throw badRequest(code, `${weekStart}~${end} 주는 ${goal.year}년 목표에 연결할 수 없습니다.`, {
      count: 1,
      goalYear: goal.year,
    });
  }
}

export async function createWeeklyPlan(input: WeeklyPlanCreate): Promise<WeeklyPlanDTO> {
  if (input.yearGoalId) await assertFitsGoal(input.weekStart, input.yearGoalId, "V3_YEAR_MISMATCH");
  const doc = await WeeklyPlan.create({ ...input, weekEnd: weekEnd(input.weekStart) });
  return toPlanDTO(doc.toObject() as PlanRecord);
}

export async function updateWeeklyPlan(id: string, patch: WeeklyPlanUpdate): Promise<WeeklyPlanDTO> {
  const current = await WeeklyPlan.findById(id).lean<PlanRecord>();
  if (!current) throw notFound("주간 계획");

  const nextStart = patch.weekStart ?? current.weekStart;
  const nextEnd = weekEnd(nextStart);
  const startChanged = nextStart !== current.weekStart;

  // V6: every linked todo must still fit the new week; nothing is unlinked silently.
  if (startChanged) {
    const outOfRange = await Todo.countDocuments({
      weeklyPlanId: current._id,
      $or: [{ date: { $lt: nextStart } }, { date: { $gt: nextEnd } }],
    });
    if (outOfRange > 0) {
      throw badRequest(
        "V6_TODOS_OUT_OF_RANGE",
        `이 주에 연결된 할 일 ${outOfRange}개가 새 기간(${nextStart}~${nextEnd})을 벗어납니다. 먼저 연결을 해제하거나 날짜를 옮기세요.`,
        { count: outOfRange, weekStart: nextStart, weekEnd: nextEnd },
      );
    }
  }

  const nextGoalId =
    patch.yearGoalId !== undefined ? patch.yearGoalId : current.yearGoalId ? String(current.yearGoalId) : null;
  if (nextGoalId && (startChanged || patch.yearGoalId !== undefined)) {
    await assertFitsGoal(nextStart, nextGoalId, "V6_YEAR_MISMATCH");
  }

  const updated = await WeeklyPlan.findByIdAndUpdate(
    id,
    { $set: { ...patch, weekEnd: nextEnd } },
    { returnDocument: "after", runValidators: true },
  ).lean<PlanRecord>();
  if (!updated) throw notFound("주간 계획");
  return (await withProgress([updated]))[0];
}

export async function getWeeklyPlanImpact(id: string): Promise<WeeklyPlanImpact> {
  if (!(await WeeklyPlan.exists({ _id: id }))) throw notFound("주간 계획");
  return { todoCount: await Todo.countDocuments({ weeklyPlanId: id }) };
}

/** Children are handled before the plan itself, so a retry after a partial failure finishes the job. */
export async function deleteWeeklyPlan(id: string, mode: DeleteMode): Promise<void> {
  const { todoCount } = await getWeeklyPlanImpact(id);
  if (todoCount > 0 && !mode) {
    throw conflict("HAS_CHILDREN", `연결된 할 일 ${todoCount}개가 있습니다. 처리 방식(mode)을 선택하세요.`, {
      todoCount,
    });
  }
  if (mode === "unlink") await Todo.updateMany({ weeklyPlanId: id }, { $set: { weeklyPlanId: null } });
  if (mode === "cascade") await Todo.deleteMany({ weeklyPlanId: id });
  await WeeklyPlan.deleteOne({ _id: id });
}
