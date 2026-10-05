import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, json, parseBody } from "@/lib/api";
import { dateString, objectId, weeklyPlanCreateSchema } from "@/lib/schemas";
import { createWeeklyPlan, listWeeklyPlans } from "@/lib/services/weeklyPlanService";

const listQuery = z.object({
  goalId: objectId.optional(),
  weekStart: dateString.optional(),
  unlinked: z.enum(["true", "false"]).optional(),
});

export async function GET(request: NextRequest) {
  return handle(request, async () => {
    const query = listQuery.parse(Object.fromEntries(request.nextUrl.searchParams));
    return json(await listWeeklyPlans({ ...query, unlinked: query.unlinked === "true" }));
  });
}

export async function POST(request: NextRequest) {
  return handle(request, async () => json(await createWeeklyPlan(await parseBody(request, weeklyPlanCreateSchema)), 201));
}
