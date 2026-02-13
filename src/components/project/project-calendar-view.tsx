"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

export function ProjectCalendarView({
  projectId,
  onTaskClick,
}: ProjectCalendarViewProps) {
  const { data: tasks } = trpc.tasks.list.useQuery({ projectId });
  const utils = trpc.useUtils();
  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => utils.tasks.list.invalidate({ projectId }),
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");

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

    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    // Next month padding (fill to 42 cells = 6 weeks)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  const getTasksForDate = (date: Date) => {
    if (!tasks) return [];
    return tasks.filter((task) => {
      if (!task.dueDate) return false;
      const d = new Date(task.dueDate);
      return (
        d.getFullYear() === date.getFullYear() &&
        d.getMonth() === date.getMonth() &&
        d.getDate() === date.getDate()
      );
    });
  };

  const today = new Date();
  const isToday = (date: Date) =>
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const monthName = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex h-full flex-col">
      {/* Month Navigation */}
      <div className="flex items-center gap-4 border-b bg-white px-6 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() =>
            setCurrentDate(new Date(year, month - 1, 1))
          }
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-sm font-semibold text-[#1e1f21]">{monthName}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() =>
            setCurrentDate(new Date(year, month + 1, 1))
          }
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
        {/* Day Headers */}
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

        {/* Calendar Cells */}
        <div className="grid grid-cols-7 gap-px rounded-lg border bg-gray-200">
          {calendarDays.map((day, i) => {
            const dayTasks = getTasksForDate(day.date);

            return (
              <div
                key={i}
                className={cn(
                  "min-h-[100px] bg-white p-1.5",
                  !day.isCurrentMonth && "bg-gray-50"
                )}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData("taskId");
                  if (taskId) {
                    updateTask.mutate({
                      id: taskId,
                      dueDate: new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate(), 12).toISOString(),
                    });
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
                  {addingDate === day.date.toISOString().split("T")[0] ? (
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
                      onClick={() => setAddingDate(day.date.toISOString().split("T")[0])}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                  {dayTasks.slice(0, 3).map((task) => (
                    <button
                      key={task.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("taskId", task.id)}
                      onClick={() => onTaskClick(task.id)}
                      className={cn(
                        "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] transition-colors hover:bg-muted/50",
                        task.status === "COMPLETE"
                          ? "text-muted-foreground line-through"
                          : "text-[#1e1f21]"
                      )}
                    >
                      {task.status === "COMPLETE" ? (
                        <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-green-600" />
                      ) : (
                        <Circle className="h-3 w-3 flex-shrink-0 text-[#cfcbcb]" />
                      )}
                      <span className="truncate">{task.title}</span>
                    </button>
                  ))}
                  {dayTasks.length > 3 && (
                    <p className="px-1 text-[10px] text-muted-foreground">
                      +{dayTasks.length - 3} more
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
