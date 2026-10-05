"use client";

import { useQuery } from "@tanstack/react-query";
import { keys } from "@/hooks/queryKeys";
import { fetchGoalImpact, useDeleteGoal } from "@/hooks/useGoals";
import { fetchWeeklyPlanImpact, useDeleteWeeklyPlan } from "@/hooks/useWeeklyPlans";
import type { DeleteMode } from "@/lib/schemas";
import { FormError } from "./FormError";
import { Modal } from "./Modal";
import { dangerButton, secondaryButton } from "./ui";

type Props = {
  kind: "weekly-plan" | "goal";
  id: string;
  title: string;
  onClose: () => void;
};

export function DeleteParentDialog({ kind, id, title, onClose }: Props) {
  const impact = useQuery({
    queryKey: keys.impact(kind, id),
    queryFn: async () => {
      if (kind === "goal") return fetchGoalImpact(id);
      const { todoCount } = await fetchWeeklyPlanImpact(id);
      return { weeklyPlanCount: 0, todoCount };
    },
    // Counts are read fresh each time the dialog opens and never refreshed after the delete.
    staleTime: 0,
    gcTime: 0,
  });
  const deletePlan = useDeleteWeeklyPlan();
  const deleteGoal = useDeleteGoal();
  const mutation = kind === "goal" ? deleteGoal : deletePlan;

  const counts = impact.data;
  const childCount = counts ? (kind === "goal" ? counts.weeklyPlanCount : counts.todoCount) : 0;
  const run = (mode?: DeleteMode) => mutation.mutate({ id, mode }, { onSuccess: onClose });

  const heading = kind === "goal" ? "1년 목표 삭제" : "주간 계획 삭제";
  return (
    <Modal title={heading} onClose={onClose}>
      {impact.isPending && <p className="text-sm text-slate-500">연결된 항목을 확인하는 중…</p>}
      <FormError error={impact.error ?? mutation.error} />
      {counts && childCount === 0 && (
        <>
          <p className="mb-4 text-sm">‘{title}’을(를) 삭제할까요? 연결된 하위 항목은 없습니다.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButton} onClick={onClose}>취소</button>
            <button type="button" className={dangerButton} disabled={mutation.isPending} onClick={() => run()}>
              삭제
            </button>
          </div>
        </>
      )}
      {counts && childCount > 0 && (
        <>
          <p className="mb-2 text-sm">‘{title}’에 연결된 항목이 있습니다.</p>
          <ul className="mb-4 list-disc pl-5 text-sm" data-testid="impact-counts">
            {kind === "goal" && <li>주간 계획 {counts.weeklyPlanCount}개</li>}
            <li>할 일 {counts.todoCount}개</li>
          </ul>
          <p className="mb-4 text-xs text-slate-500">
            연결만 해제하면 하위 항목은 남고 ‘미연결’ 상태가 됩니다. 하위 항목까지 삭제하면 되돌릴 수 없습니다.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={secondaryButton} onClick={onClose}>취소</button>
            <button type="button" className={secondaryButton} disabled={mutation.isPending} onClick={() => run("unlink")}>
              연결만 해제
            </button>
            <button type="button" className={dangerButton} disabled={mutation.isPending} onClick={() => run("cascade")}>
              하위 항목까지 삭제
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
