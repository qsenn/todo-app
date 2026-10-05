"use client";

import { ClientDate } from "@/components/ClientDate";
import { HierarchyView } from "@/components/HierarchyView";

export default function HierarchyPage() {
  return <ClientDate>{(today) => <HierarchyView today={today} />}</ClientDate>;
}
