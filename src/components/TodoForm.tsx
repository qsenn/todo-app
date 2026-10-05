"use client";

import { useId, useState, type FormEvent } from "react";
import { useWeeklyPlans } from "@/hooks/useWeeklyPlans";
import { isValidDate, toWeekStart } from "@/lib/dates";
import { STATUS_LABELS, formatWeek } from "@/lib/labels";
import { TODO_STATUSES, type TodoStatus } from "@/lib/schemas";
import type { TodoDTO } from "@/lib/types";
import { FormError } from "./FormError";
import { inputClass, labelClass, primaryButton, secondaryButton } from "./ui";

type TodoFormValues = { title: string; date: string; weeklyPlanId: string | null; status: TodoStatus };

type Props = {
  initial?: TodoDTO;
  defaultDate: string;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (values: TodoFormValues) => void;
  onCancel?: () => void;
};

export function TodoForm({ initial, defaultDate, submitLabel, pending, error, onSubmit, onCancel }: Props) {
  const id = useId();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [weeklyPlanId, setWeeklyPlanId] = useState(initial?.weeklyPlanId ?? "");
  const [status, setStatus] = useState<TodoStatus>(initial?.status ?? "todo");

  // Only plans whose week contains the chosen date can be linked (V2).
  const weekStart = isValidDate(date) ? toWeekStart(date) : undefined;
  const plans = useWeeklyPlans({ weekStart }, weekStart !== undefined);
  const options = plans.data ?? [];
  const linkedElsewhere = weeklyPlanId !== "" && plans.isSuccess && !options.some((p) => p.id === weeklyPlanId);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ title, date, weeklyPlanId: weeklyPlanId || null, status });
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label={submitLabel}>
      <div>
        <label className={labelClass} htmlFor={`${id}-title`}>제목</label>
        <input id={`${id}-title`} className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor={`${id}-date`}>날짜</label>
          <input id={`${id}-date`} type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        {initial && (
          <div>
            <label className={labelClass} htmlFor={`${id}-status`}>상태</label>
            <select id={`${id}-status`} className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as TodoStatus)}>
              {TODO_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div>
        <label className={labelClass} htmlFor={`${id}-plan`}>주간 계획</label>
        <select id={`${id}-plan`} className={inputClass} value={weeklyPlanId} onChange={(e) => setWeeklyPlanId(e.target.value)}>
          <option value="">연결 안 함</option>
          {linkedElsewhere && <option value={weeklyPlanId}>현재 연결된 계획 (다른 주)</option>}
          {options.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.title} ({formatWeek(plan.weekStart, plan.weekEnd)})
            </option>
          ))}
        </select>
        {linkedElsewhere && (
          <p className="mt-1 text-xs text-amber-700">
            연결된 주간 계획의 기간 밖 날짜입니다. 이 주의 계획을 고르거나 연결을 해제하세요.
          </p>
        )}
      </div>
      <FormError error={error} />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" className={secondaryButton} onClick={onCancel}>취소</button>
        )}
        <button type="submit" className={primaryButton} disabled={pending}>{submitLabel}</button>
      </div>
    </form>
  );
}
