import { KeyboardCode, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { TODO_STATUSES, type TodoStatus } from "@/lib/schemas";

/** Arrow Left/Right moves a dragged card straight to the neighbouring column. */
export const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const step = event.code === KeyboardCode.Right ? 1 : event.code === KeyboardCode.Left ? -1 : 0;
  if (step === 0) return undefined;
  event.preventDefault();

  const current = (context.over?.id ?? context.active?.data.current?.status) as TodoStatus | undefined;
  const index = current ? TODO_STATUSES.indexOf(current) : -1;
  if (index < 0) return currentCoordinates;
  const target = TODO_STATUSES[Math.min(Math.max(index + step, 0), TODO_STATUSES.length - 1)];
  const rect = context.droppableRects.get(target);
  // Coordinates are the dragged card's top-left; place it just inside the target column.
  return rect ? { x: rect.left + 12, y: rect.top + 40 } : currentCoordinates;
};
