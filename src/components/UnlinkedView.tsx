"use client";

import { useState } from "react";
import { useGoals } from "@/hooks/useGoals";
import { useTodos, useUpdateTodo } from "@/hooks/useTodos";
import { useUpdateWeeklyPlan, useWeeklyPlans } from "@/hooks/useWeeklyPlans";
import { isWithinWeek, yearOf } from "@/lib/dates";
import { STATUS_LABELS, formatWeek } from "@/lib/labels";
import type { GoalDTO, TodoDTO, WeeklyPlanDTO } from "@/lib/types";
import { FormError } from "./FormError";
import { ProgressBar } from "./ProgressBar";
import { inputClass, primaryButton } from "./ui";

function UnlinkedRow({ todo, plans }: { todo: TodoDTO; plans: WeeklyPlanDTO[] }) {
  const sameWeek = plans.filter((plan) => isWithinWeek(todo.date, plan.weekStart));
  const otherWeeks = plans.filter((plan) => !isWithinWeek(todo.date, plan.weekStart));
  const [planId, setPlanId] = useState(sameWeek[0]?.id ?? "");
  const update = useUpdateTodo();

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4" aria-label={`미연결 할 일: ${todo.title}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">{todo.title}</p>
          <p className="text-xs text-slate-500">{todo.date} · {STATUS_LABELS[todo.status]}</p>
        </div>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (planId) update.mutate({ id: todo.id, patch: { weeklyPlanId: planId } });
          }}
        >
          <label className="sr-only" htmlFor={`link-${todo.id}`}>연결할 주간 계획</label>
          <select id={`link-${todo.id}`} className={`${inputClass} w-64`} value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">주간 계획 선택</option>
            {sameWeek.length > 0 && (
              <optgroup label="같은 주">
                {sameWeek.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}
              </optgroup>
            )}
            {otherWeeks.length > 0 && (
              <optgroup label="다른 주 (날짜가 기간 밖)">
                {otherWeeks.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.title} ({formatWeek(plan.weekStart, plan.weekEnd)})</option>
                ))}
              </optgroup>
            )}
          </select>
          <button type="submit" className={primaryButton} disabled={!planId || update.isPending}>연결</button>
        </form>
      </div>
      {update.error && <div className="mt-2"><FormError error={update.error} /></div>}
    </li>
  );
}

function UnlinkedPlanRow({ plan, goals }: { plan: WeeklyPlanDTO; goals: GoalDTO[] }) {
  // V3: a plan fits a goal whose year contains the week's start or end.
  const fits = (goal: GoalDTO) => goal.year === yearOf(plan.weekStart) || goal.year === yearOf(plan.weekEnd);
  const sameYear = goals.filter(fits);
  const otherYears = goals.filter((goal) => !fits(goal));
  const [goalId, setGoalId] = useState(sameYear[0]?.id ?? "");
  const update = useUpdateWeeklyPlan();

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4" aria-label={`미연결 주간 계획: ${plan.title}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-48 flex-1">
          <p className="font-medium">{plan.title}</p>
          <p className="mb-2 text-xs text-slate-500">
            {formatWeek(plan.weekStart, plan.weekEnd)} · 완료 {plan.doneCount} / 전체 {plan.totalCount}
          </p>
          <ProgressBar value={plan.progress} label={`${plan.title} 진행률`} />
        </div>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (goalId) update.mutate({ id: plan.id, patch: { yearGoalId: goalId } });
          }}
        >
          <label className="sr-only" htmlFor={`link-goal-${plan.id}`}>연결할 1년 목표</label>
          <select id={`link-goal-${plan.id}`} className={`${inputClass} w-64`} value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">1년 목표 선택</option>
            {sameYear.length > 0 && (
              <optgroup label="같은 연도">
                {sameYear.map((goal) => <option key={goal.id} value={goal.id}>{goal.year}년 · {goal.title}</option>)}
              </optgroup>
            )}
            {otherYears.length > 0 && (
              <optgroup label="다른 연도 (연결 불가)">
                {otherYears.map((goal) => <option key={goal.id} value={goal.id}>{goal.year}년 · {goal.title}</option>)}
              </optgroup>
            )}
          </select>
          <button type="submit" className={primaryButton} disabled={!goalId || update.isPending}>연결</button>
        </form>
      </div>
      {update.error && <div className="mt-2"><FormError error={update.error} /></div>}
    </li>
  );
}

export function UnlinkedView() {
  const todos = useTodos({ unlinked: true });
  const plans = useWeeklyPlans();
  const unlinkedPlans = useWeeklyPlans({ unlinked: true });
  const goals = useGoals();
  const error = todos.error ?? plans.error ?? unlinkedPlans.error ?? goals.error;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">미연결 항목</h1>
      {error && <FormError error={error} />}

      <section className="space-y-3" aria-labelledby="unlinked-todos">
        <div>
          <h2 id="unlinked-todos" className="font-semibold">주간 계획에 연결되지 않은 할 일</h2>
          <p className="mt-1 text-sm text-slate-500">같은 주의 계획에만 연결할 수 있습니다.</p>
        </div>
        {todos.data?.length === 0 && <p className="text-sm text-slate-500">모든 할 일이 주간 계획에 연결되어 있습니다.</p>}
        {todos.data && plans.data && (
          <ul className="space-y-3">
            {todos.data.map((todo) => <UnlinkedRow key={todo.id} todo={todo} plans={plans.data} />)}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="unlinked-plans">
        <div>
          <h2 id="unlinked-plans" className="font-semibold">1년 목표에 연결되지 않은 주간 계획</h2>
          <p className="mt-1 text-sm text-slate-500">주의 시작일이나 종료일과 같은 연도의 목표에만 연결할 수 있습니다.</p>
        </div>
        {unlinkedPlans.data?.length === 0 && (
          <p className="text-sm text-slate-500">모든 주간 계획이 1년 목표에 연결되어 있습니다.</p>
        )}
        {unlinkedPlans.data && goals.data && (
          <ul className="space-y-3">
            {unlinkedPlans.data.map((plan) => <UnlinkedPlanRow key={plan.id} plan={plan} goals={goals.data} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
