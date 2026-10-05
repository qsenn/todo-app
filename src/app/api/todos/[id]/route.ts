import type { NextRequest } from "next/server";
import { handle, json, parseBody, parseId, type IdContext } from "@/lib/api";
import { todoUpdateSchema } from "@/lib/schemas";
import { deleteTodo, getTodo, updateTodo } from "@/lib/services/todoService";

export async function GET(request: NextRequest, context: IdContext) {
  return handle(request, async () => json(await getTodo(await parseId(context))));
}

export async function PATCH(request: NextRequest, context: IdContext) {
  return handle(request, async () => {
    const id = await parseId(context);
    return json(await updateTodo(id, await parseBody(request, todoUpdateSchema)));
  });
}

export async function DELETE(request: NextRequest, context: IdContext) {
  return handle(request, async () => {
    await deleteTodo(await parseId(context));
    return new Response(null, { status: 204 });
  });
}
