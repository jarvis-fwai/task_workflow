import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const workloadRouter = router({
  getTeamWorkload: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        dateRange: z.enum(["this_week", "next_week", "this_month"]).default("this_week"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Calculate date range
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      if (input.dateRange === "this_week") {
        const day = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - day);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      } else if (input.dateRange === "next_week") {
        const day = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - day + 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }

      const members = await ctx.prisma.workspaceMember.findMany({
        where: { workspaceId: input.workspaceId },
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });

      const workloads = await Promise.all(
        members.map(async (member) => {
          const tasks = await ctx.prisma.task.findMany({
            where: {
              assigneeId: member.userId,
              workspaceId: input.workspaceId,
              status: "INCOMPLETE",
              OR: [
                { dueDate: { gte: startDate, lte: endDate } },
                { dueDate: null },
              ],
            },
            select: {
              id: true,
              title: true,
              dueDate: true,
              estimatedHours: true,
              storyPoints: true,
              taskProjects: {
                select: {
                  project: {
                    select: { id: true, name: true, color: true },
                  },
                },
              },
            },
          });

          const capacity = await ctx.prisma.userCapacity.findUnique({
            where: {
              userId_workspaceId: {
                userId: member.userId,
                workspaceId: input.workspaceId,
              },
            },
          });

          const totalEstimatedHours = tasks.reduce(
            (sum, t) => sum + (t.estimatedHours ?? 1),
            0
          );

          const weeklyCapacity = capacity?.weeklyHours ?? 40;

          // Group tasks by project
          const tasksByProject: Record<string, { projectName: string; color: string; hours: number; tasks: typeof tasks }> = {};
          tasks.forEach((task) => {
            const project = task.taskProjects[0]?.project;
            const key = project?.id ?? "unassigned";
            if (!tasksByProject[key]) {
              tasksByProject[key] = {
                projectName: project?.name ?? "No project",
                color: project?.color ?? "#6D6E6F",
                hours: 0,
                tasks: [],
              };
            }
            tasksByProject[key]!.hours += task.estimatedHours ?? 1;
            tasksByProject[key]!.tasks.push(task);
          });

          return {
            user: member.user,
            taskCount: tasks.length,
            totalEstimatedHours,
            weeklyCapacity,
            utilization:
              weeklyCapacity > 0
                ? Math.round((totalEstimatedHours / weeklyCapacity) * 100)
                : 0,
            tasks,
            tasksByProject: Object.values(tasksByProject),
          };
        })
      );

      return { workloads, startDate: startDate.toISOString(), endDate: endDate.toISOString() };
    }),

  reassignTask: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        newAssigneeId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.task.update({
        where: { id: input.taskId },
        data: { assigneeId: input.newAssigneeId },
      });
    }),

  setCapacity: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        workspaceId: z.string(),
        weeklyHours: z.number().min(0).max(168),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.userCapacity.upsert({
        where: {
          userId_workspaceId: {
            userId: input.userId,
            workspaceId: input.workspaceId,
          },
        },
        create: {
          userId: input.userId,
          workspaceId: input.workspaceId,
          weeklyHours: input.weeklyHours,
        },
        update: {
          weeklyHours: input.weeklyHours,
        },
      });
    }),

  getCapacity: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        workspaceId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.userCapacity.findUnique({
        where: {
          userId_workspaceId: {
            userId: input.userId,
            workspaceId: input.workspaceId,
          },
        },
      });
    }),
});
