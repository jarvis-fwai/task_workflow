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
  ChevronLeft,
  Users,
  UserPlus,
  Clock,
  BarChart2,
  Plug,
  Star,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
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

function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-favorites");
    if (stored) setFavorites(JSON.parse(stored));
  }, []);
  const toggle = useCallback((projectId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId];
      localStorage.setItem("sidebar-favorites", JSON.stringify(next));
      return next;
    });
  }, []);
  return { favorites, toggle };
}

function useRecentsLocal() {
  const [recentsLocal, setRecentsLocal] = useState<
    { id: string; name: string; type: string }[]
  >([]);
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-recents");
    if (stored) setRecentsLocal(JSON.parse(stored));
  }, []);
  return recentsLocal;
}

export function Sidebar() {
  const pathname = usePathname();
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [teamsExpanded, setTeamsExpanded] = useState(true);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  const { favorites, toggle: toggleFavorite } = useFavorites();

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

  const favoriteProjects = projects?.filter((p) => favorites.includes(p.id));

  // Track recent visits in localStorage
  useEffect(() => {
    if (!pathname.startsWith("/projects/")) return;
    const projectId = pathname.split("/projects/")[1]?.split("/")[0];
    const project = projects?.find((p) => p.id === projectId);
    if (!project) return;
    const stored = localStorage.getItem("sidebar-recents");
    const recentsLocal: { id: string; name: string; type: string }[] = stored
      ? JSON.parse(stored)
      : [];
    const filtered = recentsLocal.filter((r) => r.id !== projectId);
    filtered.unshift({ id: projectId, name: project.name, type: "project" });
    localStorage.setItem(
      "sidebar-recents",
      JSON.stringify(filtered.slice(0, 5))
    );
  }, [pathname, projects]);

  return (
    <>
      <aside
        className={cn(
          "flex h-full flex-col border-r bg-[#FFF8F0] dark:bg-card transition-all duration-200 ease-in-out",
          collapsed ? "w-[48px]" : "w-[240px]"
        )}
      >
        {/* Collapse Toggle */}
        <div className={cn("flex items-center", collapsed ? "justify-center pt-3 pb-1" : "justify-between px-3 pt-3 pb-1")}>
          {!collapsed && (
            <Button
              variant="default"
              size="sm"
              className="flex-1 justify-start gap-2 bg-[#1e1f21] text-white hover:bg-[#2e2f31]"
              onClick={() => setCreateProjectOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Create
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7 text-[#6d6e6f] hover:text-[#1e1f21]", collapsed && "")}
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 overflow-y-auto px-1">
          <ul className="space-y-0.5">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    collapsed && "justify-center px-0",
                    pathname === item.href
                      ? "bg-[#f1ece4] text-[#1e1f21]"
                      : "text-[#6d6e6f] hover:bg-[#f1ece4]/60 hover:text-[#1e1f21]"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && item.label}
                  {!collapsed && item.label === "Inbox" && unreadCount && unreadCount > 0 ? (
                    <span className="ml-auto rounded-full bg-[#4573D2] px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>

          {/* Favorites Section */}
          {!collapsed && favoriteProjects && favoriteProjects.length > 0 && (
            <div className="mt-6">
              <h3 className="px-3 text-xs font-medium text-[#6d6e6f]">
                <Star className="mr-1 inline h-3 w-3" />
                Favorites
              </h3>
              <ul className="mt-1 space-y-0.5">
                {favoriteProjects.map((project) => (
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
              </ul>
            </div>
          )}

          {/* Recents Section */}
          {!collapsed && recents && recents.length > 0 && (
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
          {!collapsed && (
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
          )}

          {collapsed && (
            <ul className="mt-4 space-y-0.5">
              {insightsNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center justify-center rounded-md py-1.5 text-sm font-medium transition-colors",
                      pathname === item.href
                        ? "bg-[#f1ece4] text-[#1e1f21]"
                        : "text-[#6d6e6f] hover:bg-[#f1ece4]/60 hover:text-[#1e1f21]"
                    )}
                    title={item.label}
                  >
                    <item.icon className="h-4 w-4" />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* Projects Section */}
          {!collapsed && (
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
                    <li key={project.id} className="group/proj">
                      <div className="flex items-center">
                        <Link
                          href={`/projects/${project.id}`}
                          className={cn(
                            "flex flex-1 items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors",
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
                        <button
                          onClick={() => toggleFavorite(project.id)}
                          className={cn(
                            "mr-1 flex-shrink-0 p-0.5 rounded hover:bg-[#f1ece4]",
                            favorites.includes(project.id)
                              ? "text-yellow-500"
                              : "text-transparent group-hover/proj:text-[#cfcbcb]"
                          )}
                          title={favorites.includes(project.id) ? "Remove from favorites" : "Add to favorites"}
                        >
                          <Star className="h-3 w-3" fill={favorites.includes(project.id) ? "currentColor" : "none"} />
                        </button>
                      </div>
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
          )}

          {/* Teams Section */}
          {!collapsed && (
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
          )}
        </nav>

        {/* Bottom Actions */}
        <div className={cn("space-y-1 border-t py-3", collapsed ? "px-1" : "px-3")}>
          <Link
            href="/integrations"
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-normal transition-colors",
              collapsed && "justify-center px-0",
              pathname === "/integrations"
                ? "bg-[#f1ece4] text-[#1e1f21]"
                : "text-[#6d6e6f] hover:bg-[#f1ece4]/60 hover:text-[#1e1f21]"
            )}
            title={collapsed ? "Integrations" : undefined}
          >
            <Plug className="h-4 w-4 flex-shrink-0" />
            {!collapsed && "Integrations"}
          </Link>
          {!collapsed && (
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
          )}
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
