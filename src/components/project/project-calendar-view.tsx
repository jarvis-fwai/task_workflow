"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Plus,
} from "lucide-react";

interface ProjectCalendarViewProps {
  projectId: string;
  onTaskClick: (taskId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  INCOMPLETE: "bg-blue-100 text-blue-800 border-blue-200",
  COMPLETE: "bg-green-100 text-green-700 border-green-200",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface TaskBar {
  id: string;
  title: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  color: string;
}

export function ProjectCalendarView({
  projectId,
  onTaskClick,
}: ProjectCalendarViewProps) {
  const { data: tasks, isLoading } = trpc.tasks.list.useQuery({ projectId });
  const utils = trpc.useUtils();
  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => utils.tasks.list.invalidate({ projectId }),
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ projectId });
      setNewTaskTitle("");
      setAddingDate(null);
    },
  });

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

  // Build task bars with start/end dates
  const taskBars: TaskBar[] = useMemo(() => {
    if (!tasks) return [];
    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      startDate: (task as any).startDate ? new Date((task as any).startDate) : null,
      endDate: task.dueDate ? new Date(task.dueDate) : null,
      color: STATUS_COLORS[task.status] || STATUS_COLORS.INCOMPLETE,
    }));
  }, [tasks]);

  // For each day, find tasks that are visible on that day
  const getTasksForDate = (date: Date): TaskBar[] => {
    return taskBars.filter((task) => {
      if (!task.endDate && !task.startDate) return false;
      const start = task.startDate || task.endDate!;
      const end = task.endDate || task.startDate!;
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      return start < dayEnd && end >= dayStart;
    });
  };

  // Check if this day is the start of a task's span (or the first visible day)
  const isSpanStart = (task: TaskBar, date: Date, dayIndex: number): boolean => {
    const start = task.startDate || task.endDate!;
    if (sameDay(start, date)) return true;
    // Also start at beginning of each week row
    if (dayIndex % 7 === 0) {
      const prev = new Date(date);
      prev.setDate(prev.getDate() - 1);
      const s = task.startDate || task.endDate!;
      const e = task.endDate || task.startDate!;
      return s <= prev && e >= date;
    }
    return false;
  };

  // Calculate span length from this day
  const getSpanLength = (task: TaskBar, date: Date, dayIndex: number): number => {
    const end = task.endDate || task.startDate!;
    const endOfWeekRow = 7 - (dayIndex % 7);
    let span = 1;
    const d = new Date(date);
    while (span < endOfWeekRow) {
      d.setDate(d.getDate() + 1);
      if (d > end) break;
      span++;
    }
    return span;
  };

  const today = new Date();
  const isToday = (date: Date) => sameDay(date, today);

  const monthName = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const handleDrop = (date: Date) => {
    if (!dragTaskId) return;
    const task = taskBars.find((t) => t.id === dragTaskId);
    if (!task) return;

    // Calculate the offset if task has both start and end
    const newDueDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);

    if (task.startDate && task.endDate) {
      const duration = task.endDate.getTime() - task.startDate.getTime();
      const newStart = new Date(newDueDate.getTime() - duration);
      updateTask.mutate({
        id: dragTaskId,
        dueDate: newDueDate.toISOString(),
        startDate: newStart.toISOString(),
      } as any);
    } else {
      updateTask.mutate({
        id: dragTaskId,
        dueDate: newDueDate.toISOString(),
      });
    }
    setDragTaskId(null);
  };

  if (isLoading) {
    return (
      <div className="px-6 py-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-7 w-7 animate-pulse rounded bg-muted" />
          <div className="h-5 w-36 animate-pulse rounded bg-muted" />
          <div className="h-7 w-7 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid grid-cols-7 gap-px rounded-lg border bg-gray-200">
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className="min-h-[80px] bg-white p-2">
              <div className="mb-1 h-3 w-4 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Month Navigation */}
      <div className="flex items-center gap-4 border-b bg-white px-6 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-sm font-semibold text-[#1e1f21]">{monthName}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => setCurrentDate(new Date())}
        >
          Today
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-1 grid grid-cols-7 gap-px">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px rounded-lg border bg-gray-200">
          {calendarDays.map((day, i) => {
            const dayTasks = getTasksForDate(day.date);

            return (
              <div
                key={i}
                className={cn(
                  "min-h-[100px] bg-white p-1.5 relative",
                  !day.isCurrentMonth && "bg-gray-50"
                )}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  // Support both old dataTransfer and new state-based drag
                  const taskId = e.dataTransfer.getData("taskId") || dragTaskId;
                  if (taskId) {
                    handleDrop(day.date);
                  }
                }}
              >
                <div
                  className={cn(
                    "mb-1 text-right text-xs",
                    !day.isCurrentMonth
                      ? "text-muted-foreground/50"
                      : "text-muted-foreground",
                    isToday(day.date) &&
                      "inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#4573D2] text-white float-right"
                  )}
                >
                  {day.date.getDate()}
                </div>

                <div className="space-y-0.5 clear-both group/cell">
                  {addingDate === dateKey(day.date) ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (newTaskTitle.trim()) {
                          createTask.mutate({
                            title: newTaskTitle.trim(),
                            projectId,
                            dueDate: new Date(addingDate).toISOString(),
                          });
                        }
                      }}
                      className="mb-1"
                    >
                      <Input
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="Task name..."
                        className="h-6 text-[11px]"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setAddingDate(null);
                            setNewTaskTitle("");
                          }
                        }}
                        onBlur={() => {
                          if (!newTaskTitle.trim()) {
                            setAddingDate(null);
                            setNewTaskTitle("");
                          }
                        }}
                      />
                    </form>
                  ) : (
                    <button
                      className="mb-1 hidden w-full items-center justify-center rounded text-[10px] text-muted-foreground hover:bg-muted/50 group-hover/cell:flex"
                      onClick={() => setAddingDate(dateKey(day.date))}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                  {dayTasks.slice(0, 4).map((task) => {
                    const spanStart = isSpanStart(task, day.date, i);
                    if (!spanStart) return null; // Already rendered as part of a span

                    const hasMultiDay = task.startDate && task.endDate && !sameDay(task.startDate, task.endDate);
                    const spanLen = hasMultiDay ? getSpanLength(task, day.date, i) : 1;

                    return (
                      <button
                        key={task.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("taskId", task.id);
                          setDragTaskId(task.id);
                        }}
                        onDragEnd={() => setDragTaskId(null)}
                        onClick={() => onTaskClick(task.id)}
                        className={cn(
                          "flex items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] transition-colors border",
                          task.color,
                          "hover:opacity-80",
                          task.status === "COMPLETE" && "line-through opacity-60"
                        )}
                        style={
                          hasMultiDay && spanLen > 1
                            ? {
                                width: `calc(${spanLen * 100}% + ${(spanLen - 1) * 1}px)`,
                                position: "relative" as const,
                                zIndex: 10,
                              }
                            : { width: "100%" }
                        }
                      >
                        {task.status === "COMPLETE" ? (
                          <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                        ) : (
                          <Circle className="h-3 w-3 flex-shrink-0" />
                        )}
                        <span className="truncate">{task.title}</span>
                      </button>
                    );
                  })}
                  {dayTasks.length > 4 && (
                    <p className="px-1 text-[10px] text-muted-foreground">
                      +{dayTasks.length - 4} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
