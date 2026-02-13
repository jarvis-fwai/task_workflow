"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { exportTasksToCsv } from "@/lib/export";
import {
  Star,
  List,
  Columns3,
  GanttChart,
  Calendar,
  FileText,
  Paperclip,
  MessageSquare,
  Share2,
  MoreHorizontal,
  Sparkles,
  BarChart3,
  Zap,
  Archive,
  CopyPlus,
  Download,
  Printer,
  Trash2,
  Filter,
  ArrowUpDown,
  Palette,
  Bookmark,
  Group,
  Plus,
  X,
  LayoutTemplate,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { AiCreateTask } from "@/components/ai/ai-create-task";

type ViewType = "list" | "board" | "timeline" | "calendar" | "overview" | "files" | "messages" | "dashboard" | "workflow";

interface ProjectHeaderProps {
  project: {
    id: string;
    name: string;
    color: string;
    isArchived?: boolean;
  };
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  onTasksChanged?: () => void;
  groupBy?: string;
  onGroupByChange?: (groupBy: string) => void;
  sortBy?: Array<{ field: string; order: "asc" | "desc" }>;
  onSortByChange?: (sortBy: Array<{ field: string; order: "asc" | "desc" }>) => void;
  colorBy?: string;
  onColorByChange?: (colorBy: string) => void;
}

const views: { key: ViewType; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: FileText },
  { key: "list", label: "List", icon: List },
  { key: "board", label: "Board", icon: Columns3 },
  { key: "timeline", label: "Timeline", icon: GanttChart },
  { key: "calendar", label: "Calendar", icon: Calendar },
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "workflow", label: "Workflow", icon: Zap },
  { key: "files", label: "Files", icon: Paperclip },
  { key: "messages", label: "Messages", icon: MessageSquare },
];

