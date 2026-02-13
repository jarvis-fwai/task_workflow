"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Zap,
  Plus,
  Play,
  Pause,
  Trash2,
  History,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { FormBuilder } from "@/components/forms/form-builder";

interface ProjectWorkflowViewProps {
  projectId: string;
}

const RULE_TEMPLATES = [
  {
    name: "Auto-assign on move to In Progress",
    trigger: { type: "TASK_MOVED" as const },
    actions: [{ type: "SET_ASSIGNEE" as const, config: "" }],
  },
  {
    name: "Complete when moved to Done",
    trigger: { type: "TASK_MOVED" as const },
    actions: [{ type: "COMPLETE_TASK" as const, config: "" }],
  },
  {
    name: "Add comment on task creation",
    trigger: { type: "TASK_ADDED" as const },
    actions: [{ type: "ADD_COMMENT" as const, config: "Welcome! Please review the task description." }],
  },
  {
    name: "Set due date on task creation",
    trigger: { type: "TASK_ADDED" as const },
    actions: [{ type: "SET_DUE_DATE" as const, config: "7" }],
  },
];

export function ProjectWorkflowView({ projectId }: ProjectWorkflowViewProps) {
  const [showTemplates, setShowTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: rules } = trpc.rules.list.useQuery({ projectId });
  const utils = trpc.useUtils();

  const createRule = trpc.rules.create.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate({ projectId });
      toast.success("Rule created");
    },
  });

  const toggleRule = trpc.rules.toggle.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate({ projectId });
    },
  });

  const deleteRule = trpc.rules.delete.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate({ projectId });
      toast.success("Rule deleted");
    },
  });

  const handleCreateFromTemplate = (template: (typeof RULE_TEMPLATES)[0]) => {
    createRule.mutate({
      projectId,
      name: template.name,
      trigger: template.trigger,
      actions: template.actions,
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-[#f59e0b]" />
          <h2 className="text-lg font-medium">Automation Rules</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="gap-1.5"
          >
            <History className="h-3.5 w-3.5" />
            History
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplates(!showTemplates)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add from templates
          </Button>
        </div>
      </div>

      {/* Templates */}
      {showTemplates && (
        <div className="mb-6 rounded-lg border bg-white p-4 dark:bg-card">
          <h3 className="mb-3 text-sm font-medium">Rule Templates</h3>
          <div className="grid grid-cols-2 gap-3">
            {RULE_TEMPLATES.map((template) => (
              <button
                key={template.name}
                onClick={() => handleCreateFromTemplate(template)}
                className="rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#f59e0b]" />
                  <span className="text-sm font-medium">{template.name}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Trigger: {template.trigger.type.replace(/_/g, " ").toLowerCase()}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="space-y-3">
        {rules?.map((rule) => {
          const trigger = rule.trigger as { type: string };
          const actions = rule.actions as Array<{
            type: string;
            config?: string;
          }>;

          return (
            <div
              key={rule.id}
              className={cn(
                "rounded-lg border bg-white p-4 dark:bg-card",
                !rule.isActive && "opacity-60"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap
                    className={cn(
                      "h-4 w-4",
                      rule.isActive ? "text-[#f59e0b]" : "text-muted-foreground"
                    )}
                  />
                  <div>
                    <h4 className="text-sm font-medium">{rule.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      When: {trigger.type.replace(/_/g, " ").toLowerCase()} &rarr;{" "}
                      {actions
                        .map((a) => a.type.replace(/_/g, " ").toLowerCase())
                        .join(", ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() =>
                      toggleRule.mutate({
                        id: rule.id,
                        isActive: !rule.isActive,
                      })
                    }
                    title={rule.isActive ? "Pause rule" : "Activate rule"}
                  >
                    {rule.isActive ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => deleteRule.mutate({ id: rule.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Multi-step actions */}
              {actions.length > 1 && (
                <div className="mt-3 ml-7 space-y-1 border-l-2 border-dashed border-muted pl-3">
                  {actions.map((action, i) => (
                    <div key={i} className="text-xs text-muted-foreground">
                      Step {i + 1}: {action.type.replace(/_/g, " ").toLowerCase()}
                      {action.config ? ` (${action.config})` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {(!rules || rules.length === 0) && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Zap className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No automation rules yet. Add one from templates above.
            </p>
          </div>
        )}
      </div>

      {/* Forms Section */}
      <div className="mt-8">
        <FormBuilder projectId={projectId} />
      </div>
    </div>
  );
}
