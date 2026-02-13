"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { exportReportToCsv } from "@/lib/export";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Bookmark,
  Download,
  Trash2,
  Plus,
  LayoutDashboard,
  Pencil,
  GripVertical,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = {
  blue: "#4573D2",
  green: "#22C55E",
  yellow: "#FBBF24",
  red: "#EF4444",
  purple: "#8B5CF6",
  orange: "#F97316",
};

const CHART_COLORS = ["#4573D2", "#22C55E", "#FBBF24", "#EF4444", "#8B5CF6", "#F97316", "#EC4899", "#14B8A6"];

type DateRange = "this_week" | "this_month" | "this_quarter" | "all";
type ViewMode = "overview" | "dashboards";

interface WidgetConfig {
  id: string;
  type: string;
  title: string;
  chartType: "bar" | "line" | "pie" | "number" | "table" | "burndown" | "area";
  size: "sm" | "md" | "lg";
}

const DASHBOARD_TEMPLATES: { name: string; description: string; widgets: WidgetConfig[] }[] = [
  {
    name: "Project Status",
    description: "Overview of task status across projects",
    widgets: [
      { id: "1", type: "task_count", title: "Total Tasks", chartType: "number", size: "sm" },
      { id: "2", type: "completed_count", title: "Completed", chartType: "number", size: "sm" },
      { id: "3", type: "overdue_count", title: "Overdue", chartType: "number", size: "sm" },
      { id: "4", type: "completion_rate", title: "Completion Rate", chartType: "number", size: "sm" },
      { id: "5", type: "tasks_by_status", title: "Tasks by Status", chartType: "pie", size: "md" },
      { id: "6", type: "tasks_by_project", title: "Tasks by Project", chartType: "bar", size: "md" },
    ],
  },
  {
    name: "Workload",
    description: "Team member task distribution",
    widgets: [
      { id: "1", type: "task_count", title: "Total Tasks", chartType: "number", size: "sm" },
      { id: "2", type: "tasks_by_assignee", title: "Tasks by Assignee", chartType: "bar", size: "lg" },
      { id: "3", type: "overdue_count", title: "Overdue Tasks", chartType: "number", size: "sm" },
    ],
  },
  {
    name: "Task Completion",
    description: "Completion trends and velocity",
    widgets: [
      { id: "1", type: "completion_rate", title: "Completion Rate", chartType: "number", size: "sm" },
      { id: "2", type: "completed_count", title: "Completed This Period", chartType: "number", size: "sm" },
      { id: "3", type: "velocity", title: "Weekly Velocity", chartType: "line", size: "md" },
      { id: "4", type: "tasks_by_status", title: "Status Breakdown", chartType: "pie", size: "md" },
    ],
  },
  {
    name: "Burndown",
    description: "Track progress against deadlines",
    widgets: [
      { id: "1", type: "task_count", title: "Total Tasks", chartType: "number", size: "sm" },
      { id: "2", type: "overdue_count", title: "Overdue", chartType: "number", size: "sm" },
      { id: "3", type: "burndown", title: "Burndown Chart", chartType: "burndown", size: "lg" },
    ],
  },
];

