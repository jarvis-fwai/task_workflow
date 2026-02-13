"use client";

import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Loader2,
  Plus,
  ChevronUp,
} from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  ON_TRACK: { label: "On Track", color: "text-green-700", bg: "bg-green-100" },
  AT_RISK: { label: "At Risk", color: "text-yellow-700", bg: "bg-yellow-100" },
  OFF_TRACK: { label: "Off Track", color: "text-red-700", bg: "bg-red-100" },
  ON_HOLD: { label: "On Hold", color: "text-blue-700", bg: "bg-blue-100" },
  COMPLETE: { label: "Complete", color: "text-purple-700", bg: "bg-purple-100" },
};

interface ProjectOverviewProps {
  projectId: string;
}

export function ProjectOverview({ projectId }: ProjectOverviewProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const now = useMemo(() => (mounted ? new Date() : null), [mounted]);

  const { data: project } = trpc.projects.get.useQuery({ id: projectId });
  const { data: tasks } = trpc.tasks.list.useQuery({ projectId });
  const { data: statusUpdates } = trpc.projects.statusUpdates.useQuery({
    projectId,
  });
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [showCreateUpdate, setShowCreateUpdate] = useState(false);
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateBody, setUpdateBody] = useState("");
  const [updateStatus, setUpdateStatus] = useState<string>("ON_TRACK");

  const utils = trpc.useUtils();

  const generateStatus = trpc.ai.generateProjectStatus.useMutation({
    onSuccess: (data) => setAiStatus(data.status),
  });

  const createStatusUpdate = trpc.projects.createStatusUpdate.useMutation({
    onSuccess: () => {
      utils.projects.statusUpdates.invalidate({ projectId });
      setShowCreateUpdate(false);
      setUpdateTitle("");
      setUpdateBody("");
      setUpdateStatus("ON_TRACK");
    },
  });

  const totalTasks = tasks?.length || 0;
  const completedTasks = tasks?.filter((t) => t.status === "COMPLETE").length || 0;
  const incompleteTasks = totalTasks - completedTasks;
  const overdueTasks = now
    ? tasks?.filter(
        (t) =>
          t.status === "INCOMPLETE" &&
          t.dueDate &&
          new Date(t.dueDate) < now
      ).length || 0
    : 0;
  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Project Brief */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Project brief</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {project?.description
                ? typeof project.description === "string"
                  ? project.description
                  : "Project description"
                : "Add a project brief to help your team understand the goals and context of this project."}
            </p>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-semibold text-[#1e1f21]">
                {totalTasks}
              </p>
              <p className="text-xs text-muted-foreground">Total tasks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-semibold text-green-600">
                {completedTasks}
              </p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-semibold text-[#4573D2]">
                {incompleteTasks}
              </p>
              <p className="text-xs text-muted-foreground">In progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-semibold text-red-600">
                {overdueTasks}
              </p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-[#1e1f21]">
                Progress
              </span>
              <span className="text-sm font-medium text-[#1e1f21]">
                {completionRate}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100">
              <div
                className="h-2.5 rounded-full bg-green-500 transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {completedTasks} of {totalTasks} tasks complete
            </p>
          </CardContent>
        </Card>

        {/* Section Breakdown */}
        {project?.sections && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Section breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {project.sections.map((section) => {
                  const sectionTasks =
                    tasks?.filter((t) =>
                      t.taskProjects?.some(
                        (tp) => tp.sectionId === section.id
                      )
                    ) || [];
                  const sectionComplete = sectionTasks.filter(
                    (t) => t.status === "COMPLETE"
                  ).length;
                  const sectionPercent =
                    sectionTasks.length > 0
                      ? Math.round(
                          (sectionComplete / sectionTasks.length) * 100
                        )
                      : 0;

                  return (
                    <div key={section.id}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm text-[#1e1f21]">
                          {section.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {sectionComplete}/{sectionTasks.length}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100">
                        <div
                          className="h-1.5 rounded-full bg-[#4573D2] transition-all"
                          style={{ width: `${sectionPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Updates */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Status updates</CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setShowCreateUpdate(!showCreateUpdate)}
              >
                {showCreateUpdate ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {showCreateUpdate ? "Cancel" : "New update"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showCreateUpdate && (
              <div className="mb-6 space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="flex gap-3">
                  <Select
                    value={updateStatus}
                    onValueChange={setUpdateStatus}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          <span className={cfg.color}>{cfg.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Status title..."
                    value={updateTitle}
                    onChange={(e) => setUpdateTitle(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <Textarea
                  placeholder="What's the latest on this project?"
                  value={updateBody}
                  onChange={(e) => setUpdateBody(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="bg-[#4573D2] hover:bg-[#3A63B8]"
                    disabled={
                      !updateTitle.trim() ||
                      !updateBody.trim() ||
                      createStatusUpdate.isPending
                    }
                    onClick={() =>
                      createStatusUpdate.mutate({
                        projectId,
                        status: updateStatus as any,
                        title: updateTitle.trim(),
                        body: updateBody.trim(),
                      })
                    }
                  >
                    {createStatusUpdate.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Post update
                  </Button>
                </div>
              </div>
            )}

            {statusUpdates && statusUpdates.length > 0 ? (
              <div className="space-y-4">
                {statusUpdates.map((update) => {
                  const cfg = STATUS_CONFIG[update.status] || STATUS_CONFIG.ON_TRACK;
                  return (
                    <div key={update.id} className="border-b pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        <Avatar className="mt-0.5 h-7 w-7">
                          <AvatarFallback className="bg-[#4573D2] text-[10px] text-white">
                            {update.author?.name
                              ?.split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {update.author?.name}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.color}`}
                            >
                              {cfg.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(update.createdAt).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric" }
                              )}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm font-medium text-[#1e1f21]">
                            {update.title}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {typeof update.body === "string"
                              ? update.body
                              : JSON.stringify(update.body)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No status updates yet. Post an update to keep your team informed.
              </p>
            )}
          </CardContent>
        </Card>

        {/* AI Status Update */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-[#4573D2]" />
                AI Status Update
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() =>
                  generateStatus.mutate({ projectId })
                }
                disabled={generateStatus.isPending}
              >
                {generateStatus.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {generateStatus.isPending
                  ? "Generating..."
                  : aiStatus
                  ? "Regenerate"
                  : "Generate status"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {aiStatus ? (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-[#1e1f21]">
                {aiStatus}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Click &ldquo;Generate status&rdquo; to get an AI-powered analysis of
                your project&apos;s current state, key highlights, and suggested
                next steps.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Milestones */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const milestones = tasks?.filter((t) => t.isMilestone) || [];
              if (milestones.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground">
                    No milestones set. Mark tasks as milestones to track key deliverables.
                  </p>
                );
              }
              return (
                <div className="space-y-2">
                  {milestones.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <span className={m.status === "COMPLETE" ? "text-green-600" : "text-purple-500"}>◆</span>
                      <div className="flex-1">
                        <span className={`text-sm font-medium ${m.status === "COMPLETE" ? "text-muted-foreground line-through" : ""}`}>
                          {m.title}
                        </span>
                      </div>
                      {m.dueDate && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(m.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${m.status === "COMPLETE" ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"}`}>
                        {m.status === "COMPLETE" ? "Done" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
