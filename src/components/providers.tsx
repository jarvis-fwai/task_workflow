"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState, useEffect } from "react";
import superjson from "superjson";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { trpc } from "@/lib/trpc";
import { Toaster } from "@/components/ui/sonner";
import { UndoProvider } from "@/contexts/undo-context";
import { BulkSelectionProvider } from "@/contexts/bulk-selection-context";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    })
  );

  // Register service worker for PWA
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <SessionProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <UndoProvider>
              <BulkSelectionProvider>
                {children}
              </BulkSelectionProvider>
            </UndoProvider>
            <Toaster position="bottom-right" richColors />
          </ThemeProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </SessionProvider>
  );
}
