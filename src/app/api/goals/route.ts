import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, json, parseBody } from "@/lib/api";
import { goalCreateSchema } from "@/lib/schemas";
import { createGoal, listGoals } from "@/lib/services/goalService";

const listQuery = z.object({ year: z.coerce.number().int().min(1970).max(9999).optional() });

export async function GET(request: NextRequest) {
  return handle(request, async () => {
    const query = listQuery.parse(Object.fromEntries(request.nextUrl.searchParams));
    return json(await listGoals(query));
  });
}

export async function POST(request: NextRequest) {
  return handle(request, async () => json(await createGoal(await parseBody(request, goalCreateSchema)), 201));
}
