import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, json, parseBody } from "@/lib/api";
import { dateString, objectId, todoCreateSchema } from "@/lib/schemas";
import { createTodo, listTodos } from "@/lib/services/todoService";

const listQuery = z.object({
  date: dateString.optional(),
  weeklyPlanId: objectId.optional(),
  unlinked: z.enum(["true", "false"]).optional(),
});

export async function GET(request: NextRequest) {
  return handle(request, async () => {
    const query = listQuery.parse(Object.fromEntries(request.nextUrl.searchParams));
    return json(await listTodos({ ...query, unlinked: query.unlinked === "true" }));
  });
}

export async function POST(request: NextRequest) {
  return handle(request, async () => json(await createTodo(await parseBody(request, todoCreateSchema)), 201));
}