export function ReportingContent() {
  const { data: workspaces } = trpc.workspaces.list.useQuery();
  const workspaceId = workspaces?.[0]?.id;
  const [dateRange, setDateRange] = useState<DateRange>("this_month");
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [createDashOpen, setCreateDashOpen] = useState(false);
  const [dashName, setDashName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(0);

  const { data: dashboards } = trpc.dashboards.list.useQuery(
    { workspaceId: workspaceId },
    { enabled: !!workspaceId }
  );

  const [activeDashId, setActiveDashId] = useState<string | null>(null);
  const { data: activeDash } = trpc.dashboards.get.useQuery(
    { id: activeDashId! },
    { enabled: !!activeDashId }
  );

  const utils = trpc.useUtils();

  const createDashboard = trpc.dashboards.create.useMutation({
    onSuccess: (data) => {
      utils.dashboards.list.invalidate();
      setCreateDashOpen(false);
      setActiveDashId(data.id);
      setViewMode("dashboards");
      toast.success("Dashboard created");
    },
  });

  const deleteDashboard = trpc.dashboards.delete.useMutation({
    onSuccess: () => {
      utils.dashboards.list.invalidate();
      setActiveDashId(null);
      toast.success("Dashboard deleted");
    },
  });

  // Overview data
  const { data: tasksByStatus } = trpc.reporting.getTasksByStatus.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId && viewMode === "overview" }
  );
  const { data: projectStats } = trpc.reporting.getProjectStats.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId && viewMode === "overview" }
  );
  const { data: weeklyActivity } = trpc.reporting.getWeeklyActivity.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId && viewMode === "overview" }
  );

  const totalTasks = tasksByStatus?.total ?? 0;
  const completedTasks = tasksByStatus?.completed ?? 0;
  const inProgressTasks = tasksByStatus?.incomplete ?? 0;
  const overdueTasks = tasksByStatus?.overdue ?? 0;

  const pieData = [
    { name: "Completed", value: completedTasks, color: COLORS.green },
    { name: "On Track", value: tasksByStatus?.onTrack ?? 0, color: COLORS.blue },
    { name: "Overdue", value: overdueTasks, color: COLORS.red },
  ].filter((d) => d.value > 0);

  const barData = projectStats?.map((p) => ({
    name: p.projectName.length > 12 ? p.projectName.slice(0, 12) + "..." : p.projectName,
    Completed: p.completed,
    Incomplete: p.incomplete,
    Overdue: p.overdue,
  })) ?? [];

  const burnupData = (() => {
    if (!weeklyActivity || weeklyActivity.length === 0) return [];
    let cc = 0, ccomp = 0;
    return weeklyActivity.map((d) => {
      cc += d.created;
      ccomp += d.completed;
      return { day: d.day, "Tasks Created": cc, "Tasks Completed": ccomp };
    });
  })();

  const handleCreateDashboard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dashName.trim()) return;
    const template = DASHBOARD_TEMPLATES[selectedTemplate]!;
    createDashboard.mutate({
      name: dashName.trim(),
      layout: {},
      widgets: template.widgets,
    });
  };

  const handleExportCsv = () => {
    const data = [
      { metric: "Total Tasks", value: totalTasks },
      { metric: "Completed", value: completedTasks },
      { metric: "In Progress", value: inProgressTasks },
      { metric: "Overdue", value: overdueTasks },
    ];
    exportReportToCsv(data, "workspace-report");
    toast.success("Report exported as CSV");
  };

  const activeWidgets = activeDash ? (activeDash.widgets as unknown as WidgetConfig[]) : null;

  return (
    <div className="h-full">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b bg-white px-6 dark:bg-card">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-[#4573D2]" />
          <h1 className="text-lg font-medium text-[#1e1f21] dark:text-foreground">Reporting</h1>
          <div className="ml-4 flex rounded-md border bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-3 text-xs ${viewMode === "overview" ? "bg-white shadow-sm dark:bg-card" : ""}`}
              onClick={() => setViewMode("overview")}
            >
              Overview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-3 text-xs ${viewMode === "dashboards" ? "bg-white shadow-sm dark:bg-card" : ""}`}
              onClick={() => setViewMode("dashboards")}
            >
              Dashboards
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">This week</SelectItem>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="this_quarter">This quarter</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <Button size="sm" className="gap-1.5 bg-[#4573D2] hover:bg-[#3A63B8] text-xs" onClick={() => setCreateDashOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New Dashboard
          </Button>
        </div>
      </div>

      {/* Dashboards View */}
      {viewMode === "dashboards" && (
        <div className="p-6">
          {/* Dashboard selector */}
          <div className="mb-6 flex flex-wrap gap-2">
            {dashboards?.map((d) => (
              <div key={d.id} className="flex items-center gap-1">
                <Button
                  variant={activeDashId === d.id ? "default" : "outline"}
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => setActiveDashId(d.id)}
                >
                  <LayoutDashboard className="h-3 w-3" />
                  {d.name}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={() => {
                    if (window.confirm(`Delete dashboard "${d.name}"?`)) {
                      deleteDashboard.mutate({ id: d.id });
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {(!dashboards || dashboards.length === 0) && (
              <p className="text-sm text-muted-foreground">No dashboards yet. Create one from a template above.</p>
            )}
          </div>

          {/* Active dashboard widgets */}
          {activeWidgets && workspaceId && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {activeWidgets.map((widget) => (
                <DashboardWidget
                  key={widget.id}
                  widget={widget}
                  workspaceId={workspaceId}
                  dateRange={dateRange}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overview View */}
      {viewMode === "overview" && (
        <div className="p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard icon={<BarChart3 className="h-5 w-5 text-blue-600" />} value={totalTasks} label="Total tasks" bgColor="bg-blue-100 dark:bg-blue-900/30" />
            <SummaryCard icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} value={completedTasks} label="Completed" bgColor="bg-green-100 dark:bg-green-900/30" />
            <SummaryCard icon={<Clock className="h-5 w-5 text-yellow-600" />} value={inProgressTasks} label="In progress" bgColor="bg-yellow-100 dark:bg-yellow-900/30" />
            <SummaryCard icon={<AlertTriangle className="h-5 w-5 text-red-600" />} value={overdueTasks} label="Overdue" bgColor="bg-red-100 dark:bg-red-900/30" />
          </div>

          {/* Charts */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="border shadow-sm">
              <CardHeader><CardTitle className="text-base font-medium">Task completion breakdown</CardTitle></CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <EmptyChart icon={<CheckCircle2 />} text="No tasks yet" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value"
                        label={(p: any) => `${p.name} ${(p.percent * 100).toFixed(0)}%`}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader><CardTitle className="text-base font-medium">Tasks per project</CardTitle></CardHeader>
              <CardContent>
                {barData.length === 0 ? (
                  <EmptyChart icon={<BarChart3 />} text="Create projects to see overview" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={barData} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend iconType="circle" />
                      <Bar dataKey="Completed" fill={COLORS.green} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Incomplete" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Overdue" fill={COLORS.red} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="border shadow-sm">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base font-medium"><TrendingUp className="h-4 w-4" />Weekly activity</CardTitle></CardHeader>
              <CardContent>
                {!weeklyActivity || weeklyActivity.length === 0 ? (
                  <EmptyChart icon={<TrendingUp />} text="No activity data yet" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={weeklyActivity}>
                      <defs>
                        <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend iconType="circle" />
                      <Area type="monotone" dataKey="completed" name="Completed" stroke={COLORS.green} fill="url(#colorCompleted)" strokeWidth={2} />
                      <Area type="monotone" dataKey="created" name="Created" stroke={COLORS.blue} fill="url(#colorCreated)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader><CardTitle className="text-base font-medium">Burnup chart</CardTitle></CardHeader>
              <CardContent>
                {burnupData.length === 0 ? (
                  <EmptyChart icon={<TrendingUp />} text="No data to display yet" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={burnupData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend iconType="circle" />
                      <Line type="monotone" dataKey="Tasks Created" stroke={COLORS.yellow} strokeWidth={2} dot={{ r: 4, fill: COLORS.yellow }} />
                      <Line type="monotone" dataKey="Tasks Completed" stroke={COLORS.green} strokeWidth={2} dot={{ r: 4, fill: COLORS.green }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Create Dashboard Dialog */}
      <Dialog open={createDashOpen} onOpenChange={setCreateDashOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Create Dashboard</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateDashboard} className="space-y-4">
            <div className="space-y-2">
              <Label>Dashboard name</Label>
              <Input value={dashName} onChange={(e) => setDashName(e.target.value)} placeholder="My Dashboard" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              <div className="grid grid-cols-2 gap-2">
                {DASHBOARD_TEMPLATES.map((t, i) => (
                  <button
                    type="button"
                    key={i}
                    className={`rounded-lg border p-3 text-left transition-colors ${selectedTemplate === i ? "border-[#4573D2] bg-[#4573D2]/5" : "hover:bg-muted/50"}`}
                    onClick={() => setSelectedTemplate(i)}
                  >
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{t.widgets.length} widgets</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setCreateDashOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!dashName.trim()} className="bg-[#4573D2] hover:bg-[#3A63B8]">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "var(--color-card, #fff)",
  border: "1px solid var(--color-border, #e5e7eb)",
  borderRadius: "8px",
  fontSize: "13px",
};

function SummaryCard({ icon, value, label, bgColor }: { icon: React.ReactNode; value: number; label: string; bgColor: string }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bgColor}`}>{icon}</div>
          <div>
            <p className="text-2xl font-semibold text-[#1e1f21] dark:text-white">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center text-center">
      <div className="mb-2 text-muted-foreground/30 [&>svg]:h-8 [&>svg]:w-8">{icon}</div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

