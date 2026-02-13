"use client";

import { useRealtime, useRealtimePolling } from "@/hooks/use-realtime";
import { trpc } from "@/lib/trpc";

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { data: workspaces } = trpc.workspaces.list.useQuery(undefined, {
    staleTime: Infinity,
  });
  const workspaceId = workspaces?.[0]?.id;

  // SSE-based realtime updates
  useRealtime(workspaceId);

  // Polling fallback every 30s
  useRealtimePolling(!workspaceId, 30000);

  return <>{children}</>;
}
