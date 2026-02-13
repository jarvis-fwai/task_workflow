"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus,
  MoreHorizontal,
  CheckCircle2,
  Circle,
  Calendar,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { useBulkSelection } from "@/contexts/bulk-selection-context";
import { BulkActionsToolbar } from "@/components/task/bulk-actions-toolbar";
import { BoardSkeleton } from "@/components/ui/loading-skeletons";
import { EmptyBoard } from "@/components/ui/empty-state";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ProjectBoardViewProps {
  projectId: string;
  onTaskClick: (taskId: string) => void;
}

type TaskItem = {
  id: string;
  title: string;
  status: string;
  dueDate: string | Date | null;
  assignee: { name: string } | null;
  taskProjects?: { sectionId: string | null }[];
  _count?: { subtasks: number; comments: number; attachments: number };
  tags?: { tag: { name: string; color: string } }[];
};

function SortableTaskCard({
  task,
  onTaskClick,
  onComplete,
  isSelected,
  onToggleSelect,
}: {
  task: TaskItem;
  onTaskClick: (id: string) => void;
  onComplete: (id: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "group cursor-pointer border bg-white p-3 shadow-sm transition-shadow hover:shadow-md",
        isSelected && "ring-2 ring-[#4573D2] ring-offset-1"
      )}
      onClick={() => onTaskClick(task.id)}
    >
      <div className="flex items-start gap-2">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(task.id)}
            className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded border-gray-300 text-[#4573D2] opacity-0 group-hover:opacity-100"
            style={{ opacity: isSelected ? 1 : undefined }}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <div
          {...attributes}
          {...listeners}
          className="mt-0.5 flex-shrink-0 cursor-grab opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onComplete(task.id);
          }}
          className="mt-0.5 flex-shrink-0"
        >
          {task.status === "COMPLETE" ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <Circle className="h-4 w-4 text-[#cfcbcb] hover:text-green-600" />
          )}
        </button>
        <span
          className={cn(
            "text-sm",
            task.status === "COMPLETE" &&
              "text-muted-foreground line-through"
          )}
        >
          {task.title}
        </span>
        {(task as any).isApproval && (task as any).approvalStatus && (
          <span className={cn(
            "ml-1.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            (task as any).approvalStatus === "APPROVED" && "bg-green-100 text-green-700",
            (task as any).approvalStatus === "REJECTED" && "bg-red-100 text-red-700",
            (task as any).approvalStatus === "PENDING" && "bg-yellow-100 text-yellow-700",
            (task as any).approvalStatus === "CHANGES_REQUESTED" && "bg-orange-100 text-orange-700",
          )}>
            {(task as any).approvalStatus === "PENDING" ? "⏳" : (task as any).approvalStatus === "APPROVED" ? "✓" : "✗"}
          </span>
        )}
      </div>

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 pl-8">
          {task.tags.map(({ tag }) => (
            <span
              key={tag.name}
              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {(task.assignee || task.dueDate) && (
        <div className="mt-2 flex items-center justify-between pl-8">
          <div>
            {task.dueDate && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {formatDate(task.dueDate)}
              </span>
            )}
          </div>
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
        </div>
      )}

      {/* Subtask/comment count */}
      {task._count && (task._count.subtasks > 0 || task._count.comments > 0) && (
        <div className="mt-2 flex items-center gap-3 pl-8 text-xs text-muted-foreground">
          {task._count.subtasks > 0 && (
            <span>{task._count.subtasks} subtask{task._count.subtasks > 1 ? "s" : ""}</span>
          )}
          {task._count.comments > 0 && (
            <span>{task._count.comments} comment{task._count.comments > 1 ? "s" : ""}</span>
          )}
        </div>
      )}
    </Card>
  );
}

