"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useBulkSelection } from "@/contexts/bulk-selection-context";
import { useUndo } from "@/contexts/undo-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Plus,
  ChevronRight,
  CheckCircle2,
  Circle,
  GripVertical,
  Calendar,
  Check,
  X,
} from "lucide-react";
import { BulkActionsToolbar } from "@/components/task/bulk-actions-toolbar";
import { TaskListSkeleton } from "@/components/ui/loading-skeletons";
import { EmptyTaskList } from "@/components/ui/empty-state";

export type SortRule = { field: string; order: "asc" | "desc" };

interface ProjectListViewProps {
  projectId: string;
  onTaskClick: (taskId: string) => void;
  sortRules?: SortRule[];
}

// ── Inline Assignee Picker ──────────────────────────────────────────────
function AssigneeCell({
  task,
  projectId,
}: {
  task: any;
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const { data: project } = trpc.projects.get.useQuery({ id: projectId });
  const { data: workspaces } = trpc.workspaces.list.useQuery();

  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => utils.tasks.list.invalidate({ projectId }),
  });

  // Get workspace members through the workspace
  const workspaceId = project?.workspaceId;
  const { data: workspace } = trpc.workspaces.get.useQuery(
    { id: workspaceId! },
    { enabled: !!workspaceId }
  );

  const members = workspace?.members ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="flex w-32 cursor-pointer items-center justify-center hover:bg-blue-50/50 rounded px-1 py-0.5 transition-colors">
          {task.assignee ? (
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-[#4573D2] text-[10px] text-white">
                {task.assignee.name
                  ?.split(" ")
                  .map((n: string) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
          ) : (
            <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">—</span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">Assign to</div>
        <button
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-100"
          onClick={() => {
            updateTask.mutate({ id: task.id, assigneeId: null });
            setOpen(false);
          }}
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Unassigned</span>
          {!task.assigneeId && <Check className="ml-auto h-3.5 w-3.5 text-blue-500" />}
        </button>
        {members.map((member: any) => (
          <button
            key={member.user?.id ?? member.id}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-100"
            onClick={() => {
              updateTask.mutate({ id: task.id, assigneeId: member.user?.id ?? member.userId });
              setOpen(false);
            }}
          >
            <Avatar className="h-5 w-5">
              <AvatarFallback className="bg-[#4573D2] text-[9px] text-white">
                {(member.user?.name ?? "")
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <span>{member.user?.name ?? member.name}</span>
            {task.assigneeId === (member.user?.id ?? member.userId) && (
              <Check className="ml-auto h-3.5 w-3.5 text-blue-500" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ── Inline Date Picker ──────────────────────────────────────────────────
function DueDateCell({
  task,
  projectId,
}: {
  task: any;
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => utils.tasks.list.invalidate({ projectId }),
  });

  const formatDate = (date: string | Date | null) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleDateChange = (value: string) => {
    if (value) {
      const d = new Date(value + "T00:00:00Z");
      updateTask.mutate({ id: task.id, dueDate: d.toISOString() });
    } else {
      updateTask.mutate({ id: task.id, dueDate: null });
    }
    setOpen(false);
  };

  const currentValue = task.dueDate
    ? new Date(task.dueDate).toISOString().split("T")[0]
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="flex w-32 cursor-pointer items-center justify-center hover:bg-blue-50/50 rounded px-1 py-0.5 transition-colors text-xs text-muted-foreground">
          {task.dueDate ? (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(task.dueDate)}
            </span>
          ) : (
            <span className="opacity-0 group-hover:opacity-100">—</span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Due date</div>
          <input
            ref={inputRef}
            type="date"
            className="rounded border px-2 py-1 text-sm"
            defaultValue={currentValue}
            onChange={(e) => handleDateChange(e.target.value)}
            autoFocus
          />
          {task.dueDate && (
            <button
              className="block text-xs text-red-500 hover:text-red-700"
              onClick={() => {
                updateTask.mutate({ id: task.id, dueDate: null });
                setOpen(false);
              }}
            >
              Remove date
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Inline Status Cell ──────────────────────────────────────────────────
function StatusCell({
  task,
  projectId,
}: {
  task: any;
  projectId: string;
}) {
  const utils = trpc.useUtils();

  const completeTask = trpc.tasks.complete.useMutation({
    onSuccess: () => utils.tasks.list.invalidate({ projectId }),
  });
  const uncompleteTask = trpc.tasks.uncomplete.useMutation({
    onSuccess: () => utils.tasks.list.invalidate({ projectId }),
  });

  const toggle = () => {
    if (task.status === "COMPLETE") {
      uncompleteTask.mutate({ id: task.id });
    } else {
      completeTask.mutate({ id: task.id });
    }
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      className="mr-2 flex-shrink-0"
    >
      {task.status === "COMPLETE" ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <Circle className="h-4 w-4 text-[#cfcbcb] hover:text-green-600" />
      )}
    </button>
  );
}

export function ProjectListView({
  projectId,
  onTaskClick,
  sortRules = [{ field: "created", order: "desc" }],
}: ProjectListViewProps) {
  const { data: sections, isLoading: sectionsLoading } = trpc.sections.list.useQuery({ projectId });
  const { data: tasks, isLoading: tasksLoading } = trpc.tasks.list.useQuery({ projectId });
  const utils = trpc.useUtils();
  const { pushUndo } = useUndo();

  const { selectedTaskIds, toggle: toggleTask, toggleWithShift, selectAll, isSelected, count: selectedCount } = useBulkSelection();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const [addingTaskInSection, setAddingTaskInSection] = useState<string | null>(
    null
  );
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const createSection = trpc.sections.create.useMutation({
    onSuccess: () => utils.sections.list.invalidate({ projectId }),
  });

  const deleteSection = trpc.sections.delete.useMutation({
    onSuccess: () => {
      utils.sections.list.invalidate({ projectId });
      utils.tasks.list.invalidate({ projectId });
    },
  });

  const updateSection = trpc.sections.update.useMutation({
    onSuccess: () => utils.sections.list.invalidate({ projectId }),
  });

  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null);
  const [sectionName, setSectionName] = useState("");

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ projectId });
      setNewTaskTitle("");
      setAddingTaskInSection(null);
    },
  });

  // Initialize all sections as expanded
  if (sections && expandedSections.size === 0) {
    setExpandedSections(new Set(sections.map((s) => s.id)));
  }

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const multiSortComparator = useMemo(() => {
    return (a: any, b: any): number => {
      for (const rule of sortRules) {
        let cmp = 0;
        switch (rule.field) {
          case "created":
            cmp =
              new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime();
            break;
          case "dueDate": {
            const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
            const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            cmp = ad - bd;
            break;
          }
          case "title":
            cmp = (a.title ?? "").localeCompare(b.title ?? "");
            break;
          case "assignee":
            cmp = (a.assignee?.name ?? "").localeCompare(
              b.assignee?.name ?? ""
            );
            break;
          case "priority": {
            const priorityOrder: Record<string, number> = {
              HIGH: 1,
              MEDIUM: 2,
              LOW: 3,
            };
            cmp =
              (priorityOrder[a.priority] ?? 99) -
              (priorityOrder[b.priority] ?? 99);
            break;
          }
        }
        if (cmp !== 0) return rule.order === "desc" ? -cmp : cmp;
      }
      return 0;
    };
  }, [sortRules]);

  const getTasksForSection = (sectionId: string) => {
    if (!tasks) return [];
    return tasks
      .filter((task) =>
        task.taskProjects?.some((tp) => tp.sectionId === sectionId)
      )
      .sort(multiSortComparator);
  };

  const handleAddTask = (sectionId: string) => {
    if (!newTaskTitle.trim()) return;
    createTask.mutate({
      title: newTaskTitle.trim(),
      projectId,
      sectionId,
    });
  };

  if (sectionsLoading || tasksLoading) {
    return <TaskListSkeleton />;
  }

  if (sections && sections.length === 0 && (!tasks || tasks.length === 0)) {
    return <EmptyTaskList onAddTask={() => setAddingTaskInSection("new")} />;
  }

  return (
    <div className="px-6 py-4">
      {/* Column Headers */}
      <div className="mb-1 flex items-center border-b pb-2 text-xs font-medium text-[#6d6e6f]">
        <div className="flex w-6 items-center justify-center">
          <input
            type="checkbox"
            checked={tasks ? tasks.length > 0 && selectedCount === tasks.length : false}
            onChange={() => {
              if (tasks) selectAll(tasks.map((t) => t.id));
            }}
            className="h-3.5 w-3.5 rounded border-gray-300 text-[#4573D2]"
          />
        </div>
        <div className="w-8" />
        <div className="flex-1">Task name</div>
        <div className="w-32 text-center">Assignee</div>
        <div className="w-32 text-center">Due date</div>
      </div>

      {sections?.map((section) => (
        <div key={section.id} className="mb-4">
          {/* Section Header */}
          <div className="group flex w-full items-center gap-2 py-2">
            <button onClick={() => toggleSection(section.id)}>
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  expandedSections.has(section.id) && "rotate-90"
                )}
              />
            </button>
            {renamingSectionId === section.id ? (
              <input
                className="border-b border-blue-500 bg-transparent text-sm font-semibold text-[#1e1f21] outline-none"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                onBlur={() => {
                  if (sectionName.trim() && sectionName !== section.name) {
                    updateSection.mutate({ id: section.id, name: sectionName.trim() });
                  }
                  setRenamingSectionId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setRenamingSectionId(null);
                }}
                autoFocus
              />
            ) : (
              <button
                className="text-sm font-semibold text-[#1e1f21]"
                onDoubleClick={() => {
                  setRenamingSectionId(section.id);
                  setSectionName(section.name);
                }}
                onClick={() => toggleSection(section.id)}
              >
                {section.name}
              </button>
            )}
            <span className="text-xs text-muted-foreground">
              {getTasksForSection(section.id).length}
            </span>
            <button
              className="ml-auto text-xs text-muted-foreground opacity-0 hover:text-red-500 group-hover:opacity-100"
              onClick={() => {
                if (confirm(`Delete section "${section.name}"?`)) {
                  deleteSection.mutate({ id: section.id });
                  pushUndo(`Section "${section.name}" deleted`, () => {
                    createSection.mutate({ projectId, name: section.name });
                  });
                }
              }}
            >
              ×
            </button>
          </div>

          {expandedSections.has(section.id) && (
            <div>
              {getTasksForSection(section.id).map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    "group flex items-center border-b border-gray-100 py-1.5 hover:bg-[#f9f8f8]",
                    isSelected(task.id) && "bg-blue-50 hover:bg-blue-50"
                  )}
                >
                  {/* Bulk selection checkbox */}
                  <div className="flex w-6 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isSelected(task.id)}
                      onChange={() => {}}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-[#4573D2] opacity-0 focus:ring-[#4573D2] group-hover:opacity-100"
                      style={{ opacity: isSelected(task.id) ? 1 : undefined }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const allTaskIds = tasks?.map((t) => t.id) ?? [];
                        toggleWithShift(task.id, allTaskIds, e.shiftKey);
                      }}
                    />
                  </div>
                  <div className="flex w-8 items-center justify-center">
                    <GripVertical className="h-3.5 w-3.5 text-transparent group-hover:text-[#cfcbcb]" />
                  </div>

                  {/* Inline Status Toggle */}
                  <StatusCell task={task} projectId={projectId} />

                  <button
                    onClick={() => onTaskClick(task.id)}
                    className={cn(
                      "flex-1 text-left text-sm",
                      task.status === "COMPLETE" &&
                        "text-muted-foreground line-through"
                    )}
                  >
                    {task.title}
                  </button>
                  {(task as any).isApproval && (task as any).approvalStatus && (
                    <span className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      (task as any).approvalStatus === "APPROVED" && "bg-green-100 text-green-700",
                      (task as any).approvalStatus === "REJECTED" && "bg-red-100 text-red-700",
                      (task as any).approvalStatus === "PENDING" && "bg-yellow-100 text-yellow-700",
                      (task as any).approvalStatus === "CHANGES_REQUESTED" && "bg-orange-100 text-orange-700",
                    )}>
                      {(task as any).approvalStatus === "CHANGES_REQUESTED" ? "Changes" : (task as any).approvalStatus}
                    </span>
                  )}

                  {/* Inline Assignee Picker */}
                  <AssigneeCell task={task} projectId={projectId} />

                  {/* Inline Due Date Picker */}
                  <DueDateCell task={task} projectId={projectId} />
                </div>
              ))}

              {/* Add Task */}
              {addingTaskInSection === section.id ? (
                <div className="flex items-center border-b border-gray-100 py-1.5">
                  <div className="w-6" />
                  <div className="w-8" />
                  <Circle className="mr-2 h-4 w-4 text-[#cfcbcb]" />
                  <Input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTask(section.id);
                      if (e.key === "Escape") {
                        setAddingTaskInSection(null);
                        setNewTaskTitle("");
                      }
                    }}
                    onBlur={() => {
                      if (newTaskTitle.trim()) handleAddTask(section.id);
                      else {
                        setAddingTaskInSection(null);
                        setNewTaskTitle("");
                      }
                    }}
                    placeholder="Write a task name, press Enter to save"
                    className="h-7 flex-1 border-none bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                    autoFocus
                  />
                </div>
              ) : (
                <button
                  onClick={() => setAddingTaskInSection(section.id)}
                  className="flex w-full items-center gap-2 py-2 text-sm text-muted-foreground hover:text-[#1e1f21]"
                >
                  <div className="w-6" />
                  <div className="w-8" />
                  <Plus className="h-4 w-4" />
                  Add task
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add Section */}
      <button
        onClick={() => {
          const name = prompt("Section name:");
          if (name?.trim()) {
            createSection.mutate({ projectId, name: name.trim() });
          }
        }}
        className="flex items-center gap-2 px-6 py-3 text-sm text-muted-foreground hover:text-[#1e1f21]"
      >
        <Plus className="h-4 w-4" />
        Add section
      </button>

      <BulkActionsToolbar
        projectId={projectId}
        sections={sections?.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}
