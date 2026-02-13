"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Users, Settings2, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type DateRange = "this_week" | "next_week" | "this_month";

export function WorkloadContent() {
  const { data: workspaces } = trpc.workspaces.list.useQuery();
  const workspaceId = workspaces?.[0]?.id;
  const [dateRange, setDateRange] = useState<DateRange>("this_week");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [dragTask, setDragTask] = useState<{ taskId: string; fromUserId: string } | null>(null);

  const { data: workloadResult } = trpc.workload.getTeamWorkload.useQuery(
    { workspaceId: workspaceId!, dateRange },
    { enabled: !!workspaceId }
  );

  const workloadData = workloadResult?.workloads as Array<any> | undefined;
  const utils = trpc.useUtils();

  const setCapacity = trpc.workload.setCapacity.useMutation({
    onSuccess: () => {
      utils.workload.getTeamWorkload.invalidate();
      toast.success("Capacity updated");
    },
  });

  const reassignTask = trpc.workload.reassignTask.useMutation({
    onSuccess: () => {
      utils.workload.getTeamWorkload.invalidate();
      toast.success("Task reassigned");
    },
    onError: () => toast.error("Failed to reassign task"),
  });

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [capacityInput, setCapacityInput] = useState("");

  const getUtilizationColor = (pct: number) => {
    if (pct > 100) return "bg-red-500";
    if (pct > 80) return "bg-yellow-500";
    return "bg-[#4573D2]";
  };

  const getUtilizationLabel = (pct: number) => {
    if (pct > 100) return "Over capacity";
    if (pct > 80) return "Near capacity";
    if (pct > 0) return "Available";
    return "No tasks";
  };

  const handleDrop = (targetUserId: string) => {
    if (dragTask && dragTask.fromUserId !== targetUserId) {
      reassignTask.mutate({ taskId: dragTask.taskId, newAssigneeId: targetUserId });
    }
    setDragTask(null);
  };

  const dateRangeLabel = dateRange === "this_week" ? "This week" : dateRange === "next_week" ? "Next week" : "This month";

  return (
    <div className="h-full">
      <div className="flex h-14 items-center justify-between border-b bg-white px-6 dark:bg-card">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[#4573D2]" />
          <h1 className="text-lg font-medium text-[#1e1f21] dark:text-foreground">Workload</h1>
        </div>
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_week">This week</SelectItem>
            <SelectItem value="next_week">Next week</SelectItem>
            <SelectItem value="this_month">This month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="p-6">
        <p className="mb-6 text-sm text-muted-foreground">
          View team capacity and task allocation · {dateRangeLabel}
          {workloadResult?.startDate && (
            <span className="ml-1 text-xs">
              ({new Date(workloadResult.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {new Date(workloadResult.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })})
            </span>
          )}
        </p>

        <div className="space-y-3">
          {workloadData?.map((member) => {
            const utilization = member.utilization;
            const isExpanded = expandedUser === member.user.id;
            const isOverCapacity = utilization > 100;

            return (
              <div
                key={member.user.id}
                className={cn(
                  "rounded-lg border bg-white dark:bg-card transition-all",
                  dragTask && dragTask.fromUserId !== member.user.id && "ring-2 ring-dashed ring-blue-200",
                  isOverCapacity && "border-red-200"
                )}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("bg-blue-50"); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove("bg-blue-50"); }}
                onDrop={(e) => { e.currentTarget.classList.remove("bg-blue-50"); handleDrop(member.user.id); }}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setExpandedUser(isExpanded ? null : member.user.id)}>
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </button>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-[#4573D2] text-xs text-white">
                          {member.user.name?.split(" ").map((n: string) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{member.user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.taskCount} task{member.taskCount !== 1 ? "s" : ""} · {member.totalEstimatedHours}h allocated
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium text-white",
                        getUtilizationColor(utilization)
                      )}>
                        {getUtilizationLabel(utilization)}
                      </span>

                      <Popover
                        open={editingUserId === member.user.id}
                        onOpenChange={(open) => {
                          if (open) { setEditingUserId(member.user.id); setCapacityInput(String(member.weeklyCapacity)); }
                          else setEditingUserId(null);
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Settings2 className="h-3.5 w-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-3" align="end">
                          <p className="mb-2 text-xs font-medium">Weekly capacity (hours)</p>
                          <Input type="number" value={capacityInput} onChange={(e) => setCapacityInput(e.target.value)} className="h-8 text-sm" min={0} max={168} />
                          <Button size="sm" className="mt-2 w-full" onClick={() => {
                            const hours = parseFloat(capacityInput);
                            if (!isNaN(hours) && hours >= 0) {
                              setCapacity.mutate({ userId: member.user.id, workspaceId: workspaceId!, weeklyHours: hours });
                              setEditingUserId(null);
                            }
                          }}>
                            Save
                          </Button>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Stacked horizontal bar by project */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{member.totalEstimatedHours}h / {member.weeklyCapacity}h</span>
                      <span className={cn(isOverCapacity && "font-medium text-red-500")}>{utilization}%</span>
                    </div>
                    <div className="relative mt-1 h-6 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      {/* Capacity line */}
                      <div className="absolute top-0 bottom-0 z-10 w-px bg-gray-400" style={{ left: `${Math.min(100, 100)}%` }} />
                      {/* Project segments */}
                      {member.tasksByProject && (() => {
                        let offset = 0;
                        const maxWidth = member.weeklyCapacity > 0 ? member.weeklyCapacity : member.totalEstimatedHours || 1;
                        return member.tasksByProject.map((group: any, i: number) => {
                          const w = (group.hours / maxWidth) * 100;
                          const left = offset;
                          offset += w;
                          return (
                            <div
                              key={i}
                              className="absolute top-0.5 h-5 rounded-sm"
                              style={{
                                left: `${left}%`,
                                width: `${Math.max(w, 1)}%`,
                                backgroundColor: group.color,
                                opacity: offset > 100 ? 0.9 : 0.8,
                              }}
                              title={`${group.projectName}: ${group.hours}h`}
                            />
                          );
                        });
                      })()}
                      {/* Over-capacity red overlay */}
                      {isOverCapacity && (
                        <div
                          className="absolute top-0 h-full bg-red-500/20"
                          style={{ left: "100%", width: `${utilization - 100}%` }}
                        />
                      )}
                    </div>
                    {/* Legend */}
                    {member.tasksByProject && member.tasksByProject.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-3">
                        {member.tasksByProject.map((group: any, i: number) => (
                          <div key={i} className="flex items-center gap-1">
                            <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: group.color }} />
                            <span className="text-[10px] text-muted-foreground">{group.projectName} ({group.hours}h)</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded task list */}
                {isExpanded && member.tasks.length > 0 && (
                  <div className="border-t">
                    <div className="divide-y">
                      {member.tasks.map((task: any) => {
                        const project = task.taskProjects?.[0]?.project;
                        return (
                          <div
                            key={task.id}
                            className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted/30 cursor-grab"
                            draggable
                            onDragStart={() => setDragTask({ taskId: task.id, fromUserId: member.user.id })}
                            onDragEnd={() => setDragTask(null)}
                          >
                            <GripVertical className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" />
                            {project && <div className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: project.color }} />}
                            <span className="flex-1 truncate">{task.title}</span>
                            <span className="text-xs text-muted-foreground">{task.estimatedHours ?? 1}h</span>
                            {task.dueDate && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {(!workloadData || workloadData.length === 0) && (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No team members found. Add members to your workspace to see workload data.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
