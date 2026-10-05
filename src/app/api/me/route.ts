import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";

export async function GET(request: NextRequest) {
  return handle(request, async (user) => json({ username: user.username, avatarUrl: user.avatarUrl }));
}
