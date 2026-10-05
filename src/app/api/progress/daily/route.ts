import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, json } from "@/lib/api";
import { dateString } from "@/lib/schemas";
import { getDailyProgress } from "@/lib/services/progressService";

const query = z.object({ date: dateString });

export async function GET(request: NextRequest) {
  return handle(request, async () => {
    const { date } = query.parse(Object.fromEntries(request.nextUrl.searchParams));
    return json(await getDailyProgress(date));
  });
}
