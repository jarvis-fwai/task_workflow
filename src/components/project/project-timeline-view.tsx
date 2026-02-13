"use client";

import { useMemo, useRef, useState, useCallback } from "react";
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
  const { data: sections, isLoading: sl } = trpc.sections.list.useQuery({ projectId });
  const { data: tasks, isLoading: tl } = trpc.tasks.list.useQuery({ projectId });
  const scrollRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const [weeksOffset, setWeeksOffset] = useState(0);
  const [hoveredDep, setHoveredDep] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{
    taskId: string;
    edge: "start" | "end";
    initialX: number;
    initialDate: Date;
  } | null>(null);

  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => utils.tasks.list.invalidate({ projectId }),
  });

  // Fetch dependency data for all tasks
  const taskIds = tasks?.map((t) => t.id) ?? [];
  const dependencyQueries = trpc.useQueries((t) =>
    taskIds.map((id) => t.tasks.get({ id }))
  );

  // Build dependency map: taskId -> dependsOnTaskIds[]
  const dependencyMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    dependencyQueries.forEach((q) => {
      if (q.data) {
        const deps = (q.data as any).dependsOn;
        if (deps && Array.isArray(deps)) {
          map[q.data.id] = deps.map((d: any) => d.dependsOnTaskId);
        }
      }
    });
    return map;
  }, [dependencyQueries]);

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

  // Build row index map for dependency arrows
  const rowIndexMap = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach((row, i) => {
      if (row.type === "task") map[row.id] = i;
    });
    return map;
  }, [rows]);

  // Generate dependency arrows
  const arrows = useMemo(() => {
    const result: {
      id: string;
      fromTaskId: string;
      toTaskId: string;
      path: string;
    }[] = [];

    for (const [taskId, deps] of Object.entries(dependencyMap)) {
      for (const depId of deps) {
        const fromRow = rowIndexMap[depId];
        const toRow = rowIndexMap[taskId];
        if (fromRow === undefined || toRow === undefined) continue;

        const fromTask = rows[fromRow]?.task;
        const toTask = rows[toRow]?.task;
        if (!fromTask || !toTask) continue;

        const fromBar = getBarPosition(fromTask.startDate, fromTask.dueDate);
        const toBar = getBarPosition(toTask.startDate, toTask.dueDate);
        if (!fromBar || !toBar) continue;

        // Arrow from end of blocking task to start of blocked task
        const fromX = fromBar.left + fromBar.width;
        const fromY = fromRow * rowHeight + rowHeight / 2;
        const toX = toBar.left;
        const toY = toRow * rowHeight + rowHeight / 2;

        // Bezier curve
        const midX = (fromX + toX) / 2;
        const path = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;

        result.push({
          id: `${depId}-${taskId}`,
          fromTaskId: depId,
          toTaskId: taskId,
          path,
        });
      }
    }

    return result;
  }, [dependencyMap, rowIndexMap, rows, dateRange]);

  // Drag handle logic
  const handleDragStart = useCallback(
    (taskId: string, edge: "start" | "end", e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const task = tasks?.find((t) => t.id === taskId);
      if (!task) return;

      const initialDate =
        edge === "start"
          ? new Date(task.startDate || task.dueDate || new Date())
          : new Date(task.dueDate || task.startDate || new Date());

      setDragging({ taskId, edge, initialX: e.clientX, initialDate });

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - e.clientX;
        const daysDelta = Math.round(dx / dayWidth);
        const newDate = new Date(initialDate);
        newDate.setDate(newDate.getDate() + daysDelta);
        // We'll apply on mouseup
      };

      const handleMouseUp = (ev: MouseEvent) => {
        const dx = ev.clientX - e.clientX;
        const daysDelta = Math.round(dx / dayWidth);
        if (daysDelta !== 0) {
          const newDate = new Date(initialDate);
          newDate.setDate(newDate.getDate() + daysDelta);
          const isoDate = newDate.toISOString();

          if (edge === "start") {
            updateTask.mutate({ id: taskId, startDate: isoDate });
          } else {
            updateTask.mutate({ id: taskId, dueDate: isoDate });
          }
        }
        setDragging(null);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [tasks, dayWidth, updateTask]
  );

  if (sl || tl) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-6 animate-pulse rounded bg-muted" style={{ width: `${80 + Math.random() * 200}px` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

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

              {/* Dependency Arrows SVG */}
              <svg
                className="pointer-events-none absolute inset-0 z-10"
                style={{
                  width: dateRange.length * dayWidth,
                  height: rows.length * rowHeight,
                }}
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#9CA3AF" />
                  </marker>
                  <marker
                    id="arrowhead-hover"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#4573D2" />
                  </marker>
                </defs>
                {arrows.map((arrow) => (
                  <path
                    key={arrow.id}
                    d={arrow.path}
                    fill="none"
                    stroke={hoveredDep === arrow.id ? "#4573D2" : "#9CA3AF"}
                    strokeWidth={hoveredDep === arrow.id ? 2 : 1.5}
                    markerEnd={
                      hoveredDep === arrow.id
                        ? "url(#arrowhead-hover)"
                        : "url(#arrowhead)"
                    }
                    className="pointer-events-auto cursor-pointer transition-colors"
                    onMouseEnter={() => setHoveredDep(arrow.id)}
                    onMouseLeave={() => setHoveredDep(null)}
                  />
                ))}
              </svg>

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
                        className="group/bar absolute cursor-pointer rounded-sm transition-opacity hover:opacity-80"
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
                        {/* Left drag handle (start date) */}
                        <div
                          className="absolute left-0 top-0 z-30 h-full w-2 cursor-col-resize rounded-l-sm bg-black/0 hover:bg-black/20 opacity-0 group-hover/bar:opacity-100 transition-opacity"
                          onMouseDown={(e) => handleDragStart(row.id, "start", e)}
                          onClick={(e) => e.stopPropagation()}
                        />

                        <span className="truncate px-3 text-xs font-medium leading-6 text-white">
                          {row.name}
                        </span>

                        {/* Right drag handle (end date) */}
                        <div
                          className="absolute right-0 top-0 z-30 h-full w-2 cursor-col-resize rounded-r-sm bg-black/0 hover:bg-black/20 opacity-0 group-hover/bar:opacity-100 transition-opacity"
                          onMouseDown={(e) => handleDragStart(row.id, "end", e)}
                          onClick={(e) => e.stopPropagation()}
                        />
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
