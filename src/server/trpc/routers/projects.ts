import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const projectsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        teamId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.project.findMany({
        where: {
          workspaceId: input.workspaceId,
          ...(input.teamId && { teamId: input.teamId }),
          isArchived: false,
        },
        include: {
          team: true,
          _count: {
            select: { taskProjects: true, sections: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.project.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          team: true,
          sections: { orderBy: { position: "asc" } },
          members: true,
          _count: {
            select: { taskProjects: true, sections: true },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        teamId: z.string().optional(),
        name: z.string().min(1).max(200),
        description: z.any().optional(),
        color: z.string().default("#4573D2"),
        privacy: z.enum(["PUBLIC", "PRIVATE", "SPECIFIC_MEMBERS"]).default("PUBLIC"),
        defaultView: z.enum(["LIST", "BOARD", "TIMELINE", "CALENDAR"]).default("LIST"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.create({
        data: {
          name: input.name,
          description: input.description,
          color: input.color,
          privacy: input.privacy,
          defaultView: input.defaultView,
          workspaceId: input.workspaceId,
          teamId: input.teamId,
          createdById: ctx.session.user.id,
          // Create default sections
          sections: {
            createMany: {
              data: [
                { name: "To do", position: 1 },
                { name: "In progress", position: 2 },
                { name: "Done", position: 3 },
              ],
            },
          },
          // Add creator as project admin
          members: {
            create: {
              userId: ctx.session.user.id,
              permission: "ADMIN",
            },
          },
        },
        include: {
          sections: { orderBy: { position: "asc" } },
          team: true,
        },
      });

      return project;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.any().optional(),
        color: z.string().optional(),
        defaultView: z.enum(["LIST", "BOARD", "TIMELINE", "CALENDAR"]).optional(),
        isArchived: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.project.update({
        where: { id },
        data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.project.delete({
        where: { id: input.id },
      });
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string(), isArchived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.project.update({
        where: { id: input.id },
        data: { isArchived: input.isArchived },
      });
    }),

  duplicate: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200),
        includeTasks: z.boolean().default(true),
        includeFields: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const source = await ctx.prisma.project.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          sections: { orderBy: { position: "asc" } },
          customFields: true,
          taskProjects: {
            include: {
              task: {
                include: {
                  tags: true,
                  customFieldValues: true,
                },
              },
            },
          },
        },
      });

      // Create the new project
      const newProject = await ctx.prisma.project.create({
        data: {
          name: input.name,
          description: source.description ?? undefined,
          color: source.color,
          icon: source.icon,
          defaultView: source.defaultView,
          privacy: source.privacy,
          workspaceId: source.workspaceId,
          teamId: source.teamId,
          createdById: ctx.session.user.id,
          members: {
            create: {
              userId: ctx.session.user.id,
              permission: "ADMIN",
            },
          },
        },
      });

      // Create sections and map old to new IDs
      const sectionMap = new Map<string, string>();
      for (const section of source.sections) {
        const newSection = await ctx.prisma.section.create({
          data: {
            name: section.name,
            projectId: newProject.id,
            position: section.position,
          },
        });
        sectionMap.set(section.id, newSection.id);
      }

      // Copy custom fields
      if (input.includeFields) {
        for (const cf of source.customFields) {
          await ctx.prisma.projectCustomField.create({
            data: {
              projectId: newProject.id,
              customFieldId: cf.customFieldId,
              position: cf.position,
            },
          });
        }
      }

      // Copy tasks
      if (input.includeTasks) {
        for (const tp of source.taskProjects) {
          const newSectionId = tp.sectionId
            ? sectionMap.get(tp.sectionId) ?? null
            : null;
          await ctx.prisma.task.create({
            data: {
              title: tp.task.title,
              description: tp.task.description ?? undefined,
              assigneeId: tp.task.assigneeId,
              dueDate: tp.task.dueDate,
              startDate: tp.task.startDate,
              workspaceId: source.workspaceId,
              createdById: ctx.session.user.id,
              taskProjects: {
                create: {
                  projectId: newProject.id,
                  sectionId: newSectionId,
                  position: tp.position,
                },
              },
              tags: {
                create: tp.task.tags.map((t) => ({
                  tagId: t.tagId,
                })),
              },
            },
          });
        }
      }

      return newProject;
    }),

  getTasksForExport: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.task.findMany({
        where: {
          taskProjects: { some: { projectId: input.projectId } },
        },
        include: {
          assignee: { select: { name: true, email: true } },
          taskProjects: {
            where: { projectId: input.projectId },
            include: { section: true },
          },
          tags: { include: { tag: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  // Status Updates
  statusUpdates: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.statusUpdate.findMany({
        where: { projectId: input.projectId },
        include: { author: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
    }),

  createStatusUpdate: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        status: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK", "ON_HOLD", "COMPLETE"]),
        title: z.string().min(1).max(200),
        body: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.statusUpdate.create({
        data: {
          projectId: input.projectId,
          authorId: ctx.session.user.id,
          status: input.status,
          title: input.title,
          body: input.body,
        },
        include: { author: true },
      });
    }),

  deleteStatusUpdate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.statusUpdate.delete({
        where: { id: input.id },
      });
    }),

  latestStatus: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.statusUpdate.findFirst({
        where: { projectId: input.projectId },
        include: { author: true },
        orderBy: { createdAt: "desc" },
      });
    }),
});
