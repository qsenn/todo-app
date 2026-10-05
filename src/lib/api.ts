import type { NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getSessionUser, SESSION_COOKIE, type AuthUser } from "./auth";
import { connectDB } from "./db";
import { ApiError, badRequest, unauthorized } from "./errors";
import { runAsUser } from "./tenant";
import { objectId } from "./schemas";

export type ApiErrorBody = { error: { code: string; message: string; [key: string]: unknown } };
export type IdContext = { params: Promise<{ id: string }> };

function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message, ...error.details } } satisfies ApiErrorBody,
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION",
          message: error.issues[0]?.message ?? "입력값이 올바르지 않습니다.",
          issues: error.issues.map(({ path, message }) => ({ path, message })),
        },
      } satisfies ApiErrorBody,
      { status: 400 },
    );
  }
  console.error(error);
  return Response.json(
    { error: { code: "INTERNAL", message: "서버 오류가 발생했습니다." } } satisfies ApiErrorBody,
    { status: 500 },
  );
}

/**
 * Connects to the database, requires a valid session (401 otherwise), runs the handler as that
 * user so every owned-model query is confined to their data, and maps thrown errors to JSON.
 */
export async function handle(
  request: NextRequest,
  fn: (user: AuthUser) => Promise<Response>,
): Promise<Response> {
  try {
    await connectDB();
    const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
    if (!user) throw unauthorized();
    return await runAsUser(user.id, () => fn(user));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw badRequest("INVALID_JSON", "요청 본문이 올바른 JSON이 아닙니다.");
  }
  return schema.parse(body);
}

export async function parseId(context: IdContext): Promise<string> {
  const { id } = await context.params;
  if (!objectId.safeParse(id).success) {
    throw badRequest("INVALID_ID", "올바른 ID가 아닙니다.");
  }
  return id;
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}
