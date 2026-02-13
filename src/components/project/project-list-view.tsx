"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useBulkSelection } from "@/contexts/bulk-selection-context";
import { useUndo } from "@/contexts/undo-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus,
  ChevronRight,
  CheckCircle2,
  Circle,
  GripVertical,
  Calendar,
} from "lucide-react";
import { BulkActionsToolbar } from "@/components/task/bulk-actions-toolbar";

export type SortRule = { field: string; order: "asc" | "desc" };

interface ProjectListViewProps {
  projectId: string;
  onTaskClick: (taskId: string) => void;
  sortRules?: SortRule[];
}

export function ProjectListView({
  projectId,
  onTaskClick,
  sortRules = [{ field: "created", order: "desc" }],
}: ProjectListViewProps) {
  const { data: sections } = trpc.sections.list.useQuery({ projectId });
  const { data: tasks } = trpc.tasks.list.useQuery({ projectId });
  const utils = trpc.useUtils();
  const { pushUndo } = useUndo();

  const { selectedTaskIds, toggle: toggleTask, isSelected } = useBulkSelection();

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

  const completeTask = trpc.tasks.complete.useMutation({
    onSuccess: (_data, variables) => {
      utils.tasks.list.invalidate({ projectId });
      pushUndo("Task completed", () => {
        uncompleteTask.mutate({ id: variables.id });
      });
    },
  });

  const uncompleteTask = trpc.tasks.uncomplete.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ projectId });
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

  const handleToggleComplete = (
    taskId: string,
    currentStatus: string
  ) => {
    if (currentStatus === "COMPLETE") {
      uncompleteTask.mutate({ id: taskId });
    } else {
      completeTask.mutate({ id: taskId });
    }
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="px-6 py-4">
      {/* Column Headers */}
      <div className="mb-1 flex items-center border-b pb-2 text-xs font-medium text-[#6d6e6f]">
        <div className="w-8" />
        <div className="w-6" />
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
                      onChange={() => toggleTask(task.id)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-[#4573D2] opacity-0 focus:ring-[#4573D2] group-hover:opacity-100"
                      style={{ opacity: isSelected(task.id) ? 1 : undefined }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="flex w-8 items-center justify-center">
                    <GripVertical className="h-3.5 w-3.5 text-transparent group-hover:text-[#cfcbcb]" />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleComplete(task.id, task.status);
                    }}
                    className="mr-2 flex-shrink-0"
                  >
                    {task.status === "COMPLETE" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-[#cfcbcb] hover:text-green-600" />
                    )}
                  </button>
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
                  <div className="flex w-32 items-center justify-center">
                    {task.assignee && (
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-[#4573D2] text-[10px] text-white">
                          {task.assignee.name
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                  <div className="flex w-32 items-center justify-center text-xs text-muted-foreground">
                    {task.dueDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(task.dueDate)}
                      </span>
                    )}
                  </div>
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
