import { z } from "zod";
import { isMonday, isValidDate } from "./dates";

export const TODO_STATUSES = ["todo", "doing", "done"] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];

const title = z
  .string()
  .trim()
  .min(1, "제목을 입력하세요.")
  .max(200, "제목은 200자 이하여야 합니다.");

export const dateString = z.string().refine(isValidDate, "YYYY-MM-DD 형식의 올바른 날짜여야 합니다.");
const mondayString = dateString.refine(isMonday, "주 시작일은 월요일이어야 합니다.");
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "올바른 ID가 아닙니다.");
const statusSchema = z.enum(TODO_STATUSES);

const nonEmpty = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object(shape)
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, "변경할 값이 없습니다.");

export const goalCreateSchema = z
  .object({
    year: z.number().int().min(1970).max(9999),
    title,
    description: z.string().trim().max(2000).optional(),
  })
  .strict();
export const goalUpdateSchema = nonEmpty(goalCreateSchema.shape);

export const weeklyPlanCreateSchema = z
  .object({
    title,
    weekStart: mondayString,
    yearGoalId: objectId.nullable().default(null),
  })
  .strict();
export const weeklyPlanUpdateSchema = nonEmpty({
  title,
  weekStart: mondayString,
  yearGoalId: objectId.nullable(),
});

export const todoCreateSchema = z
  .object({
    title,
    date: dateString,
    weeklyPlanId: objectId.nullable().default(null),
    status: statusSchema.default("todo"),
  })
  .strict();
export const todoUpdateSchema = nonEmpty({
  title,
  date: dateString,
  weeklyPlanId: objectId.nullable(),
  status: statusSchema,
});

export const deleteModeSchema = z.enum(["unlink", "cascade"]).optional();
export type DeleteMode = z.infer<typeof deleteModeSchema>;

export type GoalCreate = z.infer<typeof goalCreateSchema>;
export type GoalUpdate = z.infer<typeof goalUpdateSchema>;
export type WeeklyPlanCreate = z.infer<typeof weeklyPlanCreateSchema>;
export type WeeklyPlanUpdate = z.infer<typeof weeklyPlanUpdateSchema>;
export type TodoCreate = z.infer<typeof todoCreateSchema>;
export type TodoUpdate = z.infer<typeof todoUpdateSchema>;