export function ProjectHeader({
  project,
  activeView,
  onViewChange,
  onTasksChanged,
  groupBy,
  onGroupByChange,
  sortBy,
  onSortByChange,
  colorBy,
  onColorByChange,
}: ProjectHeaderProps) {
  const router = useRouter();
  const [aiCreateOpen, setAiCreateOpen] = useState(false);
  const [starred, setStarred] = useState(false);
  const utils = trpc.useUtils();

  const archiveProject = trpc.projects.archive.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      toast.success(project.isArchived ? "Project unarchived" : "Project archived");
    },
  });

  const removeRecent = trpc.recents.remove.useMutation();

  const deleteProject = trpc.projects.delete.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      // Clean up the project from Recents sidebar
      removeRecent.mutate(
        { resourceType: "project", resourceId: project.id },
        { onSettled: () => utils.recents.list.invalidate() }
      );
      toast.success("Project deleted");
      router.push("/home");
    },
    onError: () => toast.error("Failed to delete project"),
  });

  const saveAsTemplate = trpc.templates.saveFromProject.useMutation({
    onSuccess: () => {
      toast.success("Project saved as template");
    },
  });

  const duplicateProject = trpc.projects.duplicate.useMutation({
    onSuccess: (newProject) => {
      utils.projects.list.invalidate();
      toast.success("Project duplicated");
      router.push(`/projects/${newProject.id}`);
    },
  });

  const { data: exportTasks } = trpc.projects.getTasksForExport.useQuery(
    { projectId: project.id },
    { enabled: false }
  );

  const exportQuery = trpc.projects.getTasksForExport.useQuery(
    { projectId: project.id },
    { enabled: false }
  );

  const handleExportCsv = async () => {
    const result = await exportQuery.refetch();
    if (result.data) {
      exportTasksToCsv(result.data as any, project.name);
      toast.success("CSV exported");
    }
  };

  const handleExportPdf = async () => {
    const result = await exportQuery.refetch();
    if (!result.data) return;
    const tasks = result.data;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${project.name} - Tasks</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; }
            h1 { font-size: 24px; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; font-weight: 600; }
            .complete { color: #16a34a; }
            .incomplete { color: #6d6e6f; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <h1>${project.name}</h1>
          <table>
            <thead>
              <tr><th>Task</th><th>Assignee</th><th>Status</th><th>Due Date</th><th>Section</th></tr>
            </thead>
            <tbody>
              ${tasks.map((t: any) => `
                <tr>
                  <td>${t.title}</td>
                  <td>${t.assignee?.name ?? ""}</td>
                  <td class="${t.status === "COMPLETE" ? "complete" : "incomplete"}">${t.status === "COMPLETE" ? "Complete" : "Incomplete"}</td>
                  <td>${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : ""}</td>
                  <td>${t.taskProjects?.[0]?.section?.name ?? ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Saved views
  const { data: savedViews } = trpc.views.list.useQuery({ projectId: project.id });
  const saveView = trpc.views.create.useMutation({
    onSuccess: () => {
      utils.views.list.invalidate({ projectId: project.id });
      toast.success("View saved");
    },
  });

  return (
    <>
      <div className="border-b bg-white dark:bg-card">
        {/* Project Name Row */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <div
              className="h-6 w-6 rounded"
              style={{ backgroundColor: project.color }}
            />
            <h1 className="text-lg font-medium text-[#1e1f21] dark:text-foreground">
              {project.name}
            </h1>
            <button
              className={cn("transition-colors", starred ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500")}
              onClick={() => {
                setStarred(!starred);
                toast.success(starred ? "Removed from favorites" : "Added to favorites");
              }}
            >
              <Star className={cn("h-4 w-4", starred && "fill-yellow-500")} />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-[#4573D2]"
              onClick={() => setAiCreateOpen(true)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Create
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Project link copied to clipboard");
              }}
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>

            {/* Project Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() =>
                    archiveProject.mutate({
                      id: project.id,
                      isArchived: !project.isArchived,
                    })
                  }
                >
                  <Archive className="mr-2 h-4 w-4" />
                  {project.isArchived ? "Unarchive" : "Archive"} project
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    duplicateProject.mutate({
                      id: project.id,
                      name: `${project.name} (copy)`,
                      includeTasks: true,
                      includeFields: true,
                    })
                  }
                >
                  <CopyPlus className="mr-2 h-4 w-4" />
                  Duplicate project
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const name = prompt("Template name:", project.name);
                    if (name) {
                      saveAsTemplate.mutate({
                        projectId: project.id,
                        name,
                      });
                    }
                  }}
                >
                  <LayoutTemplate className="mr-2 h-4 w-4" />
                  Save as template
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    if (window.confirm(`Delete project "${project.name}"? This will permanently remove all tasks, sections, and data in this project.`)) {
                      deleteProject.mutate({ id: project.id });
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExportCsv}>
                  <Download className="mr-2 h-4 w-4" />
                  Export to CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPdf}>
                  <Printer className="mr-2 h-4 w-4" />
                  Export to PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                {/* Group By */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Group className="mr-2 h-4 w-4" />
                    Group by
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {["none", "assignee", "status", "dueDate", "section"].map(
                      (opt) => (
                        <DropdownMenuItem
                          key={opt}
                          onClick={() => onGroupByChange?.(opt)}
                          className={cn(groupBy === opt && "bg-muted")}
                        >
                          {opt === "none" ? "None" : opt === "dueDate" ? "Due Date" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </DropdownMenuItem>
                      )
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Sort By (Multi-Column) */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    Sort by
                    {sortBy && sortBy.length > 1 && (
                      <span className="ml-1 rounded-full bg-[#4573D2] px-1.5 py-0.5 text-[10px] text-white">
                        {sortBy.length}
                      </span>
                    )}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64 p-2">
                    {/* Current sort rules */}
                    {sortBy?.map((rule, idx) => {
                      const fieldLabel: Record<string, string> = {
                        created: "Created",
                        dueDate: "Due date",
                        title: "Name",
                        assignee: "Assignee",
                        priority: "Priority",
                      };
                      return (
                        <div
                          key={idx}
                          className="mb-1 flex items-center gap-1.5 rounded bg-muted/50 px-2 py-1.5 text-xs"
                        >
                          <span className="flex-1 font-medium">
                            {fieldLabel[rule.field] ?? rule.field}
                          </span>
                          <button
                            className="rounded px-1.5 py-0.5 text-[10px] hover:bg-muted"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newSort = [...(sortBy ?? [])];
                              newSort[idx] = {
                                ...newSort[idx]!,
                                order: rule.order === "asc" ? "desc" : "asc",
                              };
                              onSortByChange?.(newSort);
                            }}
                          >
                            {rule.order === "asc" ? "Asc" : "Desc"}
                          </button>
                          {(sortBy?.length ?? 0) > 1 && (
                            <button
                              className="text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newSort = (sortBy ?? []).filter((_, i) => i !== idx);
                                onSortByChange?.(newSort);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    <DropdownMenuSeparator />

                    {/* Add sort level */}
                    {[
                      { field: "created", label: "Created" },
                      { field: "dueDate", label: "Due date" },
                      { field: "title", label: "Name" },
                      { field: "assignee", label: "Assignee" },
                      { field: "priority", label: "Priority" },
                    ]
                      .filter(
                        (opt) => !(sortBy ?? []).some((r) => r.field === opt.field)
                      )
                      .map((opt) => (
                        <DropdownMenuItem
                          key={opt.field}
                          onClick={() => {
                            onSortByChange?.([
                              ...(sortBy ?? []),
                              { field: opt.field, order: "asc" },
                            ]);
                          }}
                          className="text-xs"
                        >
                          <Plus className="mr-1.5 h-3 w-3" />
                          Add {opt.label}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Color By */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Palette className="mr-2 h-4 w-4" />
                    Color by
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {["none", "status", "priority", "dueDate"].map((opt) => (
                      <DropdownMenuItem
                        key={opt}
                        onClick={() => onColorByChange?.(opt)}
                        className={cn(colorBy === opt && "bg-muted")}
                      >
                        {opt === "none" ? "None" : opt === "dueDate" ? "Due Date" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                {/* Save View */}
                <DropdownMenuItem
                  onClick={() => {
                    const name = prompt("View name:");
                    if (name) {
                      saveView.mutate({
                        projectId: project.id,
                        name,
                        config: { groupBy, sortBy: JSON.stringify(sortBy), colorBy, view: activeView },
                      });
                    }
                  }}
                >
                  <Bookmark className="mr-2 h-4 w-4" />
                  Save current view
                </DropdownMenuItem>

                {/* Load Saved Views */}
                {savedViews && savedViews.length > 0 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Filter className="mr-2 h-4 w-4" />
                      Saved views
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {savedViews.map((v) => (
                        <DropdownMenuItem
                          key={v.id}
                          onClick={() => {
                            const cfg = v.config as any;
                            if (cfg.groupBy) onGroupByChange?.(cfg.groupBy);
                            if (cfg.sortBy) {
                              try {
                                const parsed = JSON.parse(cfg.sortBy);
                                onSortByChange?.(parsed);
                              } catch {
                                onSortByChange?.([{ field: "created", order: "desc" }]);
                              }
                            }
                            if (cfg.colorBy) onColorByChange?.(cfg.colorBy);
                            if (cfg.view) onViewChange(cfg.view);
                          }}
                        >
                          {v.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto px-6">
          {views.map((view) => (
            <button
              key={view.key}
              onClick={() => onViewChange(view.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                activeView === view.key
                  ? "border-[#1e1f21] text-[#1e1f21] dark:border-foreground dark:text-foreground"
                  : "border-transparent text-[#6d6e6f] hover:border-gray-300 hover:text-[#1e1f21] dark:hover:text-foreground"
              )}
            >
              <view.icon className="h-3.5 w-3.5" />
              {view.label}
            </button>
          ))}
        </div>
      </div>

      <AiCreateTask
        open={aiCreateOpen}
        onOpenChange={setAiCreateOpen}
        projectId={project.id}
        onTaskCreated={() => onTasksChanged?.()}
      />
    </>
  );
}
