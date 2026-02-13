"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Plus, Trash2, Power, History, AlertCircle, CheckCircle, XCircle, SkipForward } from "lucide-react";

interface RulesManagerProps {
  projectId: string;
}

const TRIGGER_TYPES = [
  { value: "TASK_ADDED", label: "Task added to project" },
  { value: "TASK_MOVED", label: "Task moved to section" },
  { value: "TASK_COMPLETED", label: "Task completed" },
  { value: "TASK_STATUS_CHANGED", label: "Task status changed" },
  { value: "TASK_ASSIGNED", label: "Task assigned" },
  { value: "FIELD_CHANGED", label: "Field changed" },
  { value: "CUSTOM_FIELD_CHANGED", label: "Custom field changed" },
  { value: "DUE_DATE_APPROACHING", label: "Due date approaching" },
] as const;

const ACTION_TYPES = [
  { value: "SET_ASSIGNEE", label: "Set assignee" },
  { value: "MOVE_TO_SECTION", label: "Move to section" },
  { value: "SET_STATUS", label: "Set status" },
  { value: "COMPLETE_TASK", label: "Complete task" },
  { value: "ADD_COMMENT", label: "Add comment" },
  { value: "ADD_TAG", label: "Add tag" },
  { value: "SET_DUE_DATE", label: "Set due date (days from now)" },
  { value: "SET_CUSTOM_FIELD", label: "Set custom field" },
  { value: "SEND_NOTIFICATION", label: "Send notification" },
] as const;

const CONDITION_FIELDS = [
  { value: "status", label: "Status" },
  { value: "assignee", label: "Assignee" },
  { value: "section", label: "Section" },
  { value: "title", label: "Title" },
  { value: "dueDate", label: "Due date" },
  { value: "tags", label: "Tags" },
] as const;

const CONDITION_OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
] as const;

type TriggerType = (typeof TRIGGER_TYPES)[number]["value"];
type ActionType = (typeof ACTION_TYPES)[number]["value"];

const TRIGGER_BADGE_COLORS: Record<string, string> = {
  TASK_ADDED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  TASK_MOVED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300",
  TASK_COMPLETED: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300",
  TASK_STATUS_CHANGED: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300",
  TASK_ASSIGNED: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300",
  FIELD_CHANGED: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  CUSTOM_FIELD_CHANGED: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300",
  DUE_DATE_APPROACHING: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300",
};

function getTriggerLabel(value: string): string {
  return TRIGGER_TYPES.find((t) => t.value === value)?.label ?? value;
}

function getActionLabel(value: string): string {
  return ACTION_TYPES.find((a) => a.value === value)?.label ?? value;
}

interface ConditionRow {
  field: string;
  operator: string;
  value: string;
}

interface ActionRow {
  type: string;
  config: string;
}

