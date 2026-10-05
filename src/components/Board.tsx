"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { useState } from "react";
import { useDailyProgress } from "@/hooks/useProgress";
import { useCreateTodo, useDeleteTodo, useTodos, useUpdateTodo } from "@/hooks/useTodos";
import { useWeeklyPlans } from "@/hooks/useWeeklyPlans";
import { addDays, toWeekStart } from "@/lib/dates";
import { STATUS_LABELS, formatWeek } from "@/lib/labels";
import { TODO_STATUSES, type TodoStatus } from "@/lib/schemas";
import type { TodoDTO } from "@/lib/types";
import { columnKeyboardCoordinates } from "./columnKeyboard";
import { FormError } from "./FormError";
import { KanbanColumn } from "./KanbanColumn";
import { Modal } from "./Modal";
import { ProgressBar } from "./ProgressBar";
import { TodoCard } from "./TodoCard";
import { TodoForm } from "./TodoForm";
import { useToast } from "./Toast";
import { dangerButton, inputClass, labelClass, secondaryButton } from "./ui";

const ALL = "all";
const UNLINKED = "unlinked";
const screenReaderInstructions = {
  draggable: "카드를 옮기려면 Space나 Enter를 누르고, 왼쪽·오른쪽 화살표로 컬럼을 고른 뒤 다시 Space나 Enter를 누르세요. Esc를 누르면 취소됩니다.",
};

export function Board({ initialDate }: { initialDate: string }) {
  const [date, setDate] = useState(initialDate);
  const [planFilter, setPlanFilter] = useState<string>(ALL);
  const [editing, setEditing] = useState<TodoDTO | null>(null);
  const [deleting, setDeleting] = useState<TodoDTO | null>(null);
  const [formKey, setFormKey] = useState(0);
  const toast = useToast();

  const todos = useTodos({ date });
  const daily = useDailyProgress(date);
  const plans = useWeeklyPlans({ weekStart: toWeekStart(date) });
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates }),
  );

  const planTitles = new Map((plans.data ?? []).map((p) => [p.id, p.title]));
  const todoTitles = new Map((todos.data ?? []).map((t) => [t.id, t.title]));
  const name = (id: UniqueIdentifier) => `‘${todoTitles.get(String(id)) ?? "할 일"}’`;
  const columnName = (id: UniqueIdentifier | undefined) =>
    id && id in STATUS_LABELS ? `‘${STATUS_LABELS[id as TodoStatus]}’ 컬럼` : "컬럼 밖";
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${name(active.id)} 카드를 집었습니다.`,
    onDragOver: ({ active, over }) => `${name(active.id)} 카드가 ${columnName(over?.id)} 위에 있습니다.`,
    onDragEnd: ({ active, over }) => `${name(active.id)} 카드를 ${columnName(over?.id)}에 놓았습니다.`,
    onDragCancel: ({ active }) => `${name(active.id)} 카드 이동을 취소했습니다.`,
  };
  const visible = (todos.data ?? []).filter((todo) =>
    planFilter === ALL ? true : planFilter === UNLINKED ? todo.weeklyPlanId === null : todo.weeklyPlanId === planFilter,
  );

  function changeDate(next: string) {
    if (!next) return;
    setDate(next);
    setPlanFilter(ALL);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-xl font-semibold">할 일 보드</h1>
        <div className="flex items-end gap-1">
          <button type="button" className={secondaryButton} aria-label="이전 날" onClick={() => changeDate(addDays(date, -1))}>
            ‹
          </button>
          <div>
            <label className={labelClass} htmlFor="board-date">날짜</label>
            <input id="board-date" type="date" className={inputClass} value={date} onChange={(e) => changeDate(e.target.value)} />
          </div>
          <button type="button" className={secondaryButton} aria-label="다음 날" onClick={() => changeDate(addDays(date, 1))}>
            ›
          </button>
        </div>
        <div>
          <label className={labelClass} htmlFor="board-plan-filter">주간 계획 필터</label>
          <select id="board-plan-filter" className={inputClass} value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
            <option value={ALL}>전체</option>
            <option value={UNLINKED}>미연결</option>
            {(plans.data ?? []).map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.title}</option>
            ))}
          </select>
        </div>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4" aria-label="일일 진행률">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-semibold text-slate-700">{date} 진행률</span>
          {daily.data && (
            <span className="text-slate-500" data-testid="daily-counts">
              완료 {daily.data.doneCount} / 전체 {daily.data.totalCount}
            </span>
          )}
        </div>
        <ProgressBar value={daily.data?.progress ?? 0} label="일일 진행률" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">할 일 추가</h2>
        <TodoForm
          key={`${date}-${formKey}`}
          defaultDate={date}
          submitLabel="추가"
          pending={createTodo.isPending}
          error={createTodo.error}
          onSubmit={(values) =>
            createTodo.mutate(
              { title: values.title, date: values.date, weeklyPlanId: values.weeklyPlanId },
              { onSuccess: () => setFormKey((k) => k + 1) },
            )
          }
        />
      </section>

      {todos.isError && <FormError error={todos.error} />}
      <p className="text-xs text-slate-500">
        카드를 끌어 다른 컬럼에 놓으면 상태가 바뀝니다. 키보드: 카드에서 Space → ←/→ → Space.
        {plans.data && plans.data.length > 0 && ` 이번 주: ${formatWeek(plans.data[0].weekStart, plans.data[0].weekEnd)}`}
      </p>

      <DndContext sensors={sensors} accessibility={{ announcements, screenReaderInstructions }}>
        <div className="grid gap-4 md:grid-cols-3">
          {TODO_STATUSES.map((status) => {
            const items = visible.filter((todo) => todo.status === status);
            return (
              <KanbanColumn key={status} status={status} count={items.length}>
                {items.map((todo) => (
                  <TodoCard
                    key={todo.id}
                    todo={todo}
                    planTitle={todo.weeklyPlanId ? planTitles.get(todo.weeklyPlanId) : undefined}
                    onEdit={setEditing}
                    onDelete={setDeleting}
                  />
                ))}
                {items.length === 0 && <li className="py-6 text-center text-xs text-slate-400">비어 있음</li>}
              </KanbanColumn>
            );
          })}
        </div>
      </DndContext>

      {editing && (
        <Modal title="할 일 수정" onClose={() => { setEditing(null); updateTodo.reset(); }}>
          <TodoForm
            initial={editing}
            defaultDate={editing.date}
            submitLabel="저장"
            pending={updateTodo.isPending}
            error={updateTodo.error}
            onCancel={() => { setEditing(null); updateTodo.reset(); }}
            onSubmit={(values) =>
              updateTodo.mutate({ id: editing.id, patch: values }, { onSuccess: () => setEditing(null) })
            }
          />
        </Modal>
      )}

      {deleting && (
        <Modal title="할 일 삭제" onClose={() => setDeleting(null)}>
          <p className="mb-4 text-sm">‘{deleting.title}’을(를) 삭제할까요? 주간 진행률이 다시 계산됩니다.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButton} onClick={() => setDeleting(null)}>취소</button>
            <button
              type="button"
              className={dangerButton}
              disabled={deleteTodo.isPending}
              onClick={() =>
                deleteTodo.mutate(deleting.id, {
                  onSuccess: () => setDeleting(null),
                  onError: (error) => toast(error.message),
                })
              }
            >
              삭제
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
