"use client";

import { useState } from "react";
import { useHierarchy } from "@/hooks/useProgress";
import { yearOf } from "@/lib/dates";
import { STATUS_LABELS, formatWeek } from "@/lib/labels";
import type { HierarchyPlan, TodoDTO } from "@/lib/types";
import { FormError } from "./FormError";
import { ProgressBar } from "./ProgressBar";
import { inputClass, labelClass } from "./ui";

function TodoRows({ todos }: { todos: TodoDTO[] }) {
  if (todos.length === 0) return <p className="py-1 text-xs text-slate-400">할 일 없음</p>;
  return (
    <ul className="space-y-1">
      {todos.map((todo) => (
        <li key={todo.id} className="flex justify-between gap-2 text-sm">
          <span className={todo.status === "done" ? "text-slate-400 line-through" : ""}>{todo.title}</span>
          <span className="shrink-0 text-xs text-slate-500">{todo.date} · {STATUS_LABELS[todo.status]}</span>
        </li>
      ))}
    </ul>
  );
}

function PlanNode({ plan }: { plan: HierarchyPlan }) {
  return (
    <details className="rounded-md border border-slate-200 bg-white" data-testid="tree-plan">
      <summary className="cursor-pointer list-none px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">
            ▸ {plan.title} <span className="text-xs font-normal text-slate-500">({formatWeek(plan.weekStart, plan.weekEnd)})</span>
          </span>
          <span className="w-48"><ProgressBar value={plan.progress} label={`${plan.title} 진행률`} /></span>
        </div>
      </summary>
      <div className="border-t border-slate-100 px-3 py-2"><TodoRows todos={plan.todos} /></div>
    </details>
  );
}

export function HierarchyView({ today }: { today: string }) {
  // The field keeps whatever is typed; the tree follows only complete four-digit years.
  const [yearText, setYearText] = useState(String(yearOf(today)));
  const [year, setYear] = useState(yearOf(today));
  const tree = useHierarchy(year);

  function changeYear(text: string) {
    setYearText(text);
    if (/^\d{4}$/.test(text) && Number(text) >= 1970) setYear(Number(text));
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-xl font-semibold">계층 보기</h1>
        <div>
          <label className={labelClass} htmlFor="tree-year">연도</label>
          <input
            id="tree-year"
            type="number"
            min={1970}
            max={9999}
            className={`${inputClass} w-28`}
            value={yearText}
            onChange={(e) => changeYear(e.target.value)}
          />
        </div>
      </header>

      {tree.isPending && <p className="text-sm text-slate-500">불러오는 중…</p>}
      {tree.isError && <FormError error={tree.error} />}
      {tree.data && (
        <>
          {tree.data.goals.length === 0 && <p className="text-sm text-slate-500">{year}년 목표가 없습니다.</p>}
          <ul className="space-y-3">
            {tree.data.goals.map((goal) => (
              <li key={goal.id}>
                <details open className="rounded-lg border border-slate-300 bg-slate-100/60" data-testid="tree-goal">
                  <summary className="cursor-pointer list-none p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{goal.title}</span>
                      <span className="w-56"><ProgressBar value={goal.progress} label={`${goal.title} 진행률`} /></span>
                    </div>
                  </summary>
                  <div className="space-y-2 px-3 pb-3">
                    {goal.weeklyPlans.length === 0 && <p className="text-xs text-slate-500">연결된 주간 계획 없음</p>}
                    {goal.weeklyPlans.map((plan) => <PlanNode key={plan.id} plan={plan} />)}
                  </div>
                </details>
              </li>
            ))}
          </ul>

          <section className="space-y-2" aria-label="목표 미연결 주간 계획">
            <h2 className="text-sm font-semibold text-slate-700">목표에 연결되지 않은 주간 계획</h2>
            {tree.data.unlinkedWeeklyPlans.length === 0 && <p className="text-xs text-slate-500">없음</p>}
            {tree.data.unlinkedWeeklyPlans.map((plan) => <PlanNode key={plan.id} plan={plan} />)}
          </section>

          <section className="space-y-2" aria-label="주간 계획 미연결 할 일">
            <h2 className="text-sm font-semibold text-slate-700">주간 계획에 연결되지 않은 할 일</h2>
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <TodoRows todos={tree.data.unlinkedTodos} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
