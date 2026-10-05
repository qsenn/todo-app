"use client";

import { ClientDate } from "@/components/ClientDate";
import { WeeklyPlansView } from "@/components/WeeklyPlansView";

export default function WeeklyPage() {
  return <ClientDate>{(today) => <WeeklyPlansView today={today} />}</ClientDate>;
}
