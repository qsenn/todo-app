import { Types } from "mongoose";
import { isWithinWeek } from "@/lib/dates";
import { badRequest, notFound } from "@/lib/errors";
import type { TodoCreate, TodoUpdate } from "@/lib/schemas";
import type { TodoDTO } from "@/lib/types";
import { Todo, type TodoDoc } from "@/models/Todo";
import { WeeklyPlan } from "@/models/WeeklyPlan";

export type TodoRecord = TodoDoc & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

export function toTodoDTO(doc: TodoRecord): TodoDTO {
  return {
    id: String(doc._id),
    title: doc.title,
    date: doc.date,
    weeklyPlanId: doc.weeklyPlanId ? String(doc.weeklyPlanId) : null,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export type TodoFilter = { date?: string; weeklyPlanId?: string; unlinked?: boolean };

export async function listTodos(filter: TodoFilter = {}): Promise<TodoDTO[]> {
  const query: Record<string, unknown> = {};
  if (filter.date) query.date = filter.date;
  if (filter.weeklyPlanId) query.weeklyPlanId = new Types.ObjectId(filter.weeklyPlanId);
  if (filter.unlinked) query.weeklyPlanId = null;
  const docs = await Todo.find(query).sort({ date: 1, createdAt: 1 }).lean<TodoRecord[]>();
  return docs.map(toTodoDTO);
}

export async function getTodo(id: string): Promise<TodoDTO> {
  const doc = await Todo.findById(id).lean<TodoRecord>();
  if (!doc) throw notFound("할 일");
  return toTodoDTO(doc);
}

/** V2/V4: a linked todo's date must fall within its weekly plan's week. */
async function assertFitsPlan(date: string, weeklyPlanId: string, code: string) {
  const plan = await WeeklyPlan.findById(weeklyPlanId).lean();
  if (!plan) throw notFound("주간 계획");
  if (!isWithinWeek(date, plan.weekStart)) {
    const message = `날짜 ${date}는 주간 계획 ‘${plan.title}’ 기간(${plan.weekStart}~${plan.weekEnd}) 밖입니다. 그 주의 날짜로 바꾸거나 연결을 해제하세요.`;
    throw badRequest(code, message, {
      count: 1,
      weekStart: plan.weekStart,
      weekEnd: plan.weekEnd,
    });
  }
}

export async function createTodo(input: TodoCreate): Promise<TodoDTO> {
  if (input.weeklyPlanId) await assertFitsPlan(input.date, input.weeklyPlanId, "V2_DATE_OUT_OF_WEEK");
  const doc = await Todo.create(input);
  return toTodoDTO(doc.toObject() as TodoRecord);
}

export async function updateTodo(id: string, patch: TodoUpdate): Promise<TodoDTO> {
  const current = await Todo.findById(id).lean<TodoRecord>();
  if (!current) throw notFound("할 일");

  // V6: re-check V2 against the state after the change; never unlink silently.
  const nextPlanId =
    patch.weeklyPlanId !== undefined ? patch.weeklyPlanId : current.weeklyPlanId ? String(current.weeklyPlanId) : null;
  const linkTouched = patch.date !== undefined || patch.weeklyPlanId !== undefined;
  if (nextPlanId && linkTouched) {
    await assertFitsPlan(patch.date ?? current.date, nextPlanId, "V6_TODO_OUT_OF_WEEK");
  }

  const updated = await Todo.findByIdAndUpdate(id, { $set: patch }, { returnDocument: "after", runValidators: true }).lean<TodoRecord>();
  if (!updated) throw notFound("할 일");
  return toTodoDTO(updated);
}

export async function deleteTodo(id: string): Promise<void> {
  const result = await Todo.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw notFound("할 일");
}
