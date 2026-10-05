import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { currentUser } from "@/lib/currentUser";

/** Every page in this group requires a session; visitors are sent to /login. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
