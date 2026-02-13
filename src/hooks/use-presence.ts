"use client";

import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Reports user presence at a location and returns active viewers.
 * @param location - e.g. "project:abc123" or "task:xyz456"
 */
export function usePresence(location: string | null) {
  const report = trpc.presence.report.useMutation();
  const { data: viewers } = trpc.presence.get.useQuery(
    { location: location! },
    {
      enabled: !!location,
      refetchInterval: 15_000, // poll every 15s
    }
  );

  useEffect(() => {
    if (!location) return;

    // Report immediately
    report.mutate({ location });

    // Then every 30s
    const interval = setInterval(() => {
      report.mutate({ location });
    }, 30_000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return viewers ?? [];
}
