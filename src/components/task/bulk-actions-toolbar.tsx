"use client";

import { useState } from "react";
import { useBulkSelection } from "@/contexts/bulk-selection-context";
import { useUndo } from "@/contexts/undo-context";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X,
  CheckCircle2,
  Trash2,
  UserPlus,
  CalendarDays,
  ArrowRightLeft,
  FolderOpen,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface BulkActionsToolbarProps {
  projectId: string;
  sections?: Array<{ id: string; name: string }>;
}

const STATUSES = [
  { value: "INCOMPLETE" as const, label: "Incomplete" },
  { value: "COMPLETE" as const, label: "Complete" },
];

export function BulkActionsToolbar({
  projectId,
  sections,
}: BulkActionsToolbarProps) {
  const { selectedTaskIds, clearSelection, count } = useBulkSelection();
  const { pushUndo } = useUndo();
  const [dueDate, setDueDate] = useState("");
  const utils = trpc.useUtils();

  const invalidateAll = () => {
    utils.tasks.list.invalidate({ projectId });
    utils.tasks.myTasks.invalidate();
    utils.tasks.get.invalidate();
  };

  const bulkUpdate = trpc.tasks.bulkUpdate.useMutation({
    onSuccess: () => {
      invalidateAll();
      clearSelection();
    },
  });

  const bulkDelete = trpc.tasks.bulkDelete.useMutation({
    onSuccess: () => {
      invalidateAll();
      clearSelection();
      toast.success(`${count} tasks deleted`);
    },
  });

  const bulkMove = trpc.tasks.bulkMove.useMutation({
    onSuccess: () => {
      invalidateAll();
      clearSelection();
      toast.success("Tasks moved");
    },
  });

  if (count === 0) return null;

  const taskIds = Array.from(selectedTaskIds);

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform animate-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-xl dark:border-gray-700 dark:bg-card">
        <span className="mr-2 text-sm font-semibold text-[#1e1f21] dark:text-foreground">
          {count} task{count > 1 ? "s" : ""} selected
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={clearSelection}
        >
          <X className="h-3 w-3" />
        </Button>
        <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-600" />

        {/* Complete */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => {
            bulkUpdate.mutate({ taskIds, status: "COMPLETE" });
            pushUndo(`${count} tasks completed`, () => {
              bulkUpdate.mutate({ taskIds, status: "INCOMPLETE" });
            });
          }}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          Complete
        </Button>

        {/* Set Status */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <FolderOpen className="h-3.5 w-3.5" />
              Status
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="center">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                className="w-full rounded px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-muted"
                onClick={() => {
                  bulkUpdate.mutate({ taskIds, status: s.value });
                  pushUndo(`Status set to ${s.label}`, () => {
                    bulkUpdate.mutate({ taskIds, status: "INCOMPLETE" });
                  });
                }}
              >
                {s.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Due Date */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <CalendarDays className="h-3.5 w-3.5" />
              Due date
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="center">
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              className="mt-2 w-full"
              onClick={() => {
                if (dueDate) {
                  bulkUpdate.mutate({
                    taskIds,
                    dueDate: new Date(dueDate).toISOString(),
                  });
                  pushUndo("Due dates updated", () => {
                    bulkUpdate.mutate({ taskIds, dueDate: null });
                  });
                  setDueDate("");
                }
              }}
            >
              Apply
            </Button>
          </PopoverContent>
        </Popover>

        {/* Move to section */}
        {sections && sections.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Move
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="center">
              {sections.map((section) => (
                <button
                  key={section.id}
                  className="w-full rounded px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-muted"
                  onClick={() => {
                    bulkMove.mutate({ taskIds, projectId, sectionId: section.id });
                    pushUndo(`Tasks moved to ${section.name}`, () => {
                      // Can't easily undo move without storing previous sections
                      toast.info("Undo move not available for this action");
                    });
                  }}
                >
                  {section.name}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}

        {/* Delete */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => {
            if (confirm(`Delete ${count} task${count > 1 ? "s" : ""}?`)) {
              bulkDelete.mutate({ taskIds });
              pushUndo(`${count} tasks deleted`, () => {
                toast.info("Deleted tasks cannot be restored");
              });
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </div>
  );
}
