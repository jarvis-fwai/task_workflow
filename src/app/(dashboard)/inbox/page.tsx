"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Archive,
  Bell,
  CheckCircle2,
  MailOpen,
  MessageSquare,
  UserPlus,
  AlertCircle,
  AtSign,
  Clock,
  Flag,
  ChevronDown,
} from "lucide-react";

type FilterTab = "all" | "mentions" | "assigned" | "updates";
type GroupMode = "none" | "task" | "project";

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  TASK_ASSIGNED: <UserPlus className="h-4 w-4 text-[#4573D2]" />,
  TASK_COMPLETED: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  COMMENT_ADDED: <MessageSquare className="h-4 w-4 text-[#AA62E3]" />,
  MENTIONED: <AtSign className="h-4 w-4 text-[#F06A6A]" />,
  STATUS_UPDATE: <AlertCircle className="h-4 w-4 text-[#FD9A00]" />,
  DUE_DATE_APPROACHING: <Clock className="h-4 w-4 text-[#FD9A00]" />,
  TASK_OVERDUE: <AlertCircle className="h-4 w-4 text-red-600" />,
  FOLLOWER_ADDED: <UserPlus className="h-4 w-4 text-[#4573D2]" />,
  APPROVAL_REQUEST: <CheckCircle2 className="h-4 w-4 text-[#AA62E3]" />,
};

const TAB_TYPES: Record<FilterTab, string[] | null> = {
  all: null,
  mentions: ["MENTIONED", "COMMENT_ADDED"],
  assigned: ["TASK_ASSIGNED"],
  updates: ["STATUS_UPDATE", "TASK_COMPLETED", "DUE_DATE_APPROACHING", "TASK_OVERDUE", "RULE_TRIGGERED"],
};

function formatTime(date: Date | string, now: Date | null) {
  if (!now) return "";
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function useFollowUps() {
  const [followUps, setFollowUps] = useState<Set<string>>(new Set());
  useEffect(() => {
    const stored = localStorage.getItem("inbox-follow-ups");
    if (stored) setFollowUps(new Set(JSON.parse(stored)));
  }, []);
  const toggle = useCallback((id: string) => {
    setFollowUps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("inbox-follow-ups", JSON.stringify([...next]));
      return next;
    });
  }, []);
  return { followUps, toggle };
}

interface NotificationItem {
  id: string;
  type: string;
  message: string | null;
  isRead: boolean;
  createdAt: string | Date;
  resourceId: string;
  resourceType: string;
}

