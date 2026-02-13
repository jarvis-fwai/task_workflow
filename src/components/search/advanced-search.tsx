"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Search,
  Filter,
  CheckCircle2,
  Circle,
  Calendar,
  X,
  Badge,
} from "lucide-react";

export function AdvancedSearch() {
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dueFilter, setDueFilter] = useState<string>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data: workspaces } = trpc.workspaces.list.useQuery();
  const workspaceId = workspaces?.[0]?.id;

  // Fetch filter options
  const { data: projects } = trpc.projects.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );

  // Use search.advanced for filtered results
  const advancedInput = useMemo(() => {
    if (!workspaceId) return null;
    const input: Record<string, unknown> = { workspaceId, limit: 20 };
    if (query) input.query = query;
    if (projectFilter !== "all") input.projectId = projectFilter;
    if (assigneeFilter !== "all") input.assigneeId = assigneeFilter;
    if (statusFilter === "INCOMPLETE" || statusFilter === "COMPLETE")
      input.status = statusFilter;
    if (dueFilter === "no_date") input.hasNoDueDate = true;
    if (dueFilter === "overdue") {
      input.dueBefore = new Date().toISOString();
    }
    if (dueFilter === "upcoming") {
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      input.dueAfter = new Date().toISOString();
      input.dueBefore = weekFromNow.toISOString();
    }
    if (selectedTags.length > 0) input.tags = selectedTags;
    return input;
  }, [workspaceId, query, projectFilter, assigneeFilter, statusFilter, dueFilter, selectedTags]);

  const hasAnyInput = query.length > 0 || projectFilter !== "all" || assigneeFilter !== "all" || statusFilter !== "all" || dueFilter !== "all" || selectedTags.length > 0;

  const { data: advancedResults, isLoading } = trpc.search.advanced.useQuery(
    advancedInput as any,
    { enabled: !!workspaceId && hasAnyInput }
  );

  // Also search projects by name when there's a query
  const { data: projectResults } = trpc.search.global.useQuery(
    { query, workspaceId: workspaceId! },
    { enabled: !!workspaceId && query.length >= 1 }
  );

  const filteredTasks = advancedResults?.tasks || [];

  const hasFilters = projectFilter !== "all" || assigneeFilter !== "all" || statusFilter !== "all" || dueFilter !== "all" || selectedTags.length > 0;

  const activeFilterCount = [
    projectFilter !== "all",
    assigneeFilter !== "all",
    statusFilter !== "all",
    dueFilter !== "all",
    selectedTags.length > 0,
  ].filter(Boolean).length;

  // Collect unique assignees from results for the dropdown
  const assignees = useMemo(() => {
    const map = new Map<string, { id: string; name: string | null }>();
    filteredTasks.forEach((t) => {
      if (t.assignee) map.set(t.assignee.id, t.assignee);
    });
    return Array.from(map.values());
  }, [filteredTasks]);

  // Collect unique tags from results
  const availableTags = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    filteredTasks.forEach((t) => {
      (t as any).tags?.forEach((tt: any) => {
        if (tt.tag) map.set(tt.tag.id, tt.tag);
      });
    });
    return Array.from(map.values());
  }, [filteredTasks]);

  const clearAllFilters = () => {
    setProjectFilter("all");
    setAssigneeFilter("all");
    setStatusFilter("all");
    setDueFilter("all");
    setSelectedTags([]);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <div className="h-full bg-white p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-xl font-semibold text-[#1e1f21]">Search</h1>

        {/* Search Input */}
        <div className="mt-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, projects..."
              className="pl-10"
              autoFocus
            />
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4573D2] text-[10px] font-medium text-white">
                {activeFilterCount}
              </span>
            )}
          </div>

          {/* Project Filter */}
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Assignee Filter */}
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              {assignees.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name || "Unknown"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="INCOMPLETE">Incomplete</SelectItem>
              <SelectItem value="COMPLETE">Complete</SelectItem>
            </SelectContent>
          </Select>

          {/* Due Date Filter */}
          <Select value={dueFilter} onValueChange={setDueFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Due date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any date</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="upcoming">Next 7 days</SelectItem>
              <SelectItem value="no_date">No due date</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="gap-1 text-xs"
            >
              <X className="h-3 w-3" />
              Clear all filters
            </Button>
          )}
        </div>

        {/* Tags multi-select */}
        {availableTags.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Tags:</span>
            {availableTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  selectedTags.includes(tag.id)
                    ? "border-[#4573D2] bg-[#4573D2]/10 text-[#4573D2]"
                    : "border-gray-200 text-muted-foreground hover:border-gray-300"
                )}
              >
                <span
                  className="mr-1 inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div className="mt-6">
          {!hasAnyInput ? (
            <div className="py-20 text-center">
              <Search className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-4 text-sm text-muted-foreground">
                Start typing to search across tasks and projects
              </p>
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-lg bg-muted/50"
                />
              ))}
            </div>
          ) : (
            <>
              {/* Tasks */}
              {filteredTasks.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Tasks ({filteredTasks.length})
                  </h3>
                  <div className="space-y-1">
                    {filteredTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50"
                      >
                        {task.status === "COMPLETE" ? (
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" />
                        ) : (
                          <Circle className="h-4 w-4 flex-shrink-0 text-[#cfcbcb]" />
                        )}
                        <span
                          className={cn(
                            "flex-1 text-sm",
                            task.status === "COMPLETE" &&
                              "text-muted-foreground line-through"
                          )}
                        >
                          {task.title}
                        </span>
                        {/* Tags */}
                        {(task as any).tags?.map((tt: any) => (
                          <span
                            key={tt.tag?.id}
                            className="rounded-full px-1.5 py-0.5 text-[10px]"
                            style={{
                              backgroundColor: tt.tag?.color + "20",
                              color: tt.tag?.color,
                            }}
                          >
                            {tt.tag?.name}
                          </span>
                        ))}
                        {task.assignee && (
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="bg-[#4573D2] text-[8px] text-white">
                              {task.assignee.name
                                ?.split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        {task.dueDate && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(task.dueDate).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" }
                            )}
                          </span>
                        )}
                        {task.taskProjects?.[0]?.project && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {task.taskProjects[0].project.name}
                          </span>
                        )}
                        {(task as any)._count && (
                          <span className="text-[10px] text-muted-foreground">
                            {(task as any)._count.subtasks > 0 && `${(task as any)._count.subtasks} subtasks`}
                            {(task as any)._count.comments > 0 && ` · ${(task as any)._count.comments} comments`}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects from global search */}
              {query.length >= 1 && projectResults?.projects && projectResults.projects.length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Projects ({projectResults.projects.length})
                  </h3>
                  <div className="space-y-1">
                    {projectResults.projects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50"
                      >
                        <div
                          className="h-4 w-4 rounded"
                          style={{
                            backgroundColor:
                              (project as any).color || "#4573D2",
                          }}
                        />
                        <span className="flex-1 text-sm font-medium">
                          {project.name}
                        </span>
                        {project.team && (
                          <span className="text-xs text-muted-foreground">
                            {project.team.name}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No results */}
              {filteredTasks.length === 0 &&
                (!projectResults?.projects || projectResults.projects.length === 0) && (
                  <div className="py-20 text-center">
                    <p className="text-sm text-muted-foreground">
                      No results found{query ? ` for "${query}"` : ""}
                    </p>
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
