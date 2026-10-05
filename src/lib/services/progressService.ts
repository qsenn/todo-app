import { dailyProgress } from "@/lib/progress";
import type { DailyProgressDTO } from "@/lib/types";
import { Todo } from "@/models/Todo";

export async function getDailyProgress(date: string): Promise<DailyProgressDTO> {
  const [totalCount, doneCount] = await Promise.all([
    Todo.countDocuments({ date }),
    Todo.countDocuments({ date, status: "done" }),
  ]);
  return { date, doneCount, totalCount, progress: dailyProgress(doneCount, totalCount) };
}
