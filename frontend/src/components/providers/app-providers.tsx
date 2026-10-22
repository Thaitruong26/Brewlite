"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuthStore } from "@/store/auth-store";

function AuthEvents() {
  const router = useRouter();
  const pathname = usePathname();
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
    const sync = () => hydrate();
    const unauthorized = () => {
      const next = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    };
    window.addEventListener("brewlite:auth-change", sync);
    window.addEventListener("brewlite:unauthorized", unauthorized);
    return () => {
      window.removeEventListener("brewlite:auth-change", sync);
      window.removeEventListener("brewlite:unauthorized", unauthorized);
    };
  }, [hydrate, pathname, router]);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
  }));
  return <QueryClientProvider client={queryClient}><AuthEvents />{children}</QueryClientProvider>;
}