// Dashboard Widget that fetches its own data
function DashboardWidget({ widget, workspaceId, dateRange }: { widget: WidgetConfig; workspaceId: string; dateRange: DateRange }) {
  const { data, isLoading } = trpc.dashboards.getWidgetData.useQuery({
    workspaceId,
    widgetType: widget.type as any,
    dateRange,
  });

  const colSpan = widget.size === "lg" ? "sm:col-span-2 lg:col-span-4" : widget.size === "md" ? "sm:col-span-2" : "";

  if (widget.chartType === "number") {
    return (
      <Card className={`border shadow-sm ${colSpan}`}>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">{widget.title}</p>
          <p className="mt-1 text-3xl font-semibold text-[#1e1f21] dark:text-white">
            {isLoading ? "..." : (data as any)?.value ?? 0}
            {widget.type === "completion_rate" && !isLoading ? "%" : ""}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border shadow-sm ${colSpan}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <WidgetChart widget={widget} data={data} />
        )}
      </CardContent>
    </Card>
  );
}

function WidgetChart({ widget, data }: { widget: WidgetConfig; data: any }) {
  const chartData = data?.data ?? [];
  if (!chartData.length) return <p className="py-8 text-center text-sm text-muted-foreground">No data</p>;

  if (widget.chartType === "pie") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value"
            label={(p: any) => `${p.name}`}>
            {chartData.map((d: any, i: number) => <Cell key={i} fill={d.color || CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend verticalAlign="bottom" iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (widget.chartType === "bar") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {chartData.map((d: any, i: number) => <Cell key={i} fill={d.color || CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (widget.chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="count" stroke={COLORS.blue} strokeWidth={2} dot={{ r: 4, fill: COLORS.blue }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (widget.chartType === "burndown") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend iconType="circle" />
          <Line type="monotone" dataKey="remaining" name="Remaining" stroke={COLORS.blue} strokeWidth={2} />
          <Line type="monotone" dataKey="ideal" name="Ideal" stroke={COLORS.green} strokeWidth={2} strokeDasharray="5 5" />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return <p className="py-8 text-center text-sm text-muted-foreground">Unsupported chart type</p>;
}
