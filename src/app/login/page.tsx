import { redirect } from "next/navigation";
import { currentUser } from "@/lib/currentUser";

const ERRORS: Record<string, string> = {
  denied: "GitHub에서 로그인을 취소했습니다.",
  state: "로그인 요청이 만료되었거나 올바르지 않습니다. 다시 시도하세요.",
  code: "GitHub 인증 코드를 받지 못했습니다. 다시 시도하세요.",
  github: "GitHub과 통신하지 못했습니다. 잠시 후 다시 시도하세요.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await currentUser()) redirect("/");
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-semibold">할 일 앱</h1>
        <p className="mt-2 text-sm text-slate-500">GitHub 계정으로 로그인하면 내 할 일만 볼 수 있습니다.</p>
        {message && (
          <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {message}
          </p>
        )}
        {/* A plain link: /auth/github is a route handler that redirects to GitHub. */}
        <a
          href="/auth/github"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-current">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          GitHub로 로그인
        </a>
      </div>
    </main>
  );
}
