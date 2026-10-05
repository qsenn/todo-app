"use client";

import { ClientDate } from "@/components/ClientDate";
import { GoalsView } from "@/components/GoalsView";

export default function GoalsPage() {
  return <ClientDate>{(today) => <GoalsView today={today} />}</ClientDate>;
}