export function RulesManager({ projectId }: RulesManagerProps) {
  const utils = trpc.useUtils();

  const { data: rules, isLoading } = trpc.rules.list.useQuery({ projectId });
  const { data: executionLogs } = trpc.rules.executionLogs.useQuery({ projectId, limit: 50 });

  const createRule = trpc.rules.create.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate({ projectId });
      resetForm();
      setDialogOpen(false);
    },
  });

  const toggleRule = trpc.rules.toggle.useMutation({
    onSuccess: () => utils.rules.list.invalidate({ projectId }),
  });

  const deleteRule = trpc.rules.delete.useMutation({
    onSuccess: () => utils.rules.list.invalidate({ projectId }),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType | "">("");
  const [actions, setActions] = useState<ActionRow[]>([{ type: "", config: "" }]);
  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [conditionLogic, setConditionLogic] = useState<"AND" | "OR">("AND");

  function resetForm() {
    setRuleName("");
    setTriggerType("");
    setActions([{ type: "", config: "" }]);
    setConditions([]);
    setConditionLogic("AND");
  }

  function addAction() {
    setActions([...actions, { type: "", config: "" }]);
  }

  function removeAction(index: number) {
    setActions(actions.filter((_, i) => i !== index));
  }

  function updateAction(index: number, field: "type" | "config", value: string) {
    const updated = [...actions];
    updated[index] = { ...updated[index]!, [field]: value };
    setActions(updated);
  }

  function addCondition() {
    setConditions([...conditions, { field: "", operator: "equals", value: "" }]);
  }

  function removeCondition(index: number) {
    setConditions(conditions.filter((_, i) => i !== index));
  }

  function updateCondition(index: number, field: keyof ConditionRow, value: string) {
    const updated = [...conditions];
    updated[index] = { ...updated[index]!, [field]: value };
    setConditions(updated);
  }

  function handleCreate() {
    if (!ruleName.trim() || !triggerType || !actions[0]?.type) return;

    const validActions = actions.filter((a) => a.type);

    createRule.mutate({
      projectId,
      name: ruleName.trim(),
      trigger: { type: triggerType },
      conditions: conditions.length > 0
        ? { logic: conditionLogic, conditions: conditions.filter((c) => c.field && c.operator) }
        : undefined,
      actions: validActions.map((a) => ({
        type: a.type as ActionType,
        config: a.config.trim() || undefined,
      })),
    });
  }

  const isFormValid = ruleName.trim() && triggerType && actions.some((a) => a.type);

  if (isLoading) {
    return (
      <div className="space-y-3 p-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-pink-500">
            <Zap className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1e1f21] dark:text-gray-100">Rules</h2>
            <p className="text-xs text-[#6d6e6f] dark:text-gray-400">Automate your workflow with custom rules</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-1.5 bg-[#4573D2] text-white hover:bg-[#3a63b8]">
          <Plus className="h-3.5 w-3.5" />
          Create rule
        </Button>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Rules ({rules?.length || 0})</TabsTrigger>
          <TabsTrigger value="log">Execution Log</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4">
          {!rules || rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-16 dark:border-gray-800 dark:bg-gray-900/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <Zap className="h-6 w-6 text-[#6d6e6f] dark:text-gray-400" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-[#1e1f21] dark:text-gray-200">No rules yet</h3>
              <p className="mb-5 max-w-sm text-center text-xs text-[#6d6e6f] dark:text-gray-400">
                Rules let you automate repetitive actions. When a trigger fires, the action runs automatically.
              </p>
              <Button onClick={() => setDialogOpen(true)} variant="outline" size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Create your first rule
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={cn(
                    "group relative rounded-lg border bg-white p-4 transition-all hover:shadow-sm dark:bg-gray-950",
                    rule.isActive
                      ? "border-gray-200 dark:border-gray-800"
                      : "border-gray-100 bg-gray-50/50 opacity-60 dark:border-gray-800/50 dark:bg-gray-900/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2.5">
                        <Power className={cn("h-4 w-4 shrink-0", rule.isActive ? "text-emerald-500" : "text-[#cfcbcb] dark:text-gray-600")} />
                        <span className="truncate text-sm font-medium text-[#1e1f21] dark:text-gray-100">{rule.name}</span>
                        {(rule as any)._count?.executionLogs > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {(rule as any)._count.executionLogs} runs
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-6.5">
                        <Badge variant="outline" className={cn("text-[11px] font-medium", TRIGGER_BADGE_COLORS[(rule.trigger as any)?.type] ?? "bg-gray-50 text-gray-600 border-gray-200")}>
                          {getTriggerLabel((rule.trigger as any)?.type)}
                        </Badge>
                        {/* Show conditions count */}
                        {(rule.conditions as any)?.conditions?.length > 0 && (
                          <>
                            <span className="text-[11px] text-[#6d6e6f]">if</span>
                            <Badge variant="outline" className="text-[11px] font-medium bg-purple-50 text-purple-700 border-purple-200">
                              {(rule.conditions as any).conditions.length} condition{(rule.conditions as any).conditions.length > 1 ? "s" : ""}
                            </Badge>
                          </>
                        )}
                        <span className="text-[11px] text-[#6d6e6f] dark:text-gray-500">then</span>
                        {((rule.actions as any) || []).map((action: any, i: number) => (
                          <Badge key={i} variant="secondary" className="text-[11px] font-medium">
                            {getActionLabel(action.type)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Switch checked={rule.isActive} onCheckedChange={() => toggleRule.mutate({ id: rule.id, isActive: !rule.isActive })} />
                      <Button variant="ghost" size="icon" onClick={() => deleteRule.mutate({ id: rule.id })} className="text-[#cfcbcb] opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          {!executionLogs || executionLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-12 dark:border-gray-800">
              <History className="mb-3 h-8 w-8 text-[#6d6e6f]" />
              <p className="text-sm text-[#6d6e6f]">No rule executions yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {executionLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                  {log.status === "SUCCESS" && <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />}
                  {log.status === "FAILED" && <XCircle className="h-4 w-4 shrink-0 text-red-500" />}
                  {log.status === "SKIPPED" && <SkipForward className="h-4 w-4 shrink-0 text-yellow-500" />}
                  {!["SUCCESS", "FAILED", "SKIPPED"].includes(log.status) && <AlertCircle className="h-4 w-4 shrink-0 text-gray-400" />}
                  <span className="truncate font-medium">{log.rule?.name || "Unknown rule"}</span>
                  <Badge variant={log.status === "SUCCESS" ? "default" : log.status === "FAILED" ? "destructive" : "secondary"} className="text-[10px]">
                    {log.status}
                  </Badge>
                  {log.message && <span className="truncate text-xs text-muted-foreground">{log.message}</span>}
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Rule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              Create rule
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Rule Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#6d6e6f]">Rule name</label>
              <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g., Auto-assign new tasks" className="h-9 text-sm" />
            </div>

            {/* Trigger */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#6d6e6f]">When this happens (Trigger)</label>
              <Select value={triggerType} onValueChange={(value) => setTriggerType(value as TriggerType)}>
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue placeholder="Select a trigger..." />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((trigger) => (
                    <SelectItem key={trigger.value} value={trigger.value}>{trigger.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#6d6e6f]">Conditions (optional)</label>
                <Button variant="ghost" size="sm" onClick={addCondition} className="h-6 gap-1 text-xs">
                  <Plus className="h-3 w-3" /> Add condition
                </Button>
              </div>
              {conditions.length > 1 && (
                <Select value={conditionLogic} onValueChange={(v) => setConditionLogic(v as "AND" | "OR")}>
                  <SelectTrigger className="h-7 w-20 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">AND</SelectItem>
                    <SelectItem value="OR">OR</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {conditions.map((cond, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select value={cond.field} onValueChange={(v) => updateCondition(i, "field", v)}>
                    <SelectTrigger className="h-8 w-28 text-xs">
                      <SelectValue placeholder="Field" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={cond.operator} onValueChange={(v) => updateCondition(i, "operator", v)}>
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPERATORS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!["is_empty", "is_not_empty"].includes(cond.operator) && (
                    <Input value={cond.value} onChange={(e) => updateCondition(i, "value", e.target.value)} placeholder="Value" className="h-8 flex-1 text-xs" />
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCondition(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#6d6e6f]">Do this (Actions)</label>
                <Button variant="ghost" size="sm" onClick={addAction} className="h-6 gap-1 text-xs">
                  <Plus className="h-3 w-3" /> Add action
                </Button>
              </div>
              {actions.map((action, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select value={action.type} onValueChange={(v) => updateAction(i, "type", v)}>
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue placeholder="Select action..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((a) => (
                        <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {action.type && action.type !== "COMPLETE_TASK" && (
                    <Input value={action.config} onChange={(e) => updateAction(i, "config", e.target.value)} placeholder="Configuration value..." className="h-8 flex-1 text-xs" />
                  )}
                  {actions.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAction(i)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { resetForm(); setDialogOpen(false); }}>Cancel</Button>
            <Button size="sm" disabled={!isFormValid || createRule.isPending} onClick={handleCreate} className="gap-1.5 bg-[#4573D2] text-white hover:bg-[#3a63b8]">
              {createRule.isPending ? "Creating..." : "Create rule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
