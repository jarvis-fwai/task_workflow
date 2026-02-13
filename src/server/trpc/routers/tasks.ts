import { z } from "zod";
import { Prisma } from "../../../../prisma/generated/prisma/client";
import { router, protectedProcedure } from "../trpc";
import { executeRules } from "../../services/rules-engine";

function calculateNextDueDate(
  currentDueDate: Date | null,
  rule: {
    frequency: string;
    interval: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
  }
): Date | null {
  const base = currentDueDate || new Date();
  const next = new Date(base);

  switch (rule.frequency) {
    case "DAILY":
      next.setDate(next.getDate() + rule.interval);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7 * rule.interval);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + rule.interval);
      if (rule.dayOfMonth)
        next.setDate(
          Math.min(
            rule.dayOfMonth,
            new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
          )
        );
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + rule.interval);
      break;
    default:
      return null;
  }

  return next;
}

async function createNotification(
  prisma: any,
  userId: string,
  type: string,
  message: string,
  resourceId: string,
  resourceType: string,
  actorId?: string,
) {
  try {
    // Don't notify yourself
    if (actorId && actorId === userId) return;
    await prisma.notification.create({
      data: { userId, type, message, resourceId, resourceType, actorId },
    });
  } catch {
    // Don't fail operations due to notification errors
  }
}

async function logActivity(
  prisma: any,
  taskId: string,
  userId: string,
  action: string,
  field?: string,
  oldValue?: string | null,
  newValue?: string | null,
) {
  try {
    await prisma.activityLog.create({
      data: { taskId, userId, action, field, oldValue, newValue },
    });
  } catch {
    // Don't fail task operations due to logging errors
  }
}

