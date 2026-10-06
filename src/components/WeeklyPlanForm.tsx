"use client";

import { useId, useState, type FormEvent } from "react";
import { useGoals } from "@/hooks/useGoals";
import { isValidDate, toWeekStart, weekEnd } from "@/lib/dates";
import { formatWeek } from "@/lib/labels";
import type { WeeklyPlanDTO } from "@/lib/types";
import { FormError } from "./FormError";
import { inputClass, labelClass, primaryButton, secondaryButton } from "./ui";

type WeeklyPlanFormValues = { title: string; weekStart: string; yearGoalId: string | null };

type Props = {
  initial?: WeeklyPlanDTO;
  defaultWeekStart: string;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (values: WeeklyPlanFormValues) => void;
  onCancel?: () => void;
};

export function WeeklyPlanForm({ initial, defaultWeekStart, submitLabel, pending, error, onSubmit, onCancel }: Props) {
  const id = useId();
  const goals = useGoals();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [day, setDay] = useState(initial?.weekStart ?? defaultWeekStart);
  const [yearGoalId, setYearGoalId] = useState(initial?.yearGoalId ?? "");

  // Any day picks its week; the plan always starts on that week's Monday (V1).
  const weekStart = isValidDate(day) ? toWeekStart(day) : "";

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ title, weekStart, yearGoalId: yearGoalId || null });
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label={submitLabel}>
      <div>
        <label className={labelClass} htmlFor={`${id}-title`}>제목</label>
        <input id={`${id}-title`} className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor={`${id}-week`}>주</label>
          <input id={`${id}-week`} type="date" className={inputClass} value={day} onChange={(e) => setDay(e.target.value)} required />
          <p className="mt-1 text-[13px] text-muted">
            {weekStart ? `기간: ${formatWeek(weekStart, weekEnd(weekStart))}` : "아무 날짜나 고르면 그 주(월~일)로 맞춰집니다."}
          </p>
        </div>
        <div>
          <label className={labelClass} htmlFor={`${id}-goal`}>1년 목표</label>
          <select id={`${id}-goal`} className={inputClass} value={yearGoalId} onChange={(e) => setYearGoalId(e.target.value)}>
            <option value="">연결 안 함</option>
            {(goals.data ?? []).map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.year}년 · {goal.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <FormError error={error} />
      <div className="flex justify-end gap-2">
        {onCancel && <button type="button" className={secondaryButton} onClick={onCancel}>취소</button>}
        <button type="submit" className={primaryButton} disabled={pending || !weekStart}>{submitLabel}</button>
      </div>
    </form>
  );
}
