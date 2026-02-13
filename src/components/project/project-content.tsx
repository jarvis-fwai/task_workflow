"use client";

import { useState, useEffect, useRef } from "react";
import { usePresence } from "@/hooks/use-presence";
import dynamic from "next/dynamic";
import { trpc } from "@/lib/trpc";
import { ProjectHeader } from "./project-header";
import { ProjectListView } from "./project-list-view";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { BulkSelectionProvider } from "@/contexts/bulk-selection-context";

// Lazy-load heavy view components
const ProjectBoardView = dynamic(
  () => import("./project-board-view").then((m) => ({ default: m.ProjectBoardView })),
  { loading: () => <ViewLoadingFallback /> }
);

const ProjectTimelineView = dynamic(
  () => import("./project-timeline-view").then((m) => ({ default: m.ProjectTimelineView })),
  { loading: () => <ViewLoadingFallback /> }
);

const ProjectCalendarView = dynamic(
  () => import("./project-calendar-view").then((m) => ({ default: m.ProjectCalendarView })),
  { loading: () => <ViewLoadingFallback /> }
);

const ProjectOverview = dynamic(
  () => import("./project-overview").then((m) => ({ default: m.ProjectOverview })),
  { loading: () => <ViewLoadingFallback /> }
);

const ProjectFilesView = dynamic(
  () => import("./project-files-view").then((m) => ({ default: m.ProjectFilesView })),
  { loading: () => <ViewLoadingFallback /> }
);

const ProjectMessagesView = dynamic(
  () => import("./project-messages-view").then((m) => ({ default: m.ProjectMessagesView })),
  { loading: () => <ViewLoadingFallback /> }
);

const ProjectDashboardView = dynamic(
  () => import("./project-dashboard-view").then((m) => ({ default: m.ProjectDashboardView })),
  { loading: () => <ViewLoadingFallback /> }
);

const ProjectWorkflowView = dynamic(
  () => import("./project-workflow-view").then((m) => ({ default: m.ProjectWorkflowView })),
  { loading: () => <ViewLoadingFallback /> }
);

const TaskDetailPanel = dynamic(
  () => import("../task/task-detail-panel").then((m) => ({ default: m.TaskDetailPanel })),
  {
    loading: () => (
      <div className="flex w-[480px] items-center justify-center border-l">
        <Loader2 className="h-6 w-6 animate-spin text-[#6d6e6f]" />
      </div>
    ),
  }
);

function ViewLoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-[#6d6e6f]" />
        <p className="text-xs text-[#6d6e6f]">Loading view...</p>
      </div>
    </div>
  );
}

type ViewType = "list" | "board" | "timeline" | "calendar" | "overview" | "files" | "messages" | "dashboard" | "workflow";

interface ProjectContentProps {
  projectId: string;
}

export function ProjectContent({ projectId }: ProjectContentProps) {
  const [activeView, setActiveView] = useState<ViewType>("list");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState("none");
  const [sortBy, setSortBy] = useState<Array<{ field: string; order: "asc" | "desc" }>>([
    { field: "created", order: "desc" },
  ]);
  const [colorBy, setColorBy] = useState("none");

  const { data: project, isLoading } = trpc.projects.get.useQuery({
    id: projectId,
  });

  // Presence tracking
  const presenceViewers = usePresence(`project:${projectId}`);

  // Track visit for recents (fire once when project loads)
  const trackVisit = trpc.recents.track.useMutation();
  const trackedRef = useRef(false);
  useEffect(() => {
    if (project && !trackedRef.current) {
      trackedRef.current = true;
      trackVisit.mutate({
        resourceType: "project",
        resourceId: projectId,
        resourceName: project.name,
      });
    }
  }, [project, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const utils = trpc.useUtils();
  const handleTasksChanged = () => {
    utils.tasks.list.invalidate({ projectId });
  };

  if (isLoading) {
    return (
      <div className="h-full">
        <div className="flex h-14 items-center border-b bg-white px-6 dark:bg-card">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="p-6">
          <Skeleton className="h-8 w-full" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <BulkSelectionProvider>
      <div className="flex h-full">
        <div className="flex-1 overflow-hidden">
          <ProjectHeader
            project={project}
            activeView={activeView}
            onViewChange={setActiveView}
            onTasksChanged={handleTasksChanged}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            colorBy={colorBy}
            onColorByChange={setColorBy}
          />

          {/* Presence viewers */}
          {presenceViewers.length > 0 && (
            <div className="flex items-center gap-1.5 border-b bg-blue-50/50 px-6 py-1.5 text-xs text-blue-600">
              <div className="flex -space-x-1">
                {presenceViewers.slice(0, 5).map((v) => (
                  <div
                    key={v.userId}
                    className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-[8px] font-medium text-white"
                    title={v.user.name ?? ""}
                  >
                    {v.user.name?.split(" ").map((n: string) => n[0]).join("")}
                  </div>
                ))}
              </div>
              <span>
                {presenceViewers.map((v) => v.user.name?.split(" ")[0]).join(", ")} also viewing
              </span>
            </div>
          )}

          <div className="h-[calc(100%-104px)] overflow-y-auto">
            {activeView === "list" && (
              <ProjectListView
                projectId={projectId}
                onTaskClick={setSelectedTaskId}
                sortRules={sortBy}
              />
            )}
            {activeView === "board" && (
              <ProjectBoardView
                projectId={projectId}
                onTaskClick={setSelectedTaskId}
              />
            )}
            {activeView === "timeline" && (
              <ProjectTimelineView
                projectId={projectId}
                onTaskClick={setSelectedTaskId}
              />
            )}
            {activeView === "calendar" && (
              <ProjectCalendarView
                projectId={projectId}
                onTaskClick={setSelectedTaskId}
              />
            )}
            {activeView === "overview" && (
              <ProjectOverview projectId={projectId} />
            )}
            {activeView === "files" && (
              <ProjectFilesView projectId={projectId} />
            )}
            {activeView === "messages" && (
              <ProjectMessagesView projectId={projectId} />
            )}
            {activeView === "dashboard" && (
              <ProjectDashboardView projectId={projectId} />
            )}
            {activeView === "workflow" && (
              <ProjectWorkflowView projectId={projectId} />
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
    </BulkSelectionProvider>
  );
}
