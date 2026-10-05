"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { STATUS_LABELS } from "@/lib/labels";
import type { TodoStatus } from "@/lib/schemas";

type Props = { status: TodoStatus; count: number; children: ReactNode };

export function KanbanColumn({ status, count, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${STATUS_LABELS[status]} 컬럼`}
      data-testid={`column-${status}`}
      className={`flex min-h-64 flex-col rounded-lg border p-3 transition-colors ${
        isOver ? "border-slate-500 bg-slate-100" : "border-slate-200 bg-slate-100/60"
      }`}
    >
      <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-700">
        {STATUS_LABELS[status]}
        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{count}</span>
      </h2>
      <ul className="flex flex-1 flex-col gap-2">{children}</ul>
    </section>
  );
}
