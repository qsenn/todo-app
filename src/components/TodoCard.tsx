"use client";

import { useDndMonitor, useDraggable } from "@dnd-kit/core";
import type { KeyboardEvent, PointerEvent } from "react";
import { useMoveTodo } from "@/hooks/useTodos";
import { TODO_STATUSES, type TodoStatus } from "@/lib/schemas";
import type { TodoDTO } from "@/lib/types";
import { linkButton } from "./ui";

type Props = {
  todo: TodoDTO;
  planTitle?: string;
  onEdit: (todo: TodoDTO) => void;
  onDelete: (todo: TodoDTO) => void;
};

const isStatus = (value: unknown): value is TodoStatus => TODO_STATUSES.includes(value as TodoStatus);

// Buttons inside the card must not start a drag (pointer or Space/Enter).
const stop = (event: PointerEvent | KeyboardEvent) => event.stopPropagation();

export function TodoCard({ todo, planTitle, onEdit, onDelete }: Props) {
  const move = useMoveTodo(todo.id);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: todo.id,
    data: { status: todo.status },
  });

  // Each card handles its own drop, so its status mutation runs in the card's own scope.
  useDndMonitor({
    onDragEnd({ active, over }) {
      if (active.id !== todo.id || !over || !isStatus(over.id) || over.id === todo.status) return;
      move.mutate(over.id);
    },
  });

  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`할 일: ${todo.title}`}
      data-testid="todo-card"
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={`cursor-grab touch-none rounded-md border border-slate-200 bg-white p-3 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 ${
        isDragging ? "z-10 opacity-80 shadow-lg" : ""
      }`}
    >
      <p className={`text-sm font-medium ${todo.status === "done" ? "text-slate-400 line-through" : ""}`}>{todo.title}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-slate-500">{planTitle ?? "미연결"}</span>
        <span className="flex shrink-0 gap-2">
          <button type="button" className={linkButton} onPointerDown={stop} onKeyDown={stop} onClick={() => onEdit(todo)}>
            수정
          </button>
          <button
            type="button"
            className={`${linkButton} hover:text-red-600`}
            onPointerDown={stop}
            onKeyDown={stop}
            onClick={() => onDelete(todo)}
          >
            삭제
          </button>
        </span>
      </div>
    </li>
  );
}
