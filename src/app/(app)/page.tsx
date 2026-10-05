"use client";

import { Board } from "@/components/Board";
import { ClientDate } from "@/components/ClientDate";

export default function BoardPage() {
  return <ClientDate>{(today) => <Board initialDate={today} />}</ClientDate>;
}
