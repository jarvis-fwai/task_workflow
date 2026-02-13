"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Inbox,
  FolderOpen,
  Calendar,
  Search,
  ListTodo,
  LayoutGrid,
  Bell,
  Plus,
} from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 text-gray-400 dark:bg-muted">
          {icon}
        </div>
      )}
      <h3 className="mb-1 text-base font-medium text-[#1e1f21] dark:text-foreground">{title}</h3>
      {description && (
        <p className="mb-4 max-w-sm text-sm text-[#6d6e6f] dark:text-muted-foreground">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function EmptyTaskList({ onAddTask }: { onAddTask?: () => void }) {
  return (
    <EmptyState
      icon={<ListTodo className="h-8 w-8" />}
      title="No tasks yet"
      description="Add a task to get started with your project."
      actionLabel="Add task"
      onAction={onAddTask}
    />
  );
}

export function EmptyBoard() {
  return (
    <EmptyState
      icon={<LayoutGrid className="h-8 w-8" />}
      title="No sections to display"
      description="Create sections to organize your tasks on this board."
    />
  );
}

export function EmptyCalendar() {
  return (
    <EmptyState
      icon={<Calendar className="h-8 w-8" />}
      title="No tasks with due dates"
      description="Tasks with due dates will show up on the calendar."
    />
  );
}

export function EmptyInbox() {
  return (
    <EmptyState
      icon={<Inbox className="h-8 w-8" />}
      title="You're all caught up!"
      description="Nice work. Notifications about your tasks and projects will appear here."
    />
  );
}

export function EmptySearch() {
  return (
    <EmptyState
      icon={<Search className="h-8 w-8" />}
      title="No results found"
      description="Try a different search term or adjust your filters."
    />
  );
}

export function EmptyMyTasks({ onAddTask }: { onAddTask?: () => void }) {
  return (
    <EmptyState
      icon={<CheckCircle2 className="h-8 w-8" />}
      title="No tasks assigned to you"
      description="Tasks assigned to you will appear here. Stay organized!"
      actionLabel="Create task"
      onAction={onAddTask}
    />
  );
}

export function EmptyProject() {
  return (
    <EmptyState
      icon={<FolderOpen className="h-8 w-8" />}
      title="Start building your project"
      description="Add tasks and organize them into sections to track your work."
    />
  );
}

export function EmptyNotifications() {
  return (
    <EmptyState
      icon={<Bell className="h-8 w-8" />}
      title="No notifications"
      description="You'll be notified when someone mentions you or updates your tasks."
    />
  );
}
