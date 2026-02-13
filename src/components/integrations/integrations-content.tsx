"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plug,
  MessageSquare,
  Video,
  FolderOpen,
  GitBranch,
  Zap,
  Mail,
  CalendarDays,
  Shield,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const INTEGRATIONS = [
  {
    type: "SLACK" as const,
    name: "Slack",
    description: "Send task notifications to Slack channels via webhook.",
    icon: MessageSquare,
    color: "#4A154B",
    configFields: ["webhookUrl"],
    helpText: "Paste your Slack Incoming Webhook URL. Notifications will be sent when tasks are created, completed, or assigned.",
  },
  {
    type: "GITHUB" as const,
    name: "GitHub",
    description: "Link repos, close issues when tasks complete.",
    icon: GitBranch,
    color: "#24292F",
    configFields: ["webhookUrl", "apiKey"],
    helpText: "Enter your GitHub Personal Access Token and optionally a repo webhook URL. Completing linked tasks can auto-close GitHub issues.",
  },
  {
    type: "CALENDAR" as const,
    name: "Google Calendar",
    description: "Sync task due dates as calendar events via iCal feed.",
    icon: CalendarDays,
    color: "#16a34a",
    configFields: [] as string[],
    helpText: "Generate an iCal feed URL and add it to Google Calendar, Outlook, or any calendar app that supports iCal subscriptions.",
  },
  {
    type: "TEAMS" as const,
    name: "Microsoft Teams",
    description: "Receive task updates in Teams channels.",
    icon: Video,
    color: "#6264A7",
    configFields: ["webhookUrl"],
    helpText: "Configure an incoming webhook in Teams and paste the URL here.",
  },
  {
    type: "GOOGLE_DRIVE" as const,
    name: "Google Drive",
    description: "Attach Drive files to tasks and auto-sync documents.",
    icon: FolderOpen,
    color: "#4285F4",
    configFields: ["apiKey"],
    helpText: "Enter your Google API key to enable Drive file attachments.",
  },
  {
    type: "ZAPIER" as const,
    name: "Zapier",
    description: "Connect to 5,000+ apps with automated workflows.",
    icon: Zap,
    color: "#FF4A00",
    configFields: ["apiKey"],
    helpText: "Use the API key to connect TaskFlow with Zapier triggers and actions.",
  },
  {
    type: "GITLAB" as const,
    name: "GitLab",
    description: "Connect merge requests and pipelines to tasks.",
    icon: GitBranch,
    color: "#FC6D26",
    configFields: ["webhookUrl", "apiKey"],
    helpText: "Enter your GitLab token and webhook URL.",
  },
  {
    type: "EMAIL" as const,
    name: "Email to Task",
    description: "Forward emails to create tasks automatically.",
    icon: Mail,
    color: "#4573D2",
    configFields: [] as string[],
    helpText: "Enable to get a unique email address for creating tasks via email.",
  },
];

