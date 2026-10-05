"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ApiClientError } from "@/lib/client";
import { ToastProvider } from "./Toast";

const isUnauthenticated = (error: unknown) => error instanceof ApiClientError && error.status === 401;

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(() => {
    // The session ended (logout in another tab, expiry): go log in again.
    const onError = (error: unknown) => {
      if (isUnauthenticated(error)) router.replace("/login");
    };
    return new QueryClient({
      queryCache: new QueryCache({ onError }),
      mutationCache: new MutationCache({ onError }),
      defaultOptions: {
        queries: { staleTime: 5_000, retry: (count, error) => !isUnauthenticated(error) && count < 1 },
      },
    });
  });
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