export const tasksRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        sectionId: z.string().optional(),
        status: z.enum(["INCOMPLETE", "COMPLETE"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.task.findMany({
        where: {
          taskProjects: {
            some: {
              projectId: input.projectId,
              ...(input.sectionId && { sectionId: input.sectionId }),
            },
          },
          ...(input.status && { status: input.status }),
          parentTaskId: null, // Only top-level tasks
        },
        include: {
          assignee: true,
          taskProjects: {
            where: { projectId: input.projectId },
            include: { section: true },
          },
          tags: { include: { tag: true } },
          _count: {
            select: { subtasks: true, comments: true, attachments: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          assignee: true,
          createdBy: true,
          subtasks: {
            include: {
              assignee: true,
              _count: { select: { subtasks: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          taskProjects: {
            include: { project: true, section: true },
          },
          tags: { include: { tag: true } },
          customFieldValues: {
            include: { customField: true },
          },
          dependsOn: {
            include: { dependsOn: true },
          },
          blocking: {
            include: { task: true },
          },
          comments: {
            include: { author: true },
            orderBy: { createdAt: "asc" },
          },
          followers: {
            include: { user: true },
          },
          attachments: {
            orderBy: { createdAt: "desc" },
          },
          activityLogs: {
            orderBy: { createdAt: "asc" },
            take: 50,
          },
          _count: {
            select: { comments: true, attachments: true, subtasks: true },
          },
        },
      });
    }),

  myTasks: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        status: z.enum(["INCOMPLETE", "COMPLETE"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.task.findMany({
        where: {
          assigneeId: ctx.session.user.id,
          workspaceId: input.workspaceId,
          ...(input.status && { status: input.status }),
          parentTaskId: null,
        },
        include: {
          taskProjects: {
            include: { project: true, section: true },
          },
          tags: { include: { tag: true } },
          _count: {
            select: { subtasks: true, comments: true },
          },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        description: z.any().optional(),
        assigneeId: z.string().optional(),
        dueDate: z.string().datetime().optional(),
        startDate: z.string().datetime().optional(),
        projectId: z.string(),
        sectionId: z.string().optional(),
        parentTaskId: z.string().optional(),
        workspaceId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Resolve workspaceId from project if not provided
      let workspaceId = input.workspaceId;
      if (!workspaceId) {
        const project = await ctx.prisma.project.findUniqueOrThrow({
          where: { id: input.projectId },
          select: { workspaceId: true },
        });
        workspaceId = project.workspaceId;
      }

      // Get position for new task in section
      const lastTaskProject = await ctx.prisma.taskProject.findFirst({
        where: {
          projectId: input.projectId,
          sectionId: input.sectionId,
        },
        orderBy: { position: "desc" },
      });

      const position = (lastTaskProject?.position ?? 0) + 1;

      const task = await ctx.prisma.task.create({
        data: {
          title: input.title,
          description: input.description,
          assigneeId: input.assigneeId,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          parentTaskId: input.parentTaskId,
          workspaceId,
          createdById: ctx.session.user.id,
          taskProjects: {
            create: {
              projectId: input.projectId,
              sectionId: input.sectionId,
              position,
            },
          },
          followers: {
            create: { userId: ctx.session.user.id },
          },
        },
        include: {
          assignee: true,
          taskProjects: {
            include: { project: true, section: true },
          },
        },
      });

      // Log activity
      await logActivity(ctx.prisma, task.id, ctx.session.user.id, "created");

      // Notify assignee
      if (input.assigneeId && input.assigneeId !== ctx.session.user.id) {
        await createNotification(
          ctx.prisma, input.assigneeId, "TASK_ASSIGNED",
          `You were assigned to "${input.title}"`,
          task.id, "task", ctx.session.user.id,
        );
      }

      // Execute rules for TASK_ADDED
      executeRules(ctx.prisma, "TASK_ADDED", {
        projectId: input.projectId,
        taskId: task.id,
        userId: ctx.session.user.id,
      }).catch(console.error); // Fire and forget - don't block the response

      return task;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(500).optional(),
        description: z.any().optional(),
        assigneeId: z.string().nullable().optional(),
        dueDate: z.string().datetime().nullable().optional(),
        startDate: z.string().datetime().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Log field changes
      const existing = await ctx.prisma.task.findUnique({ where: { id }, select: { title: true, assigneeId: true, dueDate: true } });
      if (existing) {
        if (data.title && data.title !== existing.title) {
          await logActivity(ctx.prisma, id, ctx.session.user.id, "updated", "title", existing.title, data.title);
        }
        if (data.assigneeId !== undefined && data.assigneeId !== existing.assigneeId) {
          await logActivity(ctx.prisma, id, ctx.session.user.id, "updated", "assignee", existing.assigneeId, data.assigneeId);
          // Notify new assignee
          if (data.assigneeId) {
            await createNotification(
              ctx.prisma, data.assigneeId, "TASK_ASSIGNED",
              `You were assigned to "${existing.title}"`,
              id, "task", ctx.session.user.id,
            );
          }
        }
        if (data.dueDate !== undefined) {
          await logActivity(ctx.prisma, id, ctx.session.user.id, "updated", "dueDate", existing.dueDate?.toISOString() ?? null, data.dueDate);
        }
      }

      return ctx.prisma.task.update({
        where: { id },
        data: {
          ...data,
          ...(data.dueDate !== undefined && {
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
          }),
          ...(data.startDate !== undefined && {
            startDate: data.startDate ? new Date(data.startDate) : null,
          }),
        },
        include: {
          assignee: true,
          taskProjects: {
            include: { project: true, section: true },
          },
        },
      });
    }),

  complete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const completedTask = await ctx.prisma.task.update({
        where: { id: input.id },
        data: {
          status: "COMPLETE",
          completedAt: new Date(),
        },
      });

      await logActivity(ctx.prisma, input.id, ctx.session.user.id, "completed");

      // Notify followers
      const followers = await ctx.prisma.taskFollower.findMany({
        where: { taskId: input.id },
        select: { userId: true },
      });
      for (const f of followers) {
        await createNotification(
          ctx.prisma, f.userId, "TASK_COMPLETED",
          `Task "${completedTask.title}" was completed`,
          input.id, "task", ctx.session.user.id,
        );
      }

      // Execute rules for TASK_COMPLETED
      const taskForRules = await ctx.prisma.task.findUnique({
        where: { id: input.id },
        include: { taskProjects: true },
      });
      if (taskForRules?.taskProjects[0]?.projectId) {
        executeRules(ctx.prisma, "TASK_COMPLETED", {
          projectId: taskForRules.taskProjects[0].projectId,
          taskId: input.id,
          userId: ctx.session.user.id,
        }).catch(console.error); // Fire and forget - don't block the response
      }

      // Check if task is recurring and create next occurrence
      const task = await ctx.prisma.task.findUnique({
        where: { id: input.id },
        include: { taskProjects: true },
      });

      if (task?.isRecurring && task.recurrenceRule) {
        const rule = task.recurrenceRule as {
          frequency: string;
          interval: number;
          daysOfWeek?: number[];
          dayOfMonth?: number;
          endDate?: string;
          endAfterOccurrences?: number;
        };
        const nextDueDate = calculateNextDueDate(task.dueDate, rule);

        if (
          nextDueDate &&
          (!rule.endDate || nextDueDate <= new Date(rule.endDate))
        ) {
          // Create next occurrence
          await ctx.prisma.task.create({
            data: {
              title: task.title,
              description: task.description ?? Prisma.JsonNull,
              assigneeId: task.assigneeId,
              workspaceId: task.workspaceId,
              createdById: ctx.session.user.id,
              isRecurring: true,
              recurrenceRule: task.recurrenceRule as any,
              dueDate: nextDueDate,
              startDate: task.startDate
                ? new Date(
                    nextDueDate.getTime() -
                      ((task.dueDate?.getTime() ?? 0) -
                        (task.startDate?.getTime() ?? 0))
                  )
                : undefined,
              taskProjects: {
                create: task.taskProjects.map((tp) => ({
                  projectId: tp.projectId,
                  sectionId: tp.sectionId,
                  position: Date.now(),
                })),
              },
            },
          });
        }
      }

      return completedTask;
    }),

  uncomplete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.task.update({
        where: { id: input.id },
        data: {
          status: "INCOMPLETE",
          completedAt: null,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Use a transaction to delete subtasks first, then the task
      return ctx.prisma.$transaction(async (tx) => {
        // Recursively delete all subtasks
        const deleteSubtasks = async (parentId: string) => {
          const subtasks = await tx.task.findMany({
            where: { parentTaskId: parentId },
            select: { id: true },
          });
          for (const subtask of subtasks) {
            await deleteSubtasks(subtask.id);
            await tx.task.delete({ where: { id: subtask.id } });
          }
        };
        await deleteSubtasks(input.id);
        return tx.task.delete({ where: { id: input.id } });
      });
    }),

  move: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        projectId: z.string(),
        sectionId: z.string().optional(),
        position: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.taskProject.updateMany({
        where: {
          taskId: input.taskId,
          projectId: input.projectId,
        },
        data: {
          sectionId: input.sectionId,
          position: input.position,
        },
      });

      // Execute rules for TASK_MOVED
      executeRules(ctx.prisma, "TASK_MOVED", {
        projectId: input.projectId,
        taskId: input.taskId,
        userId: ctx.session.user.id,
      }).catch(console.error); // Fire and forget - don't block the response

      return result;
    }),

  setRecurrence: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        isRecurring: z.boolean(),
        recurrenceRule: z
          .object({
            frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
            interval: z.number().min(1).max(365).default(1),
            daysOfWeek: z.array(z.number().min(0).max(6)).optional(), // 0=Sun...6=Sat
            dayOfMonth: z.number().min(1).max(31).optional(),
            endDate: z.string().datetime().optional(),
            endAfterOccurrences: z.number().min(1).optional(),
          })
          .nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.task.update({
        where: { id: input.taskId },
        data: {
          isRecurring: input.isRecurring,
          recurrenceRule: input.recurrenceRule ?? Prisma.JsonNull,
        },
      });
    }),

  addDependency: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        dependsOnTaskId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.taskDependency.create({
        data: {
          taskId: input.taskId,
          dependsOnTaskId: input.dependsOnTaskId,
        },
        include: { dependsOn: true, task: true },
      });
    }),

  removeDependency: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.taskDependency.delete({
        where: { id: input.id },
      });
    }),

  addToProject: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        projectId: z.string(),
        sectionId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.taskProject.create({
        data: {
          taskId: input.taskId,
          projectId: input.projectId,
          sectionId: input.sectionId,
          position: Date.now(),
        },
      });
    }),

  removeFromProject: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        projectId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.taskProject.deleteMany({
        where: {
          taskId: input.taskId,
          projectId: input.projectId,
        },
      });
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const source = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          taskProjects: true,
          tags: true,
          customFieldValues: true,
        },
      });

      const task = await ctx.prisma.task.create({
        data: {
          title: `${source.title} (copy)`,
          description: source.description ?? undefined,
          assigneeId: source.assigneeId,
          dueDate: source.dueDate,
          startDate: source.startDate,
          workspaceId: source.workspaceId,
          createdById: ctx.session.user.id,
          estimatedHours: source.estimatedHours,
          storyPoints: source.storyPoints,
          taskProjects: {
            create: source.taskProjects.map((tp) => ({
              projectId: tp.projectId,
              sectionId: tp.sectionId,
              position: Date.now(),
            })),
          },
          tags: {
            create: source.tags.map((t) => ({
              tagId: t.tagId,
            })),
          },
          customFieldValues: {
            create: source.customFieldValues.map((cfv) => ({
              customFieldId: cfv.customFieldId,
              stringValue: cfv.stringValue,
              numberValue: cfv.numberValue,
              dateValue: cfv.dateValue,
              selectedOptions: cfv.selectedOptions ?? undefined,
            })),
          },
        },
        include: {
          assignee: true,
          taskProjects: { include: { project: true, section: true } },
        },
      });

      return task;
    }),

  bulkUpdate: protectedProcedure
    .input(
      z.object({
        taskIds: z.array(z.string()).min(1),
        assigneeId: z.string().nullable().optional(),
        dueDate: z.string().datetime().nullable().optional(),
        status: z.enum(["INCOMPLETE", "COMPLETE"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { taskIds, ...data } = input;
      const updateData: Record<string, unknown> = {};
      if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
      if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
      if (data.status !== undefined) {
        updateData.status = data.status;
        if (data.status === "COMPLETE") updateData.completedAt = new Date();
        else updateData.completedAt = null;
      }

      return ctx.prisma.task.updateMany({
        where: { id: { in: taskIds } },
        data: updateData,
      });
    }),

  bulkDelete: protectedProcedure
    .input(z.object({ taskIds: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        // Delete subtasks of all selected tasks first
        await tx.task.deleteMany({
          where: { parentTaskId: { in: input.taskIds } },
        });
        return tx.task.deleteMany({
          where: { id: { in: input.taskIds } },
        });
      });
    }),

  bulkMove: protectedProcedure
    .input(
      z.object({
        taskIds: z.array(z.string()).min(1),
        projectId: z.string(),
        sectionId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.taskProject.updateMany({
        where: {
          taskId: { in: input.taskIds },
          projectId: input.projectId,
        },
        data: { sectionId: input.sectionId },
      });
    }),

  markAsApproval: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        isApproval: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.task.update({
        where: { id: input.id },
        data: {
          isApproval: input.isApproval,
          approvalStatus: input.isApproval ? "PENDING" : null,
        },
      });
    }),

  setApprovalStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.task.update({
        where: { id: input.id },
        data: { approvalStatus: input.approvalStatus },
      });
    }),
});
