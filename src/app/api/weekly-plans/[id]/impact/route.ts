import type { NextRequest } from "next/server";
import { handle, json, parseId, type IdContext } from "@/lib/api";
import { getWeeklyPlanImpact } from "@/lib/services/weeklyPlanService";

export async function GET(request: NextRequest, context: IdContext) {
  return handle(request, async () => json(await getWeeklyPlanImpact(await parseId(context))));
}
