import type { NextRequest } from "next/server";
import { handle, json, parseBody, parseId, type IdContext } from "@/lib/api";
import { deleteModeSchema, weeklyPlanUpdateSchema } from "@/lib/schemas";
import { deleteWeeklyPlan, getWeeklyPlan, updateWeeklyPlan } from "@/lib/services/weeklyPlanService";

export async function GET(request: NextRequest, context: IdContext) {
  return handle(request, async () => json(await getWeeklyPlan(await parseId(context))));
}

export async function PATCH(request: NextRequest, context: IdContext) {
  return handle(request, async () => {
    const id = await parseId(context);
    return json(await updateWeeklyPlan(id, await parseBody(request, weeklyPlanUpdateSchema)));
  });
}

export async function DELETE(request: NextRequest, context: IdContext) {
  return handle(request, async () => {
    const id = await parseId(context);
    const mode = deleteModeSchema.parse(request.nextUrl.searchParams.get("mode") ?? undefined);
    await deleteWeeklyPlan(id, mode);
    return new Response(null, { status: 204 });
  });
}
