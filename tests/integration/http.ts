// Calls App Router route handlers in-process, the same way Next.js does.
import { NextRequest } from "next/server";
import * as goals from "@/app/api/goals/route";
import * as hierarchy from "@/app/api/hierarchy/route";
import * as daily from "@/app/api/progress/daily/route";
import * as goal from "@/app/api/goals/[id]/route";
import * as goalImpact from "@/app/api/goals/[id]/impact/route";
import * as todos from "@/app/api/todos/route";
import * as todo from "@/app/api/todos/[id]/route";
import * as plans from "@/app/api/weekly-plans/route";
import * as plan from "@/app/api/weekly-plans/[id]/route";
import * as planImpact from "@/app/api/weekly-plans/[id]/impact/route";
import * as me from "@/app/api/me/route";
import { testAuth } from "../setup/session";

type Handler = (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

type CallOptions = { method?: string; path?: string; body?: unknown; id?: string; cookie?: string };

async function call(
  handler: Handler,
  { method = "GET", path = "/", body, id = "", cookie }: CallOptions = {},
): Promise<{ status: number; body: Json }> {
  const request = new NextRequest(new URL(path, "http://localhost"), {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const response = await handler(request, { params: Promise.resolve({ id }) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function created(result: Promise<{ status: number; body: Json }>) {
  const { status, body } = await result;
  if (status !== 201) throw new Error(`expected 201, got ${status}: ${JSON.stringify(body)}`);
  return body;
}

/** Route calls sent with the cookie `getCookie` returns (none for anonymous calls). */
export function client(getCookie: () => string | undefined) {
  const send = (handler: Handler, options: CallOptions = {}) => call(handler, { ...options, cookie: getCookie() });
  return {
    createGoal: (body: object) => created(send(goals.POST as Handler, { method: "POST", body })),
    listGoals: (query = "") => send(goals.GET as Handler, { path: `/api/goals${query}` }),
    getGoal: (id: string) => send(goal.GET as Handler, { id }),
    patchGoal: (id: string, body: unknown) => send(goal.PATCH as Handler, { method: "PATCH", id, body }),
    deleteGoal: (id: string, mode?: string) =>
      send(goal.DELETE as Handler, { method: "DELETE", id, path: mode ? `/x?mode=${mode}` : "/x" }),
    goalImpact: (id: string) => send(goalImpact.GET as Handler, { id }),

    createPlan: (body: object) => created(send(plans.POST as Handler, { method: "POST", body })),
    postPlan: (body: unknown) => send(plans.POST as Handler, { method: "POST", body }),
    listPlans: (query = "") => send(plans.GET as Handler, { path: `/api/weekly-plans${query}` }),
    getPlan: (id: string) => send(plan.GET as Handler, { id }),
    patchPlan: (id: string, body: unknown) => send(plan.PATCH as Handler, { method: "PATCH", id, body }),
    deletePlan: (id: string, mode?: string) =>
      send(plan.DELETE as Handler, { method: "DELETE", id, path: mode ? `/x?mode=${mode}` : "/x" }),
    planImpact: (id: string) => send(planImpact.GET as Handler, { id }),

    createTodo: (body: object) => created(send(todos.POST as Handler, { method: "POST", body })),
    postTodo: (body: unknown) => send(todos.POST as Handler, { method: "POST", body }),
    listTodos: (query = "") => send(todos.GET as Handler, { path: `/api/todos${query}` }),
    getTodo: (id: string) => send(todo.GET as Handler, { id }),
    patchTodo: (id: string, body: unknown) => send(todo.PATCH as Handler, { method: "PATCH", id, body }),
    deleteTodo: (id: string) => send(todo.DELETE as Handler, { method: "DELETE", id }),

    daily: (query: string) => send(daily.GET as Handler, { path: `/api/progress/daily${query}` }),
    hierarchy: (query: string) => send(hierarchy.GET as Handler, { path: `/api/hierarchy${query}` }),
    me: () => send(me.GET as Handler),
  };
}

/** The default test user (see tests/setup/session.ts). */
export const api = client(() => testAuth.cookie);
/** No session cookie. */
export const anonymous = client(() => undefined);
