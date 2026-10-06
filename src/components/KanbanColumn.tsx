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
      className={`flex min-h-64 flex-col rounded-lg border-2 bg-surface-soft p-3 transition-colors ${
        isOver ? "border-ink" : "border-transparent"
      }`}
    >
      <h2 className="mb-3 flex items-center justify-between px-1 text-base font-semibold text-ink">
        {STATUS_LABELS[status]}
        <span className="rounded-full border border-hairline bg-canvas px-2.5 py-0.5 text-[13px] font-semibold text-ink">{count}</span>
      </h2>
      <ul className="flex flex-1 flex-col gap-2">{children}</ul>
    </section>
  );
}
