import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "할 일 앱",
  description: "할 일 → 주간 계획 → 1년 목표를 잇는 칸반 보드",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900 md:flex-row">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