export function IntegrationsContent() {
  const { data: workspaces } = trpc.workspaces.list.useQuery();
  const workspaceId = workspaces?.[0]?.id;

  const { data: integrations } = trpc.integrations.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );

  const utils = trpc.useUtils();

  const upsertIntegration = trpc.integrations.upsert.useMutation({
    onSuccess: () => {
      utils.integrations.list.invalidate();
      toast.success("Integration saved");
      setConfigDialog(null);
    },
  });

  const toggleActive = trpc.integrations.toggleActive.useMutation({
    onSuccess: (data) => {
      utils.integrations.list.invalidate();
      toast.success(data.isActive ? "Integration enabled" : "Integration paused");
    },
  });

  const deleteIntegration = trpc.integrations.delete.useMutation({
    onSuccess: () => {
      utils.integrations.list.invalidate();
      toast.success("Integration disconnected");
    },
  });

  const testConnection = trpc.integrations.testConnection.useMutation();

  const generateApiKey = trpc.integrations.generateApiKey.useMutation({
    onSuccess: (data) => {
      setGeneratedApiKey(data.apiKey);
      toast.success("API key generated");
    },
  });

  const generateCalendarToken = trpc.integrations.generateCalendarToken.useMutation({
    onSuccess: (data) => {
      setCalendarFeedUrl(data.feedUrl);
      toast.success("Calendar feed URL generated");
    },
  });

  const [configDialog, setConfigDialog] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [generatedApiKey, setGeneratedApiKey] = useState("");
  const [calendarFeedUrl, setCalendarFeedUrl] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const getIntegration = (type: string) =>
    integrations?.find((i) => i.type === type);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleConnect = (type: string) => {
    const def = INTEGRATIONS.find((i) => i.type === type);
    if (!def || !workspaceId) return;

    if (type === "CALENDAR") {
      generateCalendarToken.mutate({ workspaceId });
      setConfigDialog(type);
      return;
    }

    if (type === "EMAIL") {
      upsertIntegration.mutate({
        workspaceId,
        type,
        name: def.name,
        config: {},
      });
      return;
    }

    if (def.configFields.length === 0) {
      upsertIntegration.mutate({ workspaceId, type, name: def.name, config: {} });
    } else {
      // Pre-fill existing config
      const existing = getIntegration(type);
      const existingConfig = existing?.config as Record<string, string> | null;
      setWebhookUrl(existingConfig?.webhookUrl ?? "");
      setApiKey(existingConfig?.apiKey ?? "");
      setTestResult(null);
      setConfigDialog(type);
    }
  };

  const handleSaveConfig = () => {
    if (!configDialog || !workspaceId) return;

    const config: Record<string, string> = {};
    if (webhookUrl) config.webhookUrl = webhookUrl;
    if (apiKey) config.apiKey = apiKey;

    const name = currentConfig?.name ?? configDialog;
    upsertIntegration.mutate({
      workspaceId,
      type: configDialog,
      name,
      config,
    });
  };

  const handleTest = () => {
    if (!configDialog || !workspaceId) return;
    setTestResult(null);
    testConnection.mutate(
      { workspaceId, type: configDialog },
      {
        onSuccess: (result) => setTestResult(result),
        onError: () => setTestResult({ success: false, message: "Test failed" }),
      }
    );
  };

  const currentConfig = configDialog
    ? INTEGRATIONS.find((i) => i.type === configDialog)
    : null;

  return (
    <div className="h-full">
      <div className="flex h-14 items-center justify-between border-b bg-white px-6 dark:bg-card">
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-[#4573D2]" />
          <h1 className="text-lg font-medium text-[#1e1f21] dark:text-foreground">
            Integrations
          </h1>
        </div>
      </div>

      <div className="p-6">
        <p className="mb-6 text-sm text-muted-foreground">
          Connect your favorite tools to streamline your workflow.
        </p>

        {/* SSO/SAML Banner */}
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800/30 dark:bg-blue-950/20">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
              SSO / SAML
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Enterprise single sign-on with SAML 2.0 is available on the
            Enterprise plan.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATIONS.map((integration) => {
            const existing = getIntegration(integration.type);
            const isConnected = !!existing;
            const isActive = existing?.isActive ?? false;

            return (
              <div
                key={integration.type}
                className={cn(
                  "rounded-lg border bg-white p-4 transition-shadow hover:shadow-sm dark:bg-card",
                  isConnected && !isActive && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: integration.color + "15" }}
                    >
                      <integration.icon
                        className="h-5 w-5"
                        style={{ color: integration.color }}
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">
                        {integration.name}
                      </h3>
                      {isConnected && (
                        <div className="flex items-center gap-1">
                          {isActive ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-gray-400" />
                          )}
                          <span className={cn("text-xs", isActive ? "text-green-600" : "text-gray-400")}>
                            {isActive ? "Active" : "Paused"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Enable/Disable Toggle */}
                  {isConnected && (
                    <button
                      onClick={() => toggleActive.mutate({ id: existing.id, isActive: !isActive })}
                      className="text-muted-foreground hover:text-foreground"
                      title={isActive ? "Pause integration" : "Enable integration"}
                    >
                      {isActive ? (
                        <ToggleRight className="h-6 w-6 text-green-500" />
                      ) : (
                        <ToggleLeft className="h-6 w-6" />
                      )}
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {integration.description}
                </p>
                <div className="mt-3 flex gap-2">
                  {isConnected ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => handleConnect(integration.type)}
                      >
                        Settings
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-destructive hover:text-destructive"
                        onClick={() => deleteIntegration.mutate({ id: existing.id })}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => handleConnect(integration.type)}
                    >
                      <ExternalLink className="mr-1.5 h-3 w-3" />
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* API Key section */}
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-medium">API Access</h2>
          <div className="rounded-lg border bg-white p-4 dark:bg-card">
            <p className="text-xs text-muted-foreground">
              Generate an API key for programmatic access to your workspace data.
            </p>
            {generatedApiKey ? (
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-xs">
                  {generatedApiKey}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => copyToClipboard(generatedApiKey, "apiKey")}
                >
                  {copiedField === "apiKey" ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  if (workspaceId) generateApiKey.mutate({ workspaceId });
                }}
              >
                Generate API Key
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Config Dialog */}
      <Dialog
        open={!!configDialog}
        onOpenChange={(open) => !open && setConfigDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {currentConfig && (
                <>
                  <currentConfig.icon
                    className="h-5 w-5"
                    style={{ color: currentConfig.color }}
                  />
                  {currentConfig.name}
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {configDialog === "CALENDAR" && calendarFeedUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Add this iCal feed URL to Google Calendar, Outlook, or any calendar app:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-xs break-all">
                  {calendarFeedUrl}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => copyToClipboard(calendarFeedUrl, "calendar")}
                >
                  {copiedField === "calendar" ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Task due dates will appear as all-day events. The feed updates automatically.
              </p>
              <Button className="w-full" onClick={() => setConfigDialog(null)}>
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Help text */}
              {currentConfig?.helpText && (
                <p className="text-xs text-muted-foreground">
                  {currentConfig.helpText}
                </p>
              )}

              {currentConfig?.configFields.includes("webhookUrl") && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Webhook URL</label>
                  <Input
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://hooks.example.com/..."
                    className="text-sm"
                  />
                </div>
              )}
              {currentConfig?.configFields.includes("apiKey") && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {configDialog === "GITHUB" ? "Personal Access Token" : "API Key / Token"}
                  </label>
                  <Input
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={configDialog === "GITHUB" ? "ghp_..." : "Enter API key or token"}
                    className="text-sm"
                    type="password"
                  />
                </div>
              )}

              {/* Test result */}
              {testResult && (
                <div className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-xs",
                  testResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                )}>
                  {testResult.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  {testResult.message}
                </div>
              )}

              <div className="flex justify-between gap-2">
                {/* Test Connection button (only for connected integrations) */}
                {getIntegration(configDialog ?? "") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={testConnection.isPending}
                  >
                    {testConnection.isPending ? (
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    ) : null}
                    Test Connection
                  </Button>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" onClick={() => setConfigDialog(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveConfig}>
                    {getIntegration(configDialog ?? "") ? "Update" : "Connect"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
