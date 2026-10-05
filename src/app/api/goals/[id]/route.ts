import type { NextRequest } from "next/server";
import { handle, json, parseBody, parseId, type IdContext } from "@/lib/api";
import { deleteModeSchema, goalUpdateSchema } from "@/lib/schemas";
import { deleteGoal, getGoal, updateGoal } from "@/lib/services/goalService";

export async function GET(request: NextRequest, context: IdContext) {
  return handle(request, async () => json(await getGoal(await parseId(context))));
}

export async function PATCH(request: NextRequest, context: IdContext) {
  return handle(request, async () => {
    const id = await parseId(context);
    return json(await updateGoal(id, await parseBody(request, goalUpdateSchema)));
  });
}

export async function DELETE(request: NextRequest, context: IdContext) {
  return handle(request, async () => {
    const id = await parseId(context);
    const mode = deleteModeSchema.parse(request.nextUrl.searchParams.get("mode") ?? undefined);
    await deleteGoal(id, mode);
    return new Response(null, { status: 204 });
  });
}
