"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  X,
  CheckCircle2,
  Circle,
  ThumbsUp,
  Paperclip,
  CalendarDays,
  User,
  Tag,
  ArrowRight,
  Copy,
  Trash2,
  Link2,
  FileText,
  Download,
  CopyPlus,
  Printer,
  ShieldCheck,
  Hash,
  Pencil,
  Clock,
  Diamond,
  UserPlus,
  UserMinus,
  Repeat,
  Plus,
  Search,
} from "lucide-react";
import { AiTaskSummary } from "@/components/ai/ai-task-summary";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { ReactionGroup } from "@/components/reactions/reaction-group";
import { ImageProofing } from "@/components/proofing/image-proofing";
import { VideoRecorder } from "@/components/comments/video-recorder";
import { RecurrencePicker } from "@/components/task/recurrence-picker";
import { useUndo } from "@/contexts/undo-context";
import { useSession } from "next-auth/react";
import { usePresence } from "@/hooks/use-presence";

function AssigneePicker({
  currentAssignee,
  workspaceId,
  onSelect,
}: {
  currentAssignee: { name: string; id: string } | null;
  workspaceId: string;
  onSelect: (userId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: members } = trpc.workspaces.getMembers.useQuery(
    { workspaceId },
    { enabled: open }
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50"
      >
        {currentAssignee ? (
          <>
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-[#4573D2] text-[10px] text-white">
                {currentAssignee.name?.split(" ").map((n) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">{currentAssignee.name}</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">No assignee</span>
        )}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-48 rounded-md border bg-white shadow-lg dark:bg-card">
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
            onClick={() => { onSelect(null); setOpen(false); }}
          >
            Unassign
          </button>
          {members?.map((m: any) => (
            <button
              key={m.userId}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => { onSelect(m.userId); setOpen(false); }}
            >
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-[#4573D2] text-[8px] text-white">
                  {m.user?.name?.split(" ").map((n: string) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              {m.user?.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface TaskDetailPanelProps {
  taskId: string;
  onClose: () => void;
}

export function TaskDetailPanel({ taskId, onClose }: TaskDetailPanelProps) {
  const { data: session } = useSession();
  const { data: task, isLoading } = trpc.tasks.get.useQuery({ id: taskId });
  const presenceViewers = usePresence(taskId ? `task:${taskId}` : null);
  const { data: taskReactions } = trpc.reactions.listForTask.useQuery(
    { taskId },
    { enabled: !!taskId }
  );
  const utils = trpc.useUtils();
  const { pushUndo } = useUndo();
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentBody, setEditCommentBody] = useState("");
  const [proofingAttachment, setProofingAttachment] = useState<{ id: string; url: string; name: string } | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [showAddDep, setShowAddDep] = useState(false);
  const [depSearch, setDepSearch] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [deletingAttId, setDeletingAttId] = useState<string | null>(null);

  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ id: taskId });
      utils.tasks.list.invalidate();
      utils.tasks.myTasks.invalidate();
    },
  });

  const createComment = trpc.comments.create.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ id: taskId });
      setNewComment("");
    },
  });

  const updateComment = trpc.comments.update.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ id: taskId });
      setEditingCommentId(null);
      setEditCommentBody("");
    },
  });

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
    },
  });

  const completeTask = trpc.tasks.complete.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ id: taskId });
      utils.tasks.list.invalidate();
      pushUndo("Task completed", () => {
        uncompleteTask.mutate({ id: taskId });
      });
    },
  });

  const uncompleteTask = trpc.tasks.uncomplete.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ id: taskId });
      utils.tasks.list.invalidate();
    },
  });

  const deleteTask = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      utils.tasks.myTasks.invalidate();
      // Capture task data before it's gone for undo
      if (task) {
        const captured = {
          title: task.title,
          description: typeof task.description === "string" ? task.description : undefined,
          projectId: task.taskProjects?.[0]?.projectId,
          sectionId: task.taskProjects?.[0]?.sectionId ?? undefined,
          assigneeId: task.assigneeId ?? undefined,
        };
        pushUndo("Task deleted", () => {
          if (captured.projectId) {
            createTask.mutate({
              title: captured.title,
              projectId: captured.projectId,
              sectionId: captured.sectionId,
            });
          }
        });
      } else {
        toast.success("Task deleted");
      }
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete task");
    },
  });

  const duplicateTask = trpc.tasks.duplicate.useMutation({
    onSuccess: (newTask) => {
      utils.tasks.list.invalidate();
      toast.success("Task duplicated", {
        action: {
          label: "View",
          onClick: () => {
            // Would navigate to new task
          },
        },
      });
    },
  });

  const markAsApproval = trpc.tasks.markAsApproval.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ id: taskId });
      toast.success("Approval status updated");
    },
  });

  const setApprovalStatus = trpc.tasks.setApprovalStatus.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ id: taskId });
    },
  });

  const addTag = trpc.tasks.addTag.useMutation({
    onSuccess: () => utils.tasks.get.invalidate({ id: taskId }),
  });

  const removeTag = trpc.tasks.removeTag.useMutation({
    onSuccess: () => utils.tasks.get.invalidate({ id: taskId }),
  });

  const createAttachment = trpc.attachments.create.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ id: taskId });
      toast.success("File attached");
    },
  });

  const deleteAttachment = trpc.attachments.delete.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ id: taskId });
      toast.success("Attachment deleted");
      setDeletingAttId(null);
    },
  });

  const handleFileDrop = useCallback(async (files: FileList) => {
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) {
          createAttachment.mutate({
            taskId,
            fileName: data.fileName,
            fileUrl: data.url,
            fileSize: data.fileSize,
            mimeType: data.mimeType,
          });
        }
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
  }, [taskId, createAttachment]);

  const removeDependency = trpc.tasks.removeDependency.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ id: taskId });
    },
  });

  const addDependency = trpc.tasks.addDependency.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ id: taskId });
      setShowAddDep(false);
      setDepSearch("");
    },
  });

  const setRecurrence = trpc.tasks.setRecurrence.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ id: taskId });
      toast.success("Recurrence updated");
    },
  });

  const toggleFollow = trpc.tasks.toggleFollow.useMutation({
    onSuccess: (data) => {
      utils.tasks.get.invalidate({ id: taskId });
      toast.success(data.following ? "Following task" : "Unfollowed task");
    },
  });

  // Follower check
  const isFollowing = task?.followers?.some(
    (f) => f.userId === session?.user?.id
  );

  // Search tasks for dependency picker
  const { data: depSearchResults } = trpc.search.global.useQuery(
    { query: depSearch, workspaceId: task?.workspaceId ?? "" },
    { enabled: depSearch.length > 2 && !!task?.workspaceId }
  );

  if (isLoading) {
    return (
      <div className="w-[500px] border-l bg-white dark:bg-card">
        <div className="p-6">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="mt-4 h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex w-[500px] items-center justify-center border-l bg-white dark:bg-card">
        <p className="text-muted-foreground">Task not found</p>
      </div>
    );
  }

  const handleToggleComplete = () => {
    if (task.status === "COMPLETE") {
      uncompleteTask.mutate({ id: taskId });
    } else {
      completeTask.mutate({ id: taskId });
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${task.title}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { font-size: 24px; margin-bottom: 8px; }
            .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
            .field { display: flex; gap: 12px; margin-bottom: 8px; font-size: 14px; }
            .field-label { color: #666; width: 120px; }
            .section { margin-top: 24px; }
            .section h2 { font-size: 16px; color: #666; margin-bottom: 8px; }
            .subtask { padding: 4px 0; font-size: 14px; }
            .comment { border-top: 1px solid #eee; padding: 12px 0; }
            .comment-author { font-weight: 600; font-size: 14px; }
            .comment-body { font-size: 14px; margin-top: 4px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <h1>${task.title}</h1>
          <div class="meta">#${task.id.slice(0, 8)} &middot; ${task.status === "COMPLETE" ? "Complete" : "Incomplete"}</div>
          <div class="field"><span class="field-label">Assignee</span><span>${task.assignee?.name ?? "Unassigned"}</span></div>
          <div class="field"><span class="field-label">Due date</span><span>${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "None"}</span></div>
          ${task.subtasks && task.subtasks.length > 0 ? `
            <div class="section">
              <h2>Subtasks</h2>
              ${task.subtasks.map((s) => `<div class="subtask">${s.status === "COMPLETE" ? "\u2713" : "\u25CB"} ${s.title}</div>`).join("")}
            </div>
          ` : ""}
          ${task.comments && task.comments.length > 0 ? `
            <div class="section">
              <h2>Comments</h2>
              ${task.comments.map((c) => `
                <div class="comment">
                  <div class="comment-author">${c.author?.name ?? "Unknown"} &middot; ${new Date(c.createdAt).toLocaleDateString()}</div>
                  <div class="comment-body">${typeof c.body === "string" ? c.body : JSON.stringify(c.body)}</div>
                </div>
              `).join("")}
            </div>
          ` : ""}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const approvalBadge = task.isApproval && task.approvalStatus ? (
    <span
      className={cn(
        "ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium",
        task.approvalStatus === "APPROVED" && "bg-green-100 text-green-700",
        task.approvalStatus === "REJECTED" && "bg-red-100 text-red-700",
        task.approvalStatus === "PENDING" && "bg-yellow-100 text-yellow-700",
        task.approvalStatus === "CHANGES_REQUESTED" && "bg-orange-100 text-orange-700"
      )}
    >
      {task.approvalStatus.replace("_", " ")}
    </span>
  ) : null;

  return (
    <div className="flex w-[500px] flex-col border-l bg-white dark:bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5 text-xs",
              task.status === "COMPLETE" && "text-green-600"
            )}
            onClick={handleToggleComplete}
          >
            {task.status === "COMPLETE" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
            {task.status === "COMPLETE" ? "Completed" : "Mark complete"}
          </Button>
          {approvalBadge}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 gap-1 text-xs", isFollowing && "text-[#4573D2]")}
            onClick={() => toggleFollow.mutate({ taskId })}
            title={isFollowing ? "Unfollow" : "Follow"}
          >
            {isFollowing ? <UserMinus className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => duplicateTask.mutate({ id: taskId })}
            title="Duplicate task"
          >
            <CopyPlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handlePrint}
            title="Print task"
          >
            <Printer className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", task.isApproval && "text-blue-600")}
            onClick={() =>
              markAsApproval.mutate({
                id: taskId,
                isApproval: !task.isApproval,
              })
            }
            title={task.isApproval ? "Remove approval" : "Mark as approval"}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              navigator.clipboard.writeText(
                `${window.location.origin}/my-tasks?task=${taskId}`
              );
              toast.success("Task link copied to clipboard");
            }}
            title="Copy task link"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => deleteTask.mutate({ id: taskId })}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Task ID */}
        <button
          onClick={() => {
            navigator.clipboard.writeText(task.id);
            toast.success("Task ID copied");
          }}
          className="mb-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          title="Click to copy full task ID"
        >
          <Hash className="h-3 w-3" />
          {task.id.slice(0, 8)}
        </button>

        {/* Presence Indicators */}
        {presenceViewers.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700">
            <div className="flex -space-x-1.5">
              {presenceViewers.slice(0, 3).map((v) => (
                <Avatar key={v.userId} className="h-5 w-5 border-2 border-white">
                  <AvatarFallback className="bg-blue-500 text-[8px] text-white">
                    {v.user.name?.split(" ").map((n: string) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span>
              {presenceViewers.map((v) => v.user.name?.split(" ")[0]).join(", ")}{" "}
              {presenceViewers.length === 1 ? "is" : "are"} viewing this task
            </span>
          </div>
        )}

        {/* Title */}
        <Input
          defaultValue={task.title}
          onBlur={(e) => {
            if (e.target.value !== task.title) {
              updateTask.mutate({ id: taskId, title: e.target.value });
            }
          }}
          className="border-none px-0 text-xl font-medium shadow-none focus-visible:ring-0"
        />

        {/* Approval Actions */}
        {task.isApproval && task.approvalStatus === "PENDING" && (
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 border-green-200 hover:bg-green-50"
              onClick={() =>
                setApprovalStatus.mutate({
                  id: taskId,
                  approvalStatus: "APPROVED",
                })
              }
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() =>
                setApprovalStatus.mutate({
                  id: taskId,
                  approvalStatus: "REJECTED",
                })
              }
            >
              Reject
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-orange-600 border-orange-200 hover:bg-orange-50"
              onClick={() =>
                setApprovalStatus.mutate({
                  id: taskId,
                  approvalStatus: "CHANGES_REQUESTED",
                })
              }
            >
              Request Changes
            </Button>
          </div>
        )}

        {/* Reactions on task */}
        {taskReactions && session?.user?.id && (
          <div className="mt-3">
            <ReactionGroup
              taskId={taskId}
              reactions={taskReactions as any}
              currentUserId={session.user.id}
            />
          </div>
        )}

        {/* Fields */}
        <div className="mt-6 space-y-4">
          {/* Assignee */}
          <div className="flex items-center">
            <div className="flex w-32 items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              Assignee
            </div>
            <AssigneePicker
              currentAssignee={task.assignee}
              workspaceId={task.workspaceId}
              onSelect={(userId) => updateTask.mutate({ id: taskId, assigneeId: userId })}
            />
          </div>

          {/* Due Date */}
          <div className="flex items-center">
            <div className="flex w-32 items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Due date
            </div>
            <Input
              type="date"
              className="h-7 w-40 text-sm"
              defaultValue={task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""}
              onChange={(e) => {
                const val = e.target.value;
                updateTask.mutate({
                  id: taskId,
                  dueDate: val ? new Date(val).toISOString() : null,
                });
              }}
            />
          </div>

          {/* Start Date */}
          <div className="flex items-center">
            <div className="flex w-32 items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Start date
            </div>
            <Input
              type="date"
              className="h-7 w-40 text-sm"
              defaultValue={task.startDate ? new Date(task.startDate).toISOString().split("T")[0] : ""}
              onChange={(e) => {
                const val = e.target.value;
                updateTask.mutate({
                  id: taskId,
                  startDate: val ? new Date(val).toISOString() : null,
                });
              }}
            />
          </div>

          {/* Estimated Hours */}
          <div className="flex items-center">
            <div className="flex w-32 items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Estimate
            </div>
            <Input
              type="number"
              step="0.5"
              min="0"
              placeholder="Hours"
              defaultValue={task.estimatedHours ?? ""}
              onBlur={(e) => {
                const val = e.target.value ? parseFloat(e.target.value) : null;
                if (val !== task.estimatedHours) {
                  updateTask.mutate({ id: taskId, estimatedHours: val } as any);
                }
              }}
              className="h-7 w-24 text-sm"
            />
          </div>

          {/* Projects */}
          <div className="flex items-center">
            <div className="flex w-32 items-center gap-2 text-sm text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
              Projects
            </div>
            <div className="flex flex-wrap gap-1">
              {task.taskProjects?.map((tp) => (
                <span
                  key={tp.id}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  {tp.project.name}
                </span>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="flex items-start">
            <div className="flex w-32 items-center gap-2 pt-0.5 text-sm text-muted-foreground">
              <Tag className="h-4 w-4" />
              Tags
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {task.tags && task.tags.length > 0 && (
                task.tags.map((tt) => (
                  <span
                    key={tt.id}
                    className="group/tag flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                    style={{
                      backgroundColor: tt.tag.color + "20",
                      color: tt.tag.color,
                    }}
                  >
                    {tt.tag.name}
                    <button
                      className="hidden text-current opacity-60 hover:opacity-100 group-hover/tag:inline"
                      onClick={() => removeTag.mutate({ taskId, tagId: tt.tag.id })}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
              <button
                className="rounded-full border border-dashed px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const name = prompt("Tag name:");
                  if (name?.trim()) {
                    addTag.mutate({ taskId, tagName: name.trim() });
                  }
                }}
              >
                + Tag
              </button>
            </div>
          </div>

          {/* Dependencies */}
          <div className="flex items-start">
            <div className="flex w-32 items-center gap-2 pt-0.5 text-sm text-muted-foreground">
              <Link2 className="h-4 w-4" />
              Blocked by
            </div>
            <div className="flex-1">
              {task.dependsOn && task.dependsOn.length > 0 ? (
                <div className="space-y-1">
                  {task.dependsOn.map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1"
                    >
                      {dep.dependsOn.status === "COMPLETE" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-[#cfcbcb]" />
                      )}
                      <span className="flex-1 text-xs">
                        {dep.dependsOn.title}
                      </span>
                      <button
                        onClick={() =>
                          removeDependency.mutate({ id: dep.id })
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">None</span>
              )}
            </div>
          </div>

          {/* Blocking */}
          {task.blocking && task.blocking.length > 0 && (
            <div className="flex items-start">
              <div className="flex w-32 items-center gap-2 pt-0.5 text-sm text-muted-foreground">
                <ArrowRight className="h-4 w-4" />
                Blocking
              </div>
              <div className="space-y-1">
                {task.blocking.map((dep) => (
                  <div
                    key={dep.id}
                    className="rounded bg-orange-50 px-2 py-1 text-xs dark:bg-orange-900/20"
                  >
                    {dep.task.title}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Followers */}
          <div className="flex items-start">
            <div className="flex w-32 items-center gap-2 pt-0.5 text-sm text-muted-foreground">
              <UserPlus className="h-4 w-4" />
              Followers
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {task.followers?.map((f) => (
                <span key={f.id} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {f.user.name}
                </span>
              ))}
              {task.followers?.length === 0 && (
                <span className="text-sm text-muted-foreground">None</span>
              )}
            </div>
          </div>

          {/* Milestone toggle */}
          <div className="flex items-center">
            <div className="flex w-32 items-center gap-2 text-sm text-muted-foreground">
              <Diamond className="h-4 w-4" />
              Milestone
            </div>
            <button
              onClick={() => updateTask.mutate({ id: taskId, isMilestone: !task.isMilestone } as any)}
              className={cn(
                "rounded px-2 py-0.5 text-xs",
                task.isMilestone ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30" : "bg-muted text-muted-foreground"
              )}
            >
              {task.isMilestone ? "◆ Milestone" : "Mark as milestone"}
            </button>
          </div>

          {/* Recurrence */}
          <div className="flex items-center">
            <div className="flex w-32 items-center gap-2 text-sm text-muted-foreground">
              <Repeat className="h-4 w-4" />
              Recurrence
            </div>
            <button
              onClick={() => setShowRecurrence(!showRecurrence)}
              className="rounded px-2 py-0.5 text-xs bg-muted text-muted-foreground hover:bg-muted/80"
            >
              {task.isRecurring ? "Recurring ✓" : "Set recurrence"}
            </button>
          </div>

          {showRecurrence && (
            <div className="ml-32 mt-1">
              <RecurrencePicker
                taskId={taskId}
                recurrenceRule={task.recurrenceRule as any}
                isRecurring={task.isRecurring}
              />
            </div>
          )}

          {/* Custom Fields */}
          {task.customFieldValues && task.customFieldValues.length > 0 && (
            <div className="space-y-2">
              {task.customFieldValues.map((cfv: any) => (
                <div key={cfv.id} className="flex items-center">
                  <div className="w-32 text-sm text-muted-foreground truncate">
                    {cfv.customField?.name}
                  </div>
                  <span className="text-sm">
                    {cfv.stringValue || cfv.numberValue || (cfv.dateValue ? new Date(cfv.dateValue).toLocaleDateString() : cfv.selectedOptions?.join(", ") || "—")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Summary */}
        <div className="mt-6">
          <AiTaskSummary taskId={taskId} />
        </div>

        {/* Description */}
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-[#6d6e6f]">
            Description
          </h3>
          <RichTextEditor
            content={
              typeof task.description === "string" ? task.description : ""
            }
            onChange={(html) => {
              updateTask.mutate({ id: taskId, description: html });
            }}
            placeholder="Add a description..."
            minimal
            className="border-none"
          />
        </div>

        {/* Attachments */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#6d6e6f]">
              Attachments
            </h3>
            <label className="cursor-pointer rounded px-2 py-1 text-xs text-[#4573D2] hover:bg-blue-50">
              <Paperclip className="mr-1 inline h-3 w-3" />
              Attach file
              <input
                type="file"
                multiple
                className="hidden"
                onChange={async (e) => {
                  if (e.target.files) await handleFileDrop(e.target.files);
                }}
              />
            </label>
          </div>

          {/* Drag & Drop Zone */}
          <div
            className={cn(
              "rounded-lg border-2 border-dashed p-4 text-center transition-colors",
              isDragOver
                ? "border-[#4573D2] bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files.length > 0) {
                await handleFileDrop(e.dataTransfer.files);
              }
            }}
          >
            <Paperclip className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-1 text-xs text-muted-foreground">
              {isDragOver ? "Drop files to upload" : "Drop files here or click to upload"}
            </p>
          </div>

          {/* Attachment List */}
          {task.attachments && (task.attachments as any[]).length > 0 && (
            <div className="mt-3 space-y-2">
              {(task.attachments as any[]).map((att: any) => {
                const isImage = att.mimeType?.startsWith("image/");
                const isPdf = att.mimeType === "application/pdf";
                return (
                  <div key={att.id} className="group/att rounded-lg border bg-white p-2">
                    {/* Image thumbnail preview */}
                    {isImage && (
                      <div
                        className="mb-2 cursor-pointer overflow-hidden rounded"
                        onClick={() => setLightboxUrl(att.fileUrl)}
                      >
                        <img
                          src={att.fileUrl}
                          alt={att.fileName}
                          className="h-32 w-full object-cover transition-transform hover:scale-105"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {isPdf ? (
                        <FileText className="h-4 w-4 shrink-0 text-red-500" />
                      ) : isImage ? (
                        <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="flex-1 truncate text-sm">{att.fileName}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {att.fileSize < 1024 * 1024
                          ? `${(att.fileSize / 1024).toFixed(0)} KB`
                          : `${(att.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                      </span>
                      {isImage && (
                        <button
                          className="text-[10px] text-[#4573D2] hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProofingAttachment({ id: att.id, url: att.fileUrl, name: att.fileName });
                          }}
                        >
                          Proof
                        </button>
                      )}
                      <a
                        href={att.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-[#4573D2]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                      {deletingAttId === att.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] text-white hover:bg-red-600"
                            onClick={(e) => { e.stopPropagation(); deleteAttachment.mutate({ id: att.id }); }}
                          >
                            Confirm
                          </button>
                          <button
                            className="text-[10px] text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); setDeletingAttId(null); }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="text-muted-foreground opacity-0 transition-opacity group-hover/att:opacity-100 hover:text-red-500"
                          onClick={(e) => { e.stopPropagation(); setDeletingAttId(att.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Subtasks */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#6d6e6f]">
              Subtasks {task.subtasks && task.subtasks.length > 0 && (
                <span className="text-xs font-normal">
                  ({task.subtasks.filter((s) => s.status === "COMPLETE").length}/{task.subtasks.length})
                </span>
              )}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-xs"
              onClick={() => setShowAddSubtask(true)}
            >
              <Plus className="h-3 w-3" /> Add subtask
            </Button>
          </div>
          {task.subtasks && task.subtasks.length > 0 && (
            <div className="space-y-1">
              {task.subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    if (subtask.status === "COMPLETE") {
                      uncompleteTask.mutate({ id: subtask.id });
                    } else {
                      completeTask.mutate({ id: subtask.id });
                    }
                  }}
                >
                  {subtask.status === "COMPLETE" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-[#cfcbcb]" />
                  )}
                  <span
                    className={cn(
                      "text-sm",
                      subtask.status === "COMPLETE" &&
                        "text-muted-foreground line-through"
                    )}
                  >
                    {subtask.title}
                  </span>
                  {subtask._count?.subtasks ? (
                    <span className="text-[10px] text-muted-foreground">
                      +{subtask._count.subtasks}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {showAddSubtask && (
            <form
              className="mt-1 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newSubtaskTitle.trim() && task.taskProjects?.[0]) {
                  createTask.mutate({
                    title: newSubtaskTitle.trim(),
                    projectId: task.taskProjects[0].projectId,
                    sectionId: task.taskProjects[0].sectionId ?? undefined,
                    parentTaskId: taskId,
                  });
                  setNewSubtaskTitle("");
                }
              }}
            >
              <Circle className="h-4 w-4 text-[#cfcbcb]" />
              <Input
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="Subtask name..."
                className="h-7 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setShowAddSubtask(false);
                    setNewSubtaskTitle("");
                  }
                }}
              />
            </form>
          )}
        </div>

        {/* Add Dependency */}
        <div className="mt-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 text-xs text-muted-foreground"
            onClick={() => setShowAddDep(!showAddDep)}
          >
            <Link2 className="h-3 w-3" /> Add dependency
          </Button>
          {showAddDep && (
            <div className="mt-1">
              <Input
                value={depSearch}
                onChange={(e) => setDepSearch(e.target.value)}
                placeholder="Search tasks..."
                className="h-7 text-sm"
                autoFocus
              />
              {depSearchResults?.tasks && depSearchResults.tasks.length > 0 && (
                <div className="mt-1 max-h-32 overflow-y-auto rounded border">
                  {depSearchResults.tasks
                    .filter((t: any) => t.id !== taskId)
                    .slice(0, 5)
                    .map((t: any) => (
                      <button
                        key={t.id}
                        className="w-full px-2 py-1 text-left text-xs hover:bg-muted"
                        onClick={() =>
                          addDependency.mutate({
                            taskId,
                            dependsOnTaskId: t.id,
                          })
                        }
                      >
                        {t.title}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        <Separator className="my-6" />

        {/* Comments */}
        <div>
          <h3 className="mb-4 text-sm font-medium text-[#6d6e6f]">
            Activity
          </h3>

          {/* Activity Log entries */}
          {(task as any).activityLogs && (task as any).activityLogs.length > 0 && (
            <div className="mb-4 space-y-2">
              {(task as any).activityLogs.map((log: any) => (
                <div key={log.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                  <span>
                    {log.action === "created" && "Task created"}
                    {log.action === "completed" && "Task marked complete"}
                    {log.action === "updated" && log.field && `${log.field} updated`}
                  </span>
                  <span>·</span>
                  <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}

          {task.comments && task.comments.length > 0 ? (
            <div className="space-y-4">
              {task.comments.map((comment) => {
                const isEditing = editingCommentId === comment.id;
                const isOwn = comment.authorId === session?.user?.id;
                const wasEdited =
                  new Date(comment.updatedAt).getTime() -
                    new Date(comment.createdAt).getTime() >
                  1000;

                return (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-muted text-xs">
                        {comment.author?.name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {comment.author?.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                        {wasEdited && (
                          <span className="text-xs text-muted-foreground italic">
                            (edited)
                          </span>
                        )}
                        {isOwn && !isEditing && (
                          <button
                            onClick={() => {
                              setEditingCommentId(comment.id);
                              setEditCommentBody(
                                typeof comment.body === "string"
                                  ? comment.body
                                  : JSON.stringify(comment.body)
                              );
                            }}
                            className="text-muted-foreground hover:text-foreground"
                            title="Edit comment"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="mt-1 flex gap-2">
                          <Input
                            value={editCommentBody}
                            onChange={(e) =>
                              setEditCommentBody(e.target.value)
                            }
                            className="h-7 text-sm"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            className="h-7"
                            onClick={() => {
                              if (editCommentBody.trim()) {
                                updateComment.mutate({
                                  id: comment.id,
                                  body: editCommentBody.trim(),
                                });
                              }
                            }}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7"
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditCommentBody("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="mt-1 text-sm text-[#6d6e6f]">
                            {typeof comment.body === "string"
                              ? comment.body
                              : JSON.stringify(comment.body)}
                          </p>
                          {(comment as any).videoUrl && (
                            <video
                              src={(comment as any).videoUrl}
                              controls
                              className="mt-2 max-w-[280px] rounded"
                              style={{ maxHeight: 180 }}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No activity yet</p>
          )}

          {/* Add Comment */}
          <form
            className="mt-4 flex items-center gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (newComment.trim()) {
                createComment.mutate({
                  taskId,
                  body: newComment.trim(),
                  ...(videoUrl ? { videoUrl, videoDuration } : {}),
                });
                setVideoUrl(null);
                setVideoDuration(0);
              }
            }}
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-[#4573D2] text-xs text-white">
                {session?.user?.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) ?? "U"}
              </AvatarFallback>
            </Avatar>
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment... (press Enter)"
              className="h-8 text-sm"
            />
            <VideoRecorder
              onRecorded={(url, dur) => {
                setVideoUrl(url);
                setVideoDuration(dur);
                setNewComment((prev) =>
                  prev || "Video message"
                );
              }}
            />
          </form>
          {videoUrl && (
            <div className="ml-10 mt-1 flex items-center gap-2">
              <video
                src={videoUrl}
                className="h-10 w-16 rounded bg-black object-cover"
              />
              <span className="text-xs text-muted-foreground">
                Video attached
              </span>
              <button
                onClick={() => {
                  setVideoUrl(null);
                  setVideoDuration(0);
                }}
                className="text-xs text-red-500 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Image Proofing Overlay */}
      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <button
              className="absolute -top-8 right-0 text-white hover:text-gray-300"
              onClick={() => setLightboxUrl(null)}
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={lightboxUrl}
              alt="Preview"
              className="max-h-[85vh] max-w-[85vw] rounded object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {proofingAttachment && (
        <ImageProofing
          attachmentId={proofingAttachment.id}
          imageUrl={proofingAttachment.url}
          fileName={proofingAttachment.name}
          onClose={() => setProofingAttachment(null)}
        />
      )}
    </div>
  );
}
