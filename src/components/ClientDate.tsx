"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { today } from "@/lib/dates";

const subscribe = () => () => {};

/**
 * Renders children with the viewer's local "today". The server cannot know the browser's
 * time zone, so nothing renders until hydration to avoid a date mismatch near midnight.
 */
export function ClientDate({ children }: { children: (today: string) => ReactNode }) {
  const value = useSyncExternalStore(subscribe, () => today(), () => null);
  return value ? children(value) : <p className="text-sm text-slate-500">불러오는 중…</p>;
}
