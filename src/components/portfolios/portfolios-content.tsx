"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Briefcase,
  ChevronRight,
  Plus,
  MoreHorizontal,
  FolderOpen,
  Pencil,
  Trash2,
  LayoutList,
  GanttChart,
  BarChart3,
  X,
  Check,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  ON_TRACK: "#7BC86C",
  AT_RISK: "#FD9A00",
  OFF_TRACK: "#E8384F",
  ON_HOLD: "#6D6E6F",
  COMPLETE: "#4573D2",
};

const STATUS_LABELS: Record<string, string> = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  OFF_TRACK: "Off track",
  ON_HOLD: "On hold",
  COMPLETE: "Complete",
};

type ViewMode = "list" | "dashboard" | "timeline";

export function PortfoliosContent() {
  const { data: workspaces } = trpc.workspaces.list.useQuery();
  const workspaceId = workspaces?.[0]?.id;

  const { data: portfolios } = trpc.portfolios.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );

  const { data: allProjects } = trpc.projects.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );

  const utils = trpc.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editId, setEditId] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const createPortfolio = trpc.portfolios.create.useMutation({
    onSuccess: () => {
      utils.portfolios.list.invalidate();
      setCreateOpen(false);
      setName("");
      setDescription("");
      toast.success("Portfolio created");
    },
  });

  const updatePortfolio = trpc.portfolios.update.useMutation({
    onSuccess: () => {
      utils.portfolios.list.invalidate();
      setEditOpen(false);
      toast.success("Portfolio updated");
    },
  });

  const deletePortfolio = trpc.portfolios.delete.useMutation({
    onSuccess: () => {
      utils.portfolios.list.invalidate();
      toast.success("Portfolio deleted");
    },
  });

  const addProject = trpc.portfolios.addProject.useMutation({
    onSuccess: () => {
      utils.portfolios.list.invalidate();
      toast.success("Project added");
    },
    onError: () => toast.error("Project already in portfolio"),
  });

  const removeProject = trpc.portfolios.removeProject.useMutation({
    onSuccess: () => {
      utils.portfolios.list.invalidate();
      toast.success("Project removed");
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !workspaceId) return;
    createPortfolio.mutate({ name: name.trim(), description: description.trim() || undefined, workspaceId });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    updatePortfolio.mutate({ id: editId, name: editName.trim(), description: editDescription.trim() || undefined });
  };

  const openEdit = (portfolio: { id: string; name: string; description?: string | null }) => {
    setEditId(portfolio.id);
    setEditName(portfolio.name);
    setEditDescription(portfolio.description ?? "");
    setEditOpen(true);
  };

  // Status dashboard counts
  const statusCounts = useMemo(() => {
    if (!portfolios) return { onTrack: 0, atRisk: 0, offTrack: 0, complete: 0, noStatus: 0 };
    const counts = { onTrack: 0, atRisk: 0, offTrack: 0, complete: 0, noStatus: 0 };
    portfolios.forEach((p) => {
      p.projects.forEach(({ project }) => {
        const status = (project as any).statusUpdates?.[0]?.status;
        if (status === "ON_TRACK") counts.onTrack++;
        else if (status === "AT_RISK") counts.atRisk++;
        else if (status === "OFF_TRACK") counts.offTrack++;
        else if (status === "COMPLETE") counts.complete++;
        else counts.noStatus++;
      });
    });
    return counts;
  }, [portfolios]);

  // Projects not in the active portfolio
  const availableProjects = useMemo(() => {
    if (!allProjects || !activePortfolioId || !portfolios) return [];
    const portfolio = portfolios.find((p) => p.id === activePortfolioId);
    const existingIds = new Set(portfolio?.projects.map((pp) => pp.project.id) ?? []);
    return (allProjects as any[]).filter((p: any) => !existingIds.has(p.id));
  }, [allProjects, activePortfolioId, portfolios]);

  const getProgress = (project: any) => {
    const total = project._count?.taskProjects ?? 0;
    if (total === 0) return 0;
    // We don't have completed count directly, approximate from status
    return 0; // Will be calculated server-side
  };

  return (
    <>
      <div className="h-full">
        <div className="flex h-14 items-center justify-between border-b bg-white px-6 dark:bg-card">
          <h1 className="text-lg font-medium text-[#1e1f21] dark:text-foreground">Portfolios</h1>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border bg-muted/30">
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-7 gap-1 rounded-r-none px-2 text-xs", viewMode === "list" && "bg-white shadow-sm dark:bg-card")}
                onClick={() => setViewMode("list")}
              >
                <LayoutList className="h-3.5 w-3.5" />
                List
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-7 gap-1 rounded-none border-x px-2 text-xs", viewMode === "dashboard" && "bg-white shadow-sm dark:bg-card")}
                onClick={() => setViewMode("dashboard")}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Dashboard
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-7 gap-1 rounded-l-none px-2 text-xs", viewMode === "timeline" && "bg-white shadow-sm dark:bg-card")}
                onClick={() => setViewMode("timeline")}
              >
                <GanttChart className="h-3.5 w-3.5" />
                Timeline
              </Button>
            </div>
            <Button
              size="sm"
              className="gap-1.5 bg-[#4573D2] hover:bg-[#3A63B8]"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              New portfolio
            </Button>
          </div>
        </div>

        {/* Status Dashboard View */}
        {viewMode === "dashboard" && portfolios && portfolios.length > 0 && (
          <div className="border-b bg-gray-50 px-6 py-4 dark:bg-card/50">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border bg-white p-3 dark:bg-card">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.ON_TRACK }} />
                  <span className="text-xs text-muted-foreground">On track</span>
                </div>
                <p className="mt-1 text-2xl font-semibold">{statusCounts.onTrack}</p>
              </div>
              <div className="rounded-lg border bg-white p-3 dark:bg-card">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.AT_RISK }} />
                  <span className="text-xs text-muted-foreground">At risk</span>
                </div>
                <p className="mt-1 text-2xl font-semibold">{statusCounts.atRisk}</p>
              </div>
              <div className="rounded-lg border bg-white p-3 dark:bg-card">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.OFF_TRACK }} />
                  <span className="text-xs text-muted-foreground">Off track</span>
                </div>
                <p className="mt-1 text-2xl font-semibold">{statusCounts.offTrack}</p>
              </div>
              <div className="rounded-lg border bg-white p-3 dark:bg-card">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.COMPLETE }} />
                  <span className="text-xs text-muted-foreground">Complete</span>
                </div>
                <p className="mt-1 text-2xl font-semibold">{statusCounts.complete}</p>
              </div>
            </div>
          </div>
        )}

        {portfolios && portfolios.length > 0 ? (
          <div className="p-6">
            {/* Timeline View */}
            {viewMode === "timeline" && (
              <div className="space-y-4">
                {portfolios.map((portfolio) => (
                  <div key={portfolio.id} className="rounded-lg border bg-white shadow-sm dark:bg-card">
                    <div className="border-b px-5 py-3">
                      <h3 className="text-sm font-semibold text-[#1e1f21] dark:text-foreground">{portfolio.name}</h3>
                    </div>
                    <div className="p-4">
                      {portfolio.projects.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground">No projects</p>
                      ) : (
                        <PortfolioTimeline projects={portfolio.projects.map((pp) => pp.project)} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* List / Dashboard View */}
            {(viewMode === "list" || viewMode === "dashboard") && (
              <div className="space-y-4">
                {portfolios.map((portfolio) => (
                  <div key={portfolio.id} className="rounded-lg border bg-white shadow-sm dark:bg-card">
                    <div className="flex items-center gap-3 border-b px-5 py-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4573D2]/10">
                        <Briefcase className="h-5 w-5 text-[#4573D2]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-[#1e1f21] dark:text-foreground">{portfolio.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {portfolio.projects.length} project{portfolio.projects.length !== 1 ? "s" : ""}
                          {portfolio.description ? ` · ${portfolio.description}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => { setActivePortfolioId(portfolio.id); setAddProjectOpen(true); }}
                      >
                        <Plus className="h-3 w-3" />
                        Add project
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(portfolio)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (window.confirm(`Delete portfolio "${portfolio.name}"?`)) {
                                deletePortfolio.mutate({ id: portfolio.id });
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {portfolio.projects.length > 0 ? (
                      <div>
                        {/* Table header */}
                        <div className="grid grid-cols-[1fr_100px_100px_80px_100px_40px] gap-2 border-b px-5 py-2 text-xs font-medium text-muted-foreground">
                          <span>Project name</span>
                          <span>Status</span>
                          <span>Due date</span>
                          <span>Tasks</span>
                          <span>Owner</span>
                          <span></span>
                        </div>
                        <div className="divide-y">
                          {portfolio.projects.map(({ project }) => {
                            const latestStatus = (project as any).statusUpdates?.[0];
                            const statusKey = latestStatus?.status;
                            return (
                              <div
                                key={project.id}
                                className="grid grid-cols-[1fr_100px_100px_80px_100px_40px] items-center gap-2 px-5 py-3 transition-colors hover:bg-muted/30"
                              >
                                <Link href={`/projects/${project.id}`} className="flex items-center gap-2">
                                  <div className="h-3 w-3 flex-shrink-0 rounded-sm" style={{ backgroundColor: (project as any).color }} />
                                  <span className="text-sm text-[#1e1f21] hover:underline dark:text-foreground">{project.name}</span>
                                </Link>
                                <div>
                                  {statusKey && (
                                    <span
                                      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                                      style={{ backgroundColor: STATUS_COLORS[statusKey] || "#6D6E6F" }}
                                    >
                                      {STATUS_LABELS[statusKey] || statusKey}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {(project as any).dueDate
                                    ? new Date((project as any).dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                                    : "—"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {(project as any)._count?.taskProjects ?? 0}
                                </span>
                                <span className="text-xs text-muted-foreground">—</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    if (window.confirm(`Remove "${project.name}" from portfolio?`)) {
                                      removeProject.mutate({ portfolioId: portfolio.id, projectId: project.id });
                                    }
                                  }}
                                >
                                  <X className="h-3 w-3 text-muted-foreground" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                        No projects in this portfolio yet
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted/30">
              <FolderOpen className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <h3 className="text-lg font-medium text-[#1e1f21] dark:text-foreground">Manage your portfolios</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Group projects into portfolios to track overall progress and status at a glance.
            </p>
            <Button className="mt-4 gap-1.5 bg-[#4573D2] hover:bg-[#3A63B8]" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create portfolio
            </Button>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>New portfolio</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="portfolio-name">Portfolio name</Label>
              <Input id="portfolio-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter portfolio name" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="portfolio-desc">Description (optional)</Label>
              <Textarea id="portfolio-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this portfolio for?" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!name.trim() || createPortfolio.isPending} className="bg-[#4573D2] hover:bg-[#3A63B8]">
                {createPortfolio.isPending ? "Creating..." : "Create portfolio"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Edit portfolio</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Portfolio name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!editName.trim() || updatePortfolio.isPending} className="bg-[#4573D2] hover:bg-[#3A63B8]">
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Project Dialog */}
      <Dialog open={addProjectOpen} onOpenChange={setAddProjectOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Add project to portfolio</DialogTitle>
          </DialogHeader>
          <div className="max-h-[300px] space-y-1 overflow-y-auto">
            {availableProjects.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">All projects are already in this portfolio</p>
            ) : (
              availableProjects.map((project: any) => (
                <button
                  key={project.id}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                  onClick={() => {
                    if (activePortfolioId) {
                      addProject.mutate({ portfolioId: activePortfolioId, projectId: project.id });
                    }
                  }}
                >
                  <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: project.color }} />
                  <span className="flex-1 text-left">{project.name}</span>
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Mini Gantt Timeline Component
function PortfolioTimeline({ projects }: { projects: any[] }) {
  const now = new Date();
  const allDates = projects.flatMap((p) => {
    const dates: number[] = [];
    if (p.startDate) dates.push(new Date(p.startDate).getTime());
    if (p.dueDate) dates.push(new Date(p.dueDate).getTime());
    return dates;
  });

  if (allDates.length === 0) {
    return <p className="text-center text-sm text-muted-foreground">No project dates set</p>;
  }

  const minDate = Math.min(...allDates, now.getTime());
  const maxDate = Math.max(...allDates, now.getTime());
  const range = maxDate - minDate || 1;
  const padding = range * 0.05;
  const timelineStart = minDate - padding;
  const timelineEnd = maxDate + padding;
  const totalRange = timelineEnd - timelineStart;

  const nowPos = ((now.getTime() - timelineStart) / totalRange) * 100;

  return (
    <div className="relative">
      {/* Today marker */}
      <div className="absolute top-0 bottom-0 z-10" style={{ left: `${nowPos}%` }}>
        <div className="h-full w-px bg-red-400" />
        <span className="absolute -top-4 -translate-x-1/2 text-[9px] font-medium text-red-500">Today</span>
      </div>

      <div className="space-y-2 pt-2">
        {projects.map((project) => {
          const start = project.startDate ? new Date(project.startDate).getTime() : now.getTime();
          const end = project.dueDate ? new Date(project.dueDate).getTime() : start + 7 * 86400000;
          const left = ((start - timelineStart) / totalRange) * 100;
          const width = Math.max(((end - start) / totalRange) * 100, 2);
          const latestStatus = project.statusUpdates?.[0];
          const color = latestStatus ? (STATUS_COLORS[latestStatus.status] || project.color) : project.color;

          return (
            <div key={project.id} className="flex items-center gap-2">
              <Link href={`/projects/${project.id}`} className="w-28 flex-shrink-0 truncate text-xs hover:underline">
                {project.name}
              </Link>
              <div className="relative h-6 flex-1 rounded bg-gray-100 dark:bg-gray-800">
                <div
                  className="absolute top-1 h-4 rounded"
                  style={{
                    left: `${Math.max(0, left)}%`,
                    width: `${Math.min(width, 100 - left)}%`,
                    backgroundColor: color,
                    opacity: 0.85,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Date labels */}
      <div className="mt-2 flex justify-between text-[9px] text-muted-foreground">
        <span>{new Date(timelineStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        <span>{new Date(timelineEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
      </div>
    </div>
  );
}
