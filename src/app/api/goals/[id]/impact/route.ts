import type { NextRequest } from "next/server";
import { handle, json, parseId, type IdContext } from "@/lib/api";
import { getGoalImpact } from "@/lib/services/goalService";

export async function GET(request: NextRequest, context: IdContext) {
  return handle(request, async () => json(await getGoalImpact(await parseId(context))));
}
