"use client";

import { useState } from "react";
import { useCreateGoal, useGoals, useUpdateGoal } from "@/hooks/useGoals";
import { useWeeklyPlans } from "@/hooks/useWeeklyPlans";
import { yearOf } from "@/lib/dates";
import { formatWeek } from "@/lib/labels";
import type { GoalDTO } from "@/lib/types";
import { DeleteParentDialog } from "./DeleteParentDialog";
import { FormError } from "./FormError";
import { GoalForm } from "./GoalForm";
import { Modal } from "./Modal";
import { ProgressBar } from "./ProgressBar";
import { inputClass, labelClass, linkButton } from "./ui";

const ALL = "all";

function GoalPlans({ goalId }: { goalId: string }) {
  const plans = useWeeklyPlans({ goalId });
  if (plans.isPending) return <p className="text-xs text-slate-500">불러오는 중…</p>;
  if (plans.isError) return <FormError error={plans.error} />;
  if (plans.data.length === 0) return <p className="text-xs text-slate-500">연결된 주간 계획이 없습니다.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {plans.data.map((plan) => (
        <li key={plan.id} className="flex justify-between gap-2">
          <span>{plan.title} <span className="text-xs text-slate-500">({formatWeek(plan.weekStart, plan.weekEnd)})</span></span>
          <span className="shrink-0 text-xs tabular-nums text-slate-600">{plan.progress}%</span>
        </li>
      ))}
    </ul>
  );
}

function GoalItem({ goal, onEdit, onDelete }: { goal: GoalDTO; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4" aria-label={`1년 목표: ${goal.title}`} data-testid="goal">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">{goal.title}</h3>
          <p className="text-xs text-slate-500">{goal.year}년 · 주간 계획 {goal.weeklyPlanCount}개</p>
          {goal.description && <p className="mt-1 text-sm text-slate-600">{goal.description}</p>}
        </div>
        <span className="flex gap-3">
          <button type="button" className={linkButton} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? "주간 계획 접기" : "주간 계획 보기"}
          </button>
          <button type="button" className={linkButton} onClick={onEdit}>수정</button>
          <button type="button" className={`${linkButton} hover:text-red-600`} onClick={onDelete}>삭제</button>
        </span>
      </div>
      <div className="mt-3">
        <ProgressBar value={goal.progress} label={`${goal.title} 진행률`} />
      </div>
      {open && <div className="mt-3 border-t border-slate-100 pt-3"><GoalPlans goalId={goal.id} /></div>}
    </li>
  );
}

export function GoalsView({ today }: { today: string }) {
  const currentYear = yearOf(today);
  const [yearFilter, setYearFilter] = useState<string>(String(currentYear));
  const allGoals = useGoals();
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<GoalDTO | null>(null);
  const [deleting, setDeleting] = useState<GoalDTO | null>(null);

  const years = [...new Set([currentYear, ...(allGoals.data ?? []).map((g) => g.year)])].sort((a, b) => b - a);
  const shown = (allGoals.data ?? []).filter((g) => yearFilter === ALL || g.year === Number(yearFilter));
  const closeEdit = () => { setEditing(null); update.reset(); };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-xl font-semibold">1년 목표</h1>
        <div>
          <label className={labelClass} htmlFor="goal-year-filter">연도</label>
          <select id="goal-year-filter" className={inputClass} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value={ALL}>전체</option>
            {years.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
        </div>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">목표 만들기</h2>
        <GoalForm
          key={formKey}
          defaultYear={yearFilter === ALL ? currentYear : Number(yearFilter)}
          submitLabel="만들기"
          pending={create.isPending}
          error={create.error}
          onSubmit={(values) =>
            create.mutate(values, {
              onSuccess: (goal) => { setFormKey((k) => k + 1); create.reset(); setYearFilter(String(goal.year)); },
            })
          }
        />
      </section>

      {allGoals.isError && <FormError error={allGoals.error} />}
      {allGoals.isSuccess && shown.length === 0 && <p className="text-sm text-slate-500">이 연도의 목표가 없습니다.</p>}
      <ul className="space-y-3">
        {shown.map((goal) => (
          <GoalItem key={goal.id} goal={goal} onEdit={() => setEditing(goal)} onDelete={() => setDeleting(goal)} />
        ))}
      </ul>

      {editing && (
        <Modal title="1년 목표 수정" onClose={closeEdit}>
          <GoalForm
            initial={editing}
            defaultYear={editing.year}
            submitLabel="저장"
            pending={update.isPending}
            error={update.error}
            onCancel={closeEdit}
            onSubmit={(values) => update.mutate({ id: editing.id, patch: values }, { onSuccess: closeEdit })}
          />
        </Modal>
      )}
      {deleting && <DeleteParentDialog kind="goal" id={deleting.id} title={deleting.title} onClose={() => setDeleting(null)} />}
    </div>
  );
}
