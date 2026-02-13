"use client";

import { useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle2, Circle, ChevronLeft, ChevronRight, Diamond } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProjectTimelineViewProps {
  projectId: string;
  onTaskClick: (taskId: string) => void;
}

export function ProjectTimelineView({
  projectId,
  onTaskClick,
}: ProjectTimelineViewProps) {
  const { data: sections } = trpc.sections.list.useQuery({ projectId });
  const { data: tasks } = trpc.tasks.list.useQuery({ projectId });
  const scrollRef = useRef<HTMLDivElement>(null);

  const [weeksOffset, setWeeksOffset] = useState(0);

  // Generate date range: 12 weeks centered around today
  const dateRange = useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(
      today.getDate() - today.getDay() + weeksOffset * 7 - 14
    );
    startOfWeek.setHours(0, 0, 0, 0);

    const days: Date[] = [];
    for (let i = 0; i < 84; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weeksOffset]);

  const weeks = useMemo(() => {
    const result: { weekStart: Date; days: Date[] }[] = [];
    for (let i = 0; i < dateRange.length; i += 7) {
      result.push({
        weekStart: dateRange[i],
        days: dateRange.slice(i, i + 7),
      });
    }
    return result;
  }, [dateRange]);

  const dayWidth = 36;
  const rowHeight = 36;
  const headerHeight = 56;
  const sidebarWidth = 260;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getTasksForSection = (sectionId: string) => {
    if (!tasks) return [];
    return tasks.filter((task) =>
      task.taskProjects?.some((tp) => tp.sectionId === sectionId)
    );
  };

  const getBarPosition = (
    startDate: Date | string | null,
    dueDate: Date | string | null
  ) => {
    const start = startDate ? new Date(startDate) : null;
    const end = dueDate ? new Date(dueDate) : null;

    if (!start && !end) return null;

    const effectiveStart = start || end!;
    const effectiveEnd = end || start!;

    const rangeStart = dateRange[0];
    const startDiff = Math.floor(
      (effectiveStart.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const endDiff = Math.floor(
      (effectiveEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)
    );

    const duration = Math.max(1, endDiff - startDiff + 1);

    return {
      left: startDiff * dayWidth,
      width: duration * dayWidth,
    };
  };

  const todayOffset = Math.floor(
    (today.getTime() - dateRange[0].getTime()) / (1000 * 60 * 60 * 24)
  );

  type TaskItem = NonNullable<typeof tasks>[number];

  // Build flat list of rows (sections + tasks)
  const rows: {
    type: "section" | "task";
    id: string;
    name: string;
    task?: TaskItem;
  }[] = [];

  sections?.forEach((section) => {
    rows.push({ type: "section", id: section.id, name: section.name });
    getTasksForSection(section.id).forEach((task) => {
      rows.push({
        type: "task",
        id: task.id,
        name: task.title,
        task,
      });
    });
  });

  return (
    <div className="flex h-full flex-col">
      {/* Navigation */}
      <div className="flex items-center gap-2 border-b bg-white px-4 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setWeeksOffset((p) => p - 4)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => setWeeksOffset(0)}
        >
          Today
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setWeeksOffset((p) => p + 4)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - task names */}
        <div
          className="flex-shrink-0 border-r bg-white"
          style={{ width: sidebarWidth }}
        >
          <div
            className="border-b bg-gray-50 px-4 text-xs font-medium text-muted-foreground"
            style={{ height: headerHeight, lineHeight: `${headerHeight}px` }}
          >
            Task name
          </div>
          <div className="overflow-y-auto">
            {rows.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "flex items-center border-b px-4",
                  row.type === "section" && "bg-gray-50 font-semibold"
                )}
                style={{ height: rowHeight }}
              >
                {row.type === "task" && (
                  <>
                    {row.task?.status === "COMPLETE" ? (
                      <CheckCircle2 className="mr-2 h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                    ) : (
                      <Circle className="mr-2 h-3.5 w-3.5 flex-shrink-0 text-[#cfcbcb]" />
                    )}
                  </>
                )}
                <span
                  className={cn(
                    "truncate text-sm",
                    row.type === "section"
                      ? "text-[#1e1f21]"
                      : "cursor-pointer text-[#1e1f21] hover:text-[#4573D2]",
                    row.task?.status === "COMPLETE" &&
                      "text-muted-foreground line-through"
                  )}
                  onClick={() => {
                    if (row.type === "task") onTaskClick(row.id);
                  }}
                >
                  {row.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right side - timeline grid */}
        <div className="flex-1 overflow-auto" ref={scrollRef}>
          <div
            style={{
              width: dateRange.length * dayWidth,
              minHeight: "100%",
            }}
          >
            {/* Week/Day Headers */}
            <div
              className="sticky top-0 z-10 border-b bg-gray-50"
              style={{ height: headerHeight }}
            >
              {/* Weeks row */}
              <div className="flex" style={{ height: headerHeight / 2 }}>
                {weeks.map((week, i) => (
                  <div
                    key={i}
                    className="border-r text-center text-xs font-medium text-muted-foreground"
                    style={{
                      width: 7 * dayWidth,
                      lineHeight: `${headerHeight / 2}px`,
                    }}
                  >
                    {week.weekStart.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                ))}
              </div>
              {/* Days row */}
              <div className="flex" style={{ height: headerHeight / 2 }}>
                {dateRange.map((day, i) => (
                  <div
                    key={i}
                    className={cn(
                      "border-r text-center text-[10px] text-muted-foreground",
                      day.getDay() === 0 || day.getDay() === 6
                        ? "bg-gray-100"
                        : ""
                    )}
                    style={{
                      width: dayWidth,
                      lineHeight: `${headerHeight / 2}px`,
                    }}
                  >
                    {["S", "M", "T", "W", "T", "F", "S"][day.getDay()]}
                  </div>
                ))}
              </div>
            </div>

            {/* Rows with bars */}
            <div className="relative">
              {/* Today line */}
              {todayOffset >= 0 && todayOffset < dateRange.length && (
                <div
                  className="absolute top-0 z-20 w-0.5 bg-red-500"
                  style={{
                    left: todayOffset * dayWidth + dayWidth / 2,
                    height: rows.length * rowHeight,
                  }}
                />
              )}

              {/* Grid lines */}
              {dateRange.map((day, i) => (
                <div
                  key={i}
                  className={cn(
                    "absolute top-0 border-r border-gray-100",
                    (day.getDay() === 0 || day.getDay() === 6) &&
                      "bg-gray-50/50"
                  )}
                  style={{
                    left: i * dayWidth,
                    width: dayWidth,
                    height: rows.length * rowHeight,
                  }}
                />
              ))}

              {rows.map((row, rowIndex) => (
                <div
                  key={row.id}
                  className={cn(
                    "relative border-b",
                    row.type === "section" && "bg-gray-50/50"
                  )}
                  style={{ height: rowHeight }}
                >
                  {row.type === "task" && row.task && (() => {
                    const bar = getBarPosition(
                      row.task.startDate,
                      row.task.dueDate
                    );
                    if (!bar) return null;

                    const isMilestone = (row.task as any).isMilestone;
                    const sectionColor =
                      sections?.find((s) =>
                        row.task!.taskProjects?.some(
                          (tp) => tp.sectionId === s.id
                        )
                      )
                        ? "#4573D2"
                        : "#9CA3AF";

                    if (isMilestone) {
                      return (
                        <div
                          className="absolute flex cursor-pointer items-center justify-center"
                          style={{
                            left: bar.left + bar.width / 2 - 10,
                            top: 4,
                            width: 20,
                            height: rowHeight - 8,
                          }}
                          onClick={() => onTaskClick(row.id)}
                          title={row.name}
                        >
                          <Diamond
                            className="h-5 w-5"
                            style={{
                              color: row.task.status === "COMPLETE" ? "#16a34a" : "#9333ea",
                              fill: row.task.status === "COMPLETE" ? "#16a34a" : "#9333ea",
                            }}
                          />
                        </div>
                      );
                    }

                    return (
                      <div
                        className="absolute cursor-pointer rounded-sm transition-opacity hover:opacity-80"
                        style={{
                          left: bar.left,
                          width: Math.max(bar.width, dayWidth),
                          top: 6,
                          height: rowHeight - 12,
                          backgroundColor:
                            row.task.status === "COMPLETE"
                              ? "#86EFAC"
                              : sectionColor,
                        }}
                        onClick={() => onTaskClick(row.id)}
                      >
                        <span className="truncate px-2 text-xs font-medium leading-6 text-white">
                          {row.name}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
