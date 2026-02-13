"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TaskDetailPanel } from "@/components/task/task-detail-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  List,
  Columns3,
  Calendar,
  CheckCircle2,
  Circle,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

type GroupBy = "none" | "due_date" | "project" | "priority";

interface TaskItem {
  id: string;
  title: string;
  status: string;
  dueDate: string | Date | null;
  priority?: string | null;
  taskProjects?: { project: { id: string; name: string } }[];
  [key: string]: unknown;
}

function getDateGroupKey(dueDate: string | Date | null, now: Date): string {
  if (!dueDate) return "No Date";
  const d = new Date(dueDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(today.getDate() + 2);

  // End of this week (Sunday)
  const thisWeekEnd = new Date(today);
  thisWeekEnd.setDate(today.getDate() + (7 - today.getDay()));
  // End of next week
  const nextWeekEnd = new Date(thisWeekEnd);
  nextWeekEnd.setDate(thisWeekEnd.getDate() + 7);

  const taskDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (taskDate < today) return "Overdue";
  if (taskDate.getTime() === today.getTime()) return "Today";
  if (taskDate.getTime() === tomorrow.getTime()) return "Tomorrow";
  if (taskDate <= thisWeekEnd) return "This Week";
  if (taskDate <= nextWeekEnd) return "Next Week";
  return "Later";
}

const DATE_GROUP_ORDER = [
  "Overdue",
  "Today",
  "Tomorrow",
  "This Week",
  "Next Week",
  "Later",
  "No Date",
];

const PRIORITY_ORDER = ["HIGH", "MEDIUM", "LOW", "NONE"];
const PRIORITY_LABELS: Record<string, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  NONE: "No Priority",
};

function groupTasks(
  tasks: TaskItem[],
  groupBy: GroupBy,
  now: Date
): { label: string; tasks: TaskItem[]; color?: string }[] {
  if (groupBy === "none") {
    // Default sections
    const overdue = tasks.filter(
      (t) => t.status === "INCOMPLETE" && t.dueDate && new Date(t.dueDate) < now
    );
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const todayTasks = tasks.filter(
      (t) =>
        t.status === "INCOMPLETE" &&
        t.dueDate &&
        new Date(t.dueDate) >= now &&
        new Date(t.dueDate) < todayEnd
    );
    const upcoming = tasks.filter(
      (t) =>
        t.status === "INCOMPLETE" &&
        (!t.dueDate || new Date(t.dueDate) >= todayEnd)
    );
    const completed = tasks.filter((t) => t.status === "COMPLETE");
    return [
      { label: "Overdue", tasks: overdue, color: "text-red-600" },
      { label: "Today", tasks: todayTasks, color: "text-green-600" },
      { label: "Upcoming", tasks: upcoming, color: "text-[#1e1f21]" },
      { label: "Completed", tasks: completed, color: "text-muted-foreground" },
    ].filter((s) => s.tasks.length > 0);
  }

  if (groupBy === "due_date") {
    const groups = new Map<string, TaskItem[]>();
    for (const key of DATE_GROUP_ORDER) groups.set(key, []);
    for (const task of tasks) {
      if (task.status === "COMPLETE") continue;
      const key = getDateGroupKey(task.dueDate, now);
      groups.get(key)!.push(task);
    }
    const result = DATE_GROUP_ORDER.filter((k) => groups.get(k)!.length > 0).map(
      (k) => ({
        label: k,
        tasks: groups.get(k)!,
        color: k === "Overdue" ? "text-red-600" : k === "Today" ? "text-green-600" : "text-[#1e1f21]",
      })
    );
    const completed = tasks.filter((t) => t.status === "COMPLETE");
    if (completed.length > 0)
      result.push({ label: "Completed", tasks: completed, color: "text-muted-foreground" });
    return result;
  }

  if (groupBy === "project") {
    const groups = new Map<string, { name: string; tasks: TaskItem[] }>();
    const noProject: TaskItem[] = [];
    for (const task of tasks) {
      const proj = task.taskProjects?.[0]?.project;
      if (proj) {
        if (!groups.has(proj.id)) groups.set(proj.id, { name: proj.name, tasks: [] });
        groups.get(proj.id)!.tasks.push(task);
      } else {
        noProject.push(task);
      }
    }
    const result = Array.from(groups.values()).map((g) => ({
      label: g.name,
      tasks: g.tasks,
    }));
    if (noProject.length > 0) result.push({ label: "No Project", tasks: noProject });
    return result;
  }

  if (groupBy === "priority") {
    const groups = new Map<string, TaskItem[]>();
    for (const key of PRIORITY_ORDER) groups.set(key, []);
    for (const task of tasks) {
      const p = (task.priority || "NONE").toUpperCase();
      const key = PRIORITY_ORDER.includes(p) ? p : "NONE";
      groups.get(key)!.push(task);
    }
    return PRIORITY_ORDER.filter((k) => groups.get(k)!.length > 0).map((k) => ({
      label: PRIORITY_LABELS[k],
      tasks: groups.get(k)!,
      color:
        k === "HIGH"
          ? "text-red-600"
          : k === "MEDIUM"
            ? "text-orange-500"
            : k === "LOW"
              ? "text-blue-500"
              : "text-muted-foreground",
    }));
  }

  return [];
}

