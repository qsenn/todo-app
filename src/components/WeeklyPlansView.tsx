"use client";

import { useState } from "react";
import { useGoals } from "@/hooks/useGoals";
import { useTodos } from "@/hooks/useTodos";
import { useCreateWeeklyPlan, useUpdateWeeklyPlan, useWeeklyPlans } from "@/hooks/useWeeklyPlans";
import { toWeekStart } from "@/lib/dates";
import { STATUS_LABELS, formatWeek } from "@/lib/labels";
import type { WeeklyPlanDTO } from "@/lib/types";
import { DeleteParentDialog } from "./DeleteParentDialog";
import { FormError } from "./FormError";
import { Modal } from "./Modal";
import { ProgressBar } from "./ProgressBar";
import { WeeklyPlanForm } from "./WeeklyPlanForm";
import { linkButton } from "./ui";

function PlanTodos({ planId }: { planId: string }) {
  const todos = useTodos({ weeklyPlanId: planId });
  if (todos.isPending) return <p className="text-[13px] text-muted">불러오는 중…</p>;
  if (todos.isError) return <FormError error={todos.error} />;
  if (todos.data.length === 0) return <p className="text-[13px] text-muted">연결된 할 일이 없습니다.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {todos.data.map((todo) => (
        <li key={todo.id} className="flex justify-between gap-2">
          <span className={todo.status === "done" ? "text-muted-soft line-through" : ""}>{todo.title}</span>
          <span className="shrink-0 text-[13px] text-muted">{todo.date} · {STATUS_LABELS[todo.status]}</span>
        </li>
      ))}
    </ul>
  );
}

function PlanItem({ plan, goalTitle, onEdit, onDelete }: {
  plan: WeeklyPlanDTO;
  goalTitle?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-md border border-hairline bg-canvas p-5 transition-shadow hover:shadow-card" aria-label={`주간 계획: ${plan.title}`} data-testid="weekly-plan">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-ink">{plan.title}</h3>
          <p className="text-[13px] text-muted">
            {formatWeek(plan.weekStart, plan.weekEnd)} · {goalTitle ? `목표: ${goalTitle}` : "목표 미연결"}
          </p>
        </div>
        <span className="flex gap-3">
          <button type="button" className={linkButton} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? "할 일 접기" : "할 일 보기"}
          </button>
          <button type="button" className={linkButton} onClick={onEdit}>수정</button>
          <button type="button" className={`${linkButton} hover:text-error`} onClick={onDelete}>삭제</button>
        </span>
      </div>
      <div className="mt-3">
        <ProgressBar value={plan.progress} label={`${plan.title} 진행률`} />
        <p className="mt-1 text-[13px] text-muted" data-testid="plan-counts">
          완료 {plan.doneCount} / 전체 {plan.totalCount}
        </p>
      </div>
      {open && <div className="mt-3 border-t border-hairline-soft pt-3"><PlanTodos planId={plan.id} /></div>}
    </li>
  );
}

export function WeeklyPlansView({ today }: { today: string }) {
  const plans = useWeeklyPlans();
  const goals = useGoals();
  const create = useCreateWeeklyPlan();
  const update = useUpdateWeeklyPlan();
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<WeeklyPlanDTO | null>(null);
  const [deleting, setDeleting] = useState<WeeklyPlanDTO | null>(null);

  const goalTitles = new Map((goals.data ?? []).map((g) => [g.id, `${g.year}년 · ${g.title}`]));
  const closeEdit = () => { setEditing(null); update.reset(); };

  return (
    <div className="space-y-5">
      <h1 className="text-[28px] font-bold leading-[1.43] text-ink">주간 계획</h1>
      <section className="rounded-md border border-hairline bg-canvas p-6">
        <h2 className="mb-4 text-base font-semibold text-ink">주간 계획 만들기</h2>
        <WeeklyPlanForm
          key={formKey}
          defaultWeekStart={toWeekStart(today)}
          submitLabel="만들기"
          pending={create.isPending}
          error={create.error}
          onSubmit={(values) => create.mutate(values, { onSuccess: () => { setFormKey((k) => k + 1); create.reset(); } })}
        />
      </section>

      {plans.isError && <FormError error={plans.error} />}
      {plans.data?.length === 0 && <p className="text-sm text-muted">아직 주간 계획이 없습니다.</p>}
      <ul className="space-y-3">
        {(plans.data ?? []).map((plan) => (
          <PlanItem
            key={plan.id}
            plan={plan}
            goalTitle={plan.yearGoalId ? goalTitles.get(plan.yearGoalId) : undefined}
            onEdit={() => setEditing(plan)}
            onDelete={() => setDeleting(plan)}
          />
        ))}
      </ul>

      {editing && (
        <Modal title="주간 계획 수정" onClose={closeEdit}>
          <WeeklyPlanForm
            initial={editing}
            defaultWeekStart={editing.weekStart}
            submitLabel="저장"
            pending={update.isPending}
            error={update.error}
            onCancel={closeEdit}
            onSubmit={(values) => update.mutate({ id: editing.id, patch: values }, { onSuccess: closeEdit })}
          />
        </Modal>
      )}
      {deleting && (
        <DeleteParentDialog kind="weekly-plan" id={deleting.id} title={deleting.title} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}
