"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthUser } from "@/lib/auth";

const LINKS = [
  { href: "/", label: "보드" },
  { href: "/weekly", label: "주간 계획" },
  { href: "/goals", label: "1년 목표" },
  { href: "/hierarchy", label: "계층 보기" },
  { href: "/unlinked", label: "미연결 항목" },
] as const;

export function Nav({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  return (
    // Full-height left sidebar on md+; a wrapping top bar on narrow screens.
    <nav className="flex shrink-0 flex-wrap items-center border-b border-hairline bg-canvas md:sticky md:top-0 md:h-screen md:w-56 md:flex-col md:flex-nowrap md:items-stretch md:border-b-0 md:border-r">
      <p className="hidden px-5 pt-6 pb-4 text-xl font-bold text-primary md:block">할 일 앱</p>
      <ul className="flex flex-1 flex-wrap gap-1 px-4 py-2 md:flex-none md:flex-col md:gap-0.5 md:px-3">
        {LINKS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`block border-b-2 px-3 py-2 text-base font-semibold md:border-b-0 md:border-l-2 ${
                  active ? "border-ink text-ink" : "border-transparent text-muted hover:bg-surface-soft hover:text-ink"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div
        className="flex w-full items-center gap-2 border-t border-hairline-soft px-4 py-2 md:mt-auto md:py-4"
        aria-label="로그인한 사용자"
      >
        {user.avatarUrl && (
          <Image
            src={user.avatarUrl}
            alt={`${user.username} 아바타`}
            width={28}
            height={28}
            unoptimized
            className="rounded-full"
          />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium" data-testid="current-username">
          {user.username}
        </span>
        <form action="/auth/logout" method="post">
          <button type="submit" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
            로그아웃
          </button>
        </form>
      </div>
    </nav>
  );
}