function MyTasksCalendar({
  tasks,
  onTaskClick,
}: {
  tasks: TaskItem[];
  onTaskClick: (id: string) => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  }, [year, month]);

  const getTasksForDate = (date: Date) =>
    tasks.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
    });

  const today = new Date();

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(new Date(year, month - 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-medium">
          {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(new Date(year, month + 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-px rounded-lg border bg-gray-200 dark:bg-border">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-white p-2 text-center text-xs font-medium text-muted-foreground dark:bg-card">
            {d}
          </div>
        ))}
        {calendarDays.map((day, i) => {
          const dayTasks = getTasksForDate(day.date);
          const isToday = day.date.toDateString() === today.toDateString();
          return (
            <div
              key={i}
              className={cn(
                "min-h-[80px] bg-white p-1 dark:bg-card",
                !day.isCurrentMonth && "bg-gray-50 dark:bg-muted/10"
              )}
            >
              <div className={cn("mb-1 text-xs", isToday ? "font-bold text-blue-600" : day.isCurrentMonth ? "text-foreground" : "text-muted-foreground")}>
                {day.date.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onTaskClick(t.id)}
                    className="block w-full truncate rounded bg-blue-50 px-1 py-0.5 text-left text-[10px] text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300"
                  >
                    {t.title}
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{dayTasks.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ViewMode = "list" | "board" | "calendar";

function CollapsibleSection({
  label,
  count,
  color,
  defaultOpen = true,
  children,
}: {
  label: string;
  count: number;
  color?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 mb-2"
      >
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", !open && "-rotate-90")}
        />
        <h3 className={cn("text-sm font-semibold", color || "text-[#1e1f21]")}>
          {label}
        </h3>
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          ({count})
        </span>
      </button>
      {open && children}
    </div>
  );
}

export function MyTasksContent() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { data: workspaces } = trpc.workspaces.list.useQuery();
  const workspaceId = workspaces?.[0]?.id;

  const { data: tasks, isLoading: tasksLoading } = trpc.tasks.myTasks.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );

  const utils = trpc.useUtils();

  const completeTask = trpc.tasks.complete.useMutation({
    onSuccess: () => {
      if (workspaceId) utils.tasks.myTasks.invalidate({ workspaceId });
    },
  });

  const uncompleteTask = trpc.tasks.uncomplete.useMutation({
    onSuccess: () => {
      if (workspaceId) utils.tasks.myTasks.invalidate({ workspaceId });
    },
  });

  const handleToggle = (taskId: string, status: string) => {
    if (status === "COMPLETE") {
      uncompleteTask.mutate({ id: taskId });
    } else {
      completeTask.mutate({ id: taskId });
    }
  };

  const now = useMemo(() => (mounted ? new Date() : null), [mounted]);

  const formatDate = (date: string | Date | null) => {
    if (!date || !now) return null;
    const d = new Date(date);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    if (d.toDateString() === now.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const isOverdue = (date: string | Date | null) => {
    if (!date || !now) return false;
    return new Date(date) < now;
  };

  const sections = useMemo(() => {
    if (!tasks || !now) return [];
    return groupTasks(tasks as TaskItem[], groupBy, now);
  }, [tasks, groupBy, now]);

  if (tasksLoading) {
    return (
      <div className="flex h-[calc(100%-56px)]">
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-gray-50 py-2.5">
              <div className="h-4 w-4 animate-pulse rounded-full bg-muted" />
              <div className="h-3.5 animate-pulse rounded bg-muted" style={{ width: `${120 + Math.random() * 150}px` }} />
              <div className="flex-1" />
              <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100%-56px)]">
      <div className="flex-1 overflow-y-auto">
        {/* View Tabs + Grouping */}
        <div className="flex items-center justify-between gap-1 border-b bg-white px-6 py-1">
          <div className="flex items-center gap-1">
            {([
              { key: "list", label: "List", icon: List },
              { key: "board", label: "Board", icon: Columns3 },
              { key: "calendar", label: "Calendar", icon: Calendar },
            ] as const).map((v) => (
              <Button
                key={v.key}
                variant="ghost"
                size="sm"
                className={cn(
                  "gap-1.5 text-xs",
                  viewMode === v.key
                    ? "bg-muted text-[#1e1f21]"
                    : "text-muted-foreground"
                )}
                onClick={() => setViewMode(v.key)}
              >
                <v.icon className="h-3.5 w-3.5" />
                {v.label}
              </Button>
            ))}
          </div>
          {viewMode !== "calendar" && (
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
              <SelectTrigger className="h-7 w-[160px] text-xs">
                <SelectValue placeholder="Group by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Group by: None</SelectItem>
                <SelectItem value="due_date">Group by: Due Date</SelectItem>
                <SelectItem value="project">Group by: Project</SelectItem>
                <SelectItem value="priority">Group by: Priority</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="p-6">
          {!tasks || tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted/30">
                <CheckCircle2 className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <h3 className="text-lg font-medium text-[#1e1f21]">
                Start adding tasks
              </h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Track your work by adding tasks. Organize them into sections and
                set due dates.
              </p>
            </div>
          ) : viewMode === "board" ? (
            /* Board View */
            <div className="flex gap-4 overflow-x-auto pb-4">
              {sections.map((section) => (
                <div
                  key={section.label}
                  className="min-w-[280px] max-w-[320px] rounded-lg bg-[#f5f5f5] p-3 dark:bg-muted/30"
                >
                  <h3 className={cn("mb-3 text-sm font-semibold", section.color)}>
                    {section.label}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      ({section.tasks.length})
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {section.tasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className="w-full rounded-lg border bg-white p-3 text-left shadow-sm hover:shadow dark:bg-card"
                      >
                        <div className="flex items-start gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggle(task.id, task.status);
                            }}
                            className="mt-0.5 flex-shrink-0"
                          >
                            {task.status === "COMPLETE" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <Circle className="h-4 w-4 text-[#cfcbcb] hover:text-green-600" />
                            )}
                          </button>
                          <div className="flex-1">
                            <p className={cn("text-sm", task.status === "COMPLETE" && "text-muted-foreground line-through")}>
                              {task.title}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              {task.taskProjects?.[0] && (
                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                                  {task.taskProjects[0].project.name}
                                </span>
                              )}
                              {task.dueDate && (
                                <span className={cn("text-[10px]", isOverdue(task.dueDate) && task.status !== "COMPLETE" ? "text-red-600" : "text-muted-foreground")}>
                                  {formatDate(task.dueDate)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : viewMode === "calendar" ? (
            /* Calendar View */
            <MyTasksCalendar
              tasks={(tasks as TaskItem[]).filter((t) => t.status === "INCOMPLETE")}
              onTaskClick={setSelectedTaskId}
            />
          ) : (
            /* List View */
            <div className="space-y-6">
              {sections.map((section) => (
                <CollapsibleSection
                  key={section.label}
                  label={section.label}
                  count={section.tasks.length}
                  color={section.color}
                >
                  <div className="space-y-px">
                    {section.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="group flex items-center rounded py-1.5 hover:bg-[#f9f8f8]"
                      >
                        <GripVertical className="mr-1 h-3.5 w-3.5 text-transparent group-hover:text-[#cfcbcb]" />
                        <button
                          onClick={() =>
                            handleToggle(task.id, task.status)
                          }
                          className="mr-2 flex-shrink-0"
                        >
                          {task.status === "COMPLETE" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <Circle className="h-4 w-4 text-[#cfcbcb] hover:text-green-600" />
                          )}
                        </button>
                        <button
                          className={cn(
                            "flex-1 text-left text-sm",
                            task.status === "COMPLETE" &&
                              "text-muted-foreground line-through"
                          )}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          {task.title}
                        </button>
                        {task.taskProjects?.[0] && (
                          <span className="mr-4 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            {task.taskProjects[0].project.name}
                          </span>
                        )}
                        {task.dueDate && (
                          <span
                            className={cn(
                              "text-xs",
                              isOverdue(task.dueDate) &&
                                task.status !== "COMPLETE"
                                ? "text-red-600"
                                : "text-muted-foreground"
                            )}
                          >
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}
