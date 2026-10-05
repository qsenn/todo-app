import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, json } from "@/lib/api";
import { getHierarchy } from "@/lib/services/hierarchyService";

const query = z.object({ year: z.coerce.number().int().min(1970).max(9999) });

export async function GET(request: NextRequest) {
  return handle(request, async () => {
    const { year } = query.parse(Object.fromEntries(request.nextUrl.searchParams));
    return json(await getHierarchy(year));
  });
}
