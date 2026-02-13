"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import {
  Home,
  CheckSquare,
  Bell,
  BarChart3,
  Briefcase,
  Target,
  Plus,
  ChevronRight,
  Users,
  UserPlus,
  Clock,
  BarChart2,
  Plug,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/project/create-project-dialog";

const mainNav = [
  { label: "Home", href: "/home", icon: Home },
  { label: "My tasks", href: "/my-tasks", icon: CheckSquare },
  { label: "Inbox", href: "/inbox", icon: Bell },
];

const insightsNav = [
  { label: "Reporting", href: "/reporting", icon: BarChart3 },
  { label: "Portfolios", href: "/portfolios", icon: Briefcase },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Workload", href: "/workload", icon: BarChart2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [teamsExpanded, setTeamsExpanded] = useState(true);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  useEffect(() => {
    const handler = () => setCreateProjectOpen(true);
    document.addEventListener("create-project", handler);
    return () => document.removeEventListener("create-project", handler);
  }, []);

  const { data: recents } = trpc.recents.list.useQuery({ limit: 5 });
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery();
  const { data: workspaces } = trpc.workspaces.list.useQuery();
  const workspaceId = workspaces?.[0]?.id;

  const { data: projects } = trpc.projects.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );

  const { data: teams } = trpc.teams.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );

  return (
    <>
      <aside className="flex h-full w-[240px] flex-col border-r bg-[#FFF8F0] dark:bg-card">
        {/* Create Button */}
        <div className="px-3 pt-4 pb-2">
          <Button
            variant="default"
            size="sm"
            className="w-full justify-start gap-2 bg-[#1e1f21] text-white hover:bg-[#2e2f31]"
            onClick={() => setCreateProjectOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 overflow-y-auto px-2">
          <ul className="space-y-0.5">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-[#f1ece4] text-[#1e1f21]"
                      : "text-[#6d6e6f] hover:bg-[#f1ece4]/60 hover:text-[#1e1f21]"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {item.label === "Inbox" && unreadCount && unreadCount > 0 ? (
                    <span className="ml-auto rounded-full bg-[#4573D2] px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>

          {/* Recents Section */}
          {recents && recents.length > 0 && (
            <div className="mt-6">
              <h3 className="px-3 text-xs font-medium text-[#6d6e6f]">
                Recents
              </h3>
              <ul className="mt-1 space-y-0.5">
                {recents.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={
                        item.resourceType === "project"
                          ? `/projects/${item.resourceId}`
                          : item.resourceType === "portfolio"
                            ? `/portfolios/${item.resourceId}`
                            : item.resourceType === "goal"
                              ? `/goals/${item.resourceId}`
                              : `/my-tasks?task=${item.resourceId}`
                      }
                      className="flex items-center gap-3 rounded-md px-3 py-1.5 text-sm text-[#6d6e6f] hover:bg-[#f1ece4]/60 hover:text-[#1e1f21]"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span className="truncate">{item.resourceName}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Insights Section */}
          <div className="mt-6">
            <h3 className="px-3 text-xs font-medium text-[#6d6e6f]">
              Insights
            </h3>
            <ul className="mt-1 space-y-0.5">
              {insightsNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      pathname === item.href
                        ? "bg-[#f1ece4] text-[#1e1f21]"
                        : "text-[#6d6e6f] hover:bg-[#f1ece4]/60 hover:text-[#1e1f21]"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Projects Section */}
          <div className="mt-6">
            <button
              onClick={() => setProjectsExpanded(!projectsExpanded)}
              className="group flex w-full items-center justify-between px-3 text-xs font-medium text-[#6d6e6f]"
            >
              Projects
              <span className="flex items-center gap-1">
                <Plus
                  className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreateProjectOpen(true);
                  }}
                />
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    projectsExpanded && "rotate-90"
                  )}
                />
              </span>
            </button>
            {projectsExpanded && (
              <ul className="mt-1 space-y-0.5">
                {projects?.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={`/projects/${project.id}`}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors",
                        pathname === `/projects/${project.id}`
                          ? "bg-[#f1ece4] text-[#1e1f21]"
                          : "text-[#6d6e6f] hover:bg-[#f1ece4]/60 hover:text-[#1e1f21]"
                      )}
                    >
                      <div
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="truncate">{project.name}</span>
                    </Link>
                  </li>
                ))}
                {(!projects || projects.length === 0) && (
                  <li className="px-3 py-1.5 text-xs text-muted-foreground">
                    No projects yet
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Teams Section */}
          <div className="mt-6">
            <button
              onClick={() => setTeamsExpanded(!teamsExpanded)}
              className="group flex w-full items-center justify-between px-3 text-xs font-medium text-[#6d6e6f]"
            >
              Teams
              <span className="flex items-center gap-1">
                <Plus className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    teamsExpanded && "rotate-90"
                  )}
                />
              </span>
            </button>
            {teamsExpanded && (
              <ul className="mt-1 space-y-0.5">
                {teams?.map((team) => (
                  <li key={team.id}>
                    <Link
                      href={`/teams/${team.id}`}
                      className="flex items-center gap-3 rounded-md px-3 py-1.5 text-sm text-[#6d6e6f] hover:bg-[#f1ece4]/60 hover:text-[#1e1f21]"
                    >
                      <Users className="h-4 w-4" />
                      <span className="truncate">{team.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="space-y-1 border-t px-3 py-3">
          <Link
            href="/integrations"
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-normal transition-colors",
              pathname === "/integrations"
                ? "bg-[#f1ece4] text-[#1e1f21]"
                : "text-[#6d6e6f] hover:bg-[#f1ece4]/60 hover:text-[#1e1f21]"
            )}
          >
            <Plug className="h-4 w-4" />
            Integrations
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sm font-normal text-[#6d6e6f]"
            onClick={() => {
              navigator.clipboard.writeText(window.location.origin + "/register");
              toast.success("Invite link copied to clipboard");
            }}
          >
            <UserPlus className="h-4 w-4" />
            Invite teammates
          </Button>
        </div>
      </aside>

      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        workspaceId={workspaceId}
      />
    </>
  );
}
