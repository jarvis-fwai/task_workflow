import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const dashboardsRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().optional(), projectId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.dashboardConfig.findMany({
        where: input.projectId
          ? { projectId: input.projectId }
          : { createdById: ctx.session.user.id },
        orderBy: { updatedAt: "desc" },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.dashboardConfig.findUniqueOrThrow({
        where: { id: input.id },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        projectId: z.string().optional(),
        layout: z.any(),
        widgets: z.any(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.dashboardConfig.create({
        data: {
          name: input.name,
          projectId: input.projectId,
          createdById: ctx.session.user.id,
          layout: input.layout ?? {},
          widgets: input.widgets ?? [],
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        layout: z.any().optional(),
        widgets: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.dashboardConfig.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.dashboardConfig.delete({ where: { id: input.id } });
    }),

  // Get widget data based on type and date range
  getWidgetData: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        widgetType: z.enum([
          "tasks_by_status",
          "tasks_by_assignee",
          "tasks_by_project",
          "completion_rate",
          "overdue_tasks",
          "burndown",
          "velocity",
          "task_count",
          "completed_count",
          "overdue_count",
        ]),
        dateRange: z.enum(["this_week", "this_month", "this_quarter", "all"]).default("this_month"),
        projectId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      let startDate: Date | null = null;

      if (input.dateRange === "this_week") {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
      } else if (input.dateRange === "this_month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (input.dateRange === "this_quarter") {
        const qMonth = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), qMonth, 1);
      }

      const baseWhere: any = { workspaceId: input.workspaceId };
      if (input.projectId) {
        baseWhere.taskProjects = { some: { projectId: input.projectId } };
      }

      switch (input.widgetType) {
        case "task_count": {
          const count = await ctx.prisma.task.count({ where: baseWhere });
          return { value: count };
        }
        case "completed_count": {
          const count = await ctx.prisma.task.count({
            where: { ...baseWhere, status: "COMPLETE", ...(startDate ? { completedAt: { gte: startDate } } : {}) },
          });
          return { value: count };
        }
        case "overdue_count": {
          const count = await ctx.prisma.task.count({
            where: { ...baseWhere, status: "INCOMPLETE", dueDate: { lt: now } },
          });
          return { value: count };
        }
        case "completion_rate": {
          const [total, completed] = await Promise.all([
            ctx.prisma.task.count({ where: baseWhere }),
            ctx.prisma.task.count({ where: { ...baseWhere, status: "COMPLETE" } }),
          ]);
          return { value: total > 0 ? Math.round((completed / total) * 100) : 0, total, completed };
        }
        case "tasks_by_status": {
          const [complete, incomplete] = await Promise.all([
            ctx.prisma.task.count({ where: { ...baseWhere, status: "COMPLETE" } }),
            ctx.prisma.task.count({ where: { ...baseWhere, status: "INCOMPLETE" } }),
          ]);
          const overdue = await ctx.prisma.task.count({
            where: { ...baseWhere, status: "INCOMPLETE", dueDate: { lt: now } },
          });
          return {
            data: [
              { name: "Completed", value: complete, color: "#22C55E" },
              { name: "On Track", value: incomplete - overdue, color: "#4573D2" },
              { name: "Overdue", value: overdue, color: "#EF4444" },
            ].filter((d) => d.value > 0),
          };
        }
        case "tasks_by_assignee": {
          const tasks = await ctx.prisma.task.groupBy({
            by: ["assigneeId"],
            where: { ...baseWhere, status: "INCOMPLETE" },
            _count: true,
          });
          const userIds = tasks.map((t) => t.assigneeId).filter(Boolean) as string[];
          const users = await ctx.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true },
          });
          const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
          return {
            data: tasks.map((t) => ({
              name: t.assigneeId ? userMap[t.assigneeId] ?? "Unknown" : "Unassigned",
              value: t._count,
            })),
          };
        }
        case "tasks_by_project": {
          const projects = await ctx.prisma.project.findMany({
            where: { workspaceId: input.workspaceId },
            select: { id: true, name: true, color: true, _count: { select: { taskProjects: true } } },
          });
          return {
            data: projects.map((p) => ({
              name: p.name.length > 15 ? p.name.slice(0, 15) + "..." : p.name,
              value: p._count.taskProjects,
              color: p.color,
            })),
          };
        }
        case "velocity": {
          // Tasks completed per week over last 4 weeks
          const weeks: { label: string; count: number }[] = [];
          for (let i = 3; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay() - i * 7);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            const count = await ctx.prisma.task.count({
              where: { ...baseWhere, status: "COMPLETE", completedAt: { gte: weekStart, lte: weekEnd } },
            });
            weeks.push({
              label: `Week ${4 - i}`,
              count,
            });
          }
          return { data: weeks };
        }
        case "burndown": {
          const days = startDate ? Math.ceil((now.getTime() - startDate.getTime()) / 86400000) : 14;
          const effectiveStart = startDate ?? new Date(now.getTime() - 14 * 86400000);
          const totalAtStart = await ctx.prisma.task.count({
            where: { ...baseWhere, createdAt: { lte: effectiveStart } },
          });
          const completedTasks = await ctx.prisma.task.findMany({
            where: { ...baseWhere, status: "COMPLETE", completedAt: { gte: effectiveStart } },
            select: { completedAt: true },
          });
          const points: { date: string; remaining: number; ideal: number }[] = [];
          let remaining = totalAtStart;
          const totalTasks = await ctx.prisma.task.count({ where: baseWhere });
          for (let i = 0; i <= Math.min(days, 30); i++) {
            const d = new Date(effectiveStart);
            d.setDate(effectiveStart.getDate() + i);
            const ds = d.toISOString().split("T")[0]!;
            const completedOnDay = completedTasks.filter(
              (t) => t.completedAt && t.completedAt.toISOString().split("T")[0] === ds
            ).length;
            remaining = Math.max(0, remaining - completedOnDay);
            points.push({
              date: ds,
              remaining,
              ideal: Math.max(0, totalTasks - Math.round((totalTasks / Math.max(days, 1)) * i)),
            });
          }
          return { data: points };
        }
        default:
          return { data: [] };
      }
    }),
});