export function ProjectBoardView({
  projectId,
  onTaskClick,
}: ProjectBoardViewProps) {
  const { data: sections, isLoading: sectionsLoading } = trpc.sections.list.useQuery({ projectId });
  const { data: tasks, isLoading: tasksLoading } = trpc.tasks.list.useQuery({ projectId });
  const utils = trpc.useUtils();
  const { toggle: toggleSelect, isSelected } = useBulkSelection();

  const [addingTaskInSection, setAddingTaskInSection] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ projectId });
      setNewTaskTitle("");
      setAddingTaskInSection(null);
    },
  });

  const completeTask = trpc.tasks.complete.useMutation({
    onSuccess: () => utils.tasks.list.invalidate({ projectId }),
  });

  const moveTask = trpc.tasks.move.useMutation({
    onSuccess: () => utils.tasks.list.invalidate({ projectId }),
  });

  const renameSection = trpc.sections.update.useMutation({
    onSuccess: () => {
      utils.sections.list.invalidate({ projectId });
      toast.success("Section renamed");
    },
  });

  const deleteSection = trpc.sections.delete.useMutation({
    onSuccess: () => {
      utils.sections.list.invalidate({ projectId });
      utils.tasks.list.invalidate({ projectId });
      toast.success("Section deleted");
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const tasksBySectionId = useMemo(() => {
    const map: Record<string, TaskItem[]> = {};
    if (!sections || !tasks) return map;
    for (const section of sections) {
      map[section.id] = tasks.filter((task) =>
        task.taskProjects?.some((tp) => tp.sectionId === section.id)
      );
    }
    return map;
  }, [sections, tasks]);

  const activeTask = activeId
    ? tasks?.find((t) => t.id === activeId)
    : null;

  const handleAddTask = (sectionId: string) => {
    if (!newTaskTitle.trim()) return;
    createTask.mutate({
      title: newTaskTitle.trim(),
      projectId,
      sectionId,
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    // Determine the target section
    const overTask = tasks?.find((t) => t.id === over.id);
    const targetSectionId = overTask
      ? overTask.taskProjects?.[0]?.sectionId
      : sections?.find((s) => s.id === over.id)?.id;

    if (targetSectionId) {
      const sectionTasks = tasksBySectionId[targetSectionId] || [];
      const overIndex = sectionTasks.findIndex((t) => t.id === over.id);
      const position = overIndex >= 0 ? overIndex + 1 : sectionTasks.length + 1;

      moveTask.mutate({
        taskId: active.id as string,
        projectId,
        sectionId: targetSectionId,
        position,
      });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Could add hover effects here
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (sectionsLoading || tasksLoading) {
    return <BoardSkeleton />;
  }

  if (!sections || sections.length === 0) {
    return <EmptyBoard />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex h-full gap-4 overflow-x-auto p-6">
        {sections?.map((section) => {
          const sectionTasks = tasksBySectionId[section.id] || [];
          const taskIds = sectionTasks.map((t) => t.id);

          return (
            <div
              key={section.id}
              className="flex w-[280px] flex-shrink-0 flex-col"
            >
              {/* Column Header */}
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#1e1f21]">
                  {section.name}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {sectionTasks.length}
                  </span>
                </h3>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      const newName = window.prompt("Rename section:", section.name);
                      if (newName && newName.trim()) {
                        renameSection.mutate({ id: section.id, name: newName.trim() });
                      }
                    }}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        if (window.confirm(`Delete section "${section.name}"? Tasks will be moved to the first section.`)) {
                          deleteSection.mutate({ id: section.id });
                        }
                      }}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Task Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto">
                <SortableContext
                  items={taskIds}
                  strategy={verticalListSortingStrategy}
                >
                  {sectionTasks.map((task) => (
                    <SortableTaskCard
                      key={task.id}
                      task={task}
                      onTaskClick={onTaskClick}
                      onComplete={(id) => completeTask.mutate({ id })}
                      isSelected={isSelected(task.id)}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </SortableContext>

                {/* Add Task */}
                {addingTaskInSection === section.id ? (
                  <Card className="border bg-white p-3">
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
                      placeholder="Task name"
                      className="h-7 border-none bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                      autoFocus
                    />
                  </Card>
                ) : (
                  <button
                    onClick={() => setAddingTaskInSection(section.id)}
                    className="flex w-full items-center gap-1.5 rounded-lg border border-dashed py-2 text-sm text-muted-foreground transition-colors hover:border-solid hover:bg-white"
                  >
                    <Plus className="mx-auto h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Section Column */}
        <div className="flex w-[280px] flex-shrink-0 items-start">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sm text-muted-foreground"
          >
            <Plus className="h-4 w-4" />
            Add section
          </Button>
        </div>
      </div>

      <BulkActionsToolbar
        projectId={projectId}
        sections={sections?.map((s) => ({ id: s.id, name: s.name }))}
      />

      {/* Drag Overlay */}
      <DragOverlay>
        {activeTask ? (
          <Card className="w-[260px] border bg-white p-3 shadow-lg">
            <div className="flex items-start gap-2">
              {activeTask.status === "COMPLETE" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#cfcbcb]" />
              )}
              <span className="text-sm">{activeTask.title}</span>
            </div>
            {(activeTask.assignee || activeTask.dueDate) && (
              <div className="mt-2 flex items-center justify-between">
                <div>
                  {activeTask.dueDate && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(activeTask.dueDate)}
                    </span>
                  )}
                </div>
                {activeTask.assignee && (
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="bg-[#4573D2] text-[8px] text-white">
                      {activeTask.assignee.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            )}
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
