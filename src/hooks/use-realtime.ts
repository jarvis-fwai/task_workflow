"use client";

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function useRealtime(workspaceId: string | undefined) {
  const utils = trpc.useUtils();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    const connect = () => {
      const es = new EventSource(
        `/api/realtime/subscribe?workspaceId=${workspaceId}`
      );

      es.addEventListener("task.created", (e) => {
        utils.tasks.list.invalidate();
        utils.tasks.myTasks.invalidate();
        utils.sections.list.invalidate();
        try {
          const data = JSON.parse(e.data);
          if (data?.title) {
            toast.info(`New task: "${data.title}"`);
          }
        } catch {}
      });

      es.addEventListener("task.updated", (e) => {
        utils.tasks.list.invalidate();
        utils.tasks.get.invalidate();
        utils.tasks.myTasks.invalidate();
        try {
          const data = JSON.parse(e.data);
          if (data?.title) {
            toast.info(`Task updated: "${data.title}"`);
          }
        } catch {}
      });

      es.addEventListener("task.completed", (e) => {
        utils.tasks.list.invalidate();
        utils.tasks.myTasks.invalidate();
        utils.tasks.get.invalidate();
        try {
          const data = JSON.parse(e.data);
          if (data?.title) {
            toast.success(`Task completed: "${data.title}"`, {
              icon: "✅",
            });
          }
        } catch {}
      });

      es.addEventListener("task.deleted", () => {
        utils.tasks.list.invalidate();
        utils.tasks.myTasks.invalidate();
      });

      es.addEventListener("task.moved", (e) => {
        utils.tasks.list.invalidate();
        utils.sections.list.invalidate();
        try {
          const data = JSON.parse(e.data);
          if (data?.sectionName) {
            toast.info(`Task moved to "${data.sectionName}"`);
          }
        } catch {}
      });

      es.addEventListener("comment.added", () => {
        utils.tasks.get.invalidate();
        utils.comments.list.invalidate();
      });

      es.addEventListener("notification.new", () => {
        utils.notifications.list.invalidate();
        utils.notifications.unreadCount.invalidate();
      });

      es.addEventListener("section.updated", () => {
        utils.sections.list.invalidate();
      });

      es.addEventListener("project.updated", () => {
        utils.projects.get.invalidate();
        utils.projects.list.invalidate();
      });

      es.onerror = () => {
        es.close();
        setTimeout(connect, 5000);
      };

      eventSourceRef.current = es;
    };

    connect();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [workspaceId, utils]);
}

/**
 * Hook for polling-based realtime updates as fallback.
 * Refetches key queries every `intervalMs` milliseconds.
 */
export function useRealtimePolling(enabled: boolean, intervalMs = 30000) {
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      utils.tasks.list.invalidate();
      utils.tasks.myTasks.invalidate();
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [enabled, intervalMs, utils]);
}