export default function InboxPage() {
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [groupMode, setGroupMode] = useState<GroupMode>("none");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const now = useMemo(() => (mounted ? new Date() : null), [mounted]);
  const { followUps, toggle: toggleFollowUp } = useFollowUps();

  const { data, isLoading } = trpc.notifications.list.useQuery({ filter: "all" });
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery();
  const utils = trpc.useUtils();

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const archiveAll = trpc.notifications.archiveAll.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const allNotifications = (data?.notifications || []) as NotificationItem[];

  // Filter by tab
  const filteredNotifications = useMemo(() => {
    const types = TAB_TYPES[filterTab];
    if (!types) return allNotifications;
    return allNotifications.filter((n) => types.includes(n.type));
  }, [allNotifications, filterTab]);

  // Group notifications
  const grouped = useMemo(() => {
    if (groupMode === "none") return [{ label: "", items: filteredNotifications }];

    const groups = new Map<string, { label: string; items: NotificationItem[] }>();

    for (const n of filteredNotifications) {
      let key: string;
      let label: string;

      if (groupMode === "task") {
        key = n.resourceType === "task" ? n.resourceId : `other-${n.id}`;
        label = n.resourceType === "task" ? (n.message?.split(" ").slice(0, 4).join(" ") || "Task") : "Other";
      } else {
        // project grouping - use resourceId as fallback grouping
        key = n.resourceId || "other";
        label = n.message?.split(" ").slice(0, 3).join(" ") || "Notifications";
      }

      if (!groups.has(key)) groups.set(key, { label, items: [] });
      groups.get(key)!.items.push(n);
    }

    return Array.from(groups.values());
  }, [filteredNotifications, groupMode]);

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = { all: 0, mentions: 0, assigned: 0, updates: 0 };
    for (const n of allNotifications) {
      counts.all++;
      for (const tab of ["mentions", "assigned", "updates"] as FilterTab[]) {
        if (TAB_TYPES[tab]?.includes(n.type)) counts[tab]++;
      }
    }
    return counts;
  }, [allNotifications]);

  return (
    <div className="h-full">
      <div className="flex h-14 items-center justify-between border-b bg-white px-6">
        <h1 className="text-lg font-medium text-[#1e1f21]">Inbox</h1>
        <div className="flex items-center gap-2">
          <select
            className="rounded border px-2 py-1 text-xs text-muted-foreground"
            value={groupMode}
            onChange={(e) => setGroupMode(e.target.value as GroupMode)}
          >
            <option value="none">No grouping</option>
            <option value="task">Group by task</option>
            <option value="project">Group by resource</option>
          </select>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <MailOpen className="h-3.5 w-3.5" />
            Mark all read
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => archiveAll.mutate()}
            disabled={archiveAll.isPending}
          >
            <Archive className="h-3.5 w-3.5" />
            Archive all
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b bg-white px-6 py-1">
        {(
          [
            { key: "all" as const, label: "All" },
            { key: "mentions" as const, label: "Mentions" },
            { key: "assigned" as const, label: "Assigned" },
            { key: "updates" as const, label: "Updates" },
          ]
        ).map((f) => (
          <Button
            key={f.key}
            variant="ghost"
            size="sm"
            className={cn(
              "text-xs",
              filterTab === f.key
                ? "bg-muted text-[#1e1f21]"
                : "text-muted-foreground"
            )}
            onClick={() => setFilterTab(f.key)}
          >
            {f.label}
            {tabCounts[f.key] > 0 && (
              <span className="ml-1 rounded-full bg-gray-200 px-1.5 text-[10px] text-gray-600">
                {tabCounts[f.key]}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Notification List */}
      <div className="divide-y overflow-y-auto" style={{ height: "calc(100% - 104px)" }}>
        {isLoading ? (
          <div className="space-y-0">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 px-6 py-4">
                <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-64 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotifications.length > 0 ? (
          grouped.map((group, gi) => (
            <div key={gi}>
              {group.label && groupMode !== "none" && (
                <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-gray-50 px-6 py-2">
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-[#1e1f21]">{group.label}</span>
                  <span className="text-xs text-muted-foreground">({group.items.length})</span>
                </div>
              )}
              {group.items.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex w-full items-start gap-3 px-6 py-4 text-left transition-colors hover:bg-muted/30",
                    !notification.isRead && "bg-blue-50/30"
                  )}
                >
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-muted/50">
                    {NOTIFICATION_ICONS[notification.type] || (
                      <Bell className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <button
                    className="flex-1 text-left"
                    onClick={() => {
                      if (!notification.isRead) {
                        markRead.mutate({ id: notification.id });
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-sm",
                          !notification.isRead ? "font-medium" : "font-normal"
                        )}
                      >
                        {notification.type
                          .replace(/_/g, " ")
                          .toLowerCase()
                          .replace(/^\w/, (c) => c.toUpperCase())}
                      </span>
                      {!notification.isRead && (
                        <div className="h-2 w-2 rounded-full bg-[#4573D2]" />
                      )}
                    </div>
                    {notification.message && (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {notification.message}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatTime(notification.createdAt, now)}
                    </p>
                  </button>
                  <button
                    onClick={() => toggleFollowUp(notification.id)}
                    className={cn(
                      "mt-1 flex-shrink-0 rounded p-1 hover:bg-muted/50",
                      followUps.has(notification.id)
                        ? "text-orange-500"
                        : "text-muted-foreground/30 hover:text-muted-foreground"
                    )}
                    title={followUps.has(notification.id) ? "Remove follow-up" : "Follow up"}
                  >
                    <Flag
                      className="h-3.5 w-3.5"
                      fill={followUps.has(notification.id) ? "currentColor" : "none"}
                    />
                  </button>
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted/30">
              <Bell className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <h3 className="text-lg font-medium text-[#1e1f21]">
              You&apos;re all caught up!
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Notifications about tasks, comments, and mentions will appear
              here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
