import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const approvalsRouter = router({
  request: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        approverId: z.string(),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.task.update({
        where: { id: input.taskId },
        data: { isApproval: true, approvalStatus: "PENDING" },
      });

      const approval = await ctx.prisma.approvalRequest.create({
        data: {
          taskId: input.taskId,
          requesterId: ctx.session.user.id,
          approverId: input.approverId,
          comment: input.comment,
        },
      });

      const task = await ctx.prisma.task.findUnique({
        where: { id: input.taskId },
        select: { title: true },
      });

      await ctx.prisma.notification.create({
        data: {
          userId: input.approverId,
          type: "APPROVAL_REQUEST",
          resourceType: "task",
          resourceId: input.taskId,
          actorId: ctx.session.user.id,
          message: `Approval requested for "${task?.title}"`,
        },
      });

      return approval;
    }),

  respond: protectedProcedure
    .input(
      z.object({
        approvalId: z.string(),
        status: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.approvalRequest.findUniqueOrThrow({
        where: { id: input.approvalId },
      });

      // Only the designated approver can respond
      if (existing.approverId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the designated approver can respond to this request",
        });
      }

      const approval = await ctx.prisma.approvalRequest.update({
        where: { id: input.approvalId },
        data: {
          status: input.status,
          comment: input.comment,
        },
      });

      await ctx.prisma.task.update({
        where: { id: approval.taskId },
        data: { approvalStatus: input.status },
      });

      const task = await ctx.prisma.task.findUnique({
        where: { id: approval.taskId },
        select: { title: true },
      });

      await ctx.prisma.notification.create({
        data: {
          userId: approval.requesterId,
          type: "APPROVAL_RESPONSE",
          resourceType: "task",
          resourceId: approval.taskId,
          actorId: ctx.session.user.id,
          message: `"${task?.title}" was ${input.status.toLowerCase().replace("_", " ")}`,
        },
      });

      return approval;
    }),

  cancel: protectedProcedure
    .input(z.object({ approvalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.approvalRequest.findUniqueOrThrow({
        where: { id: input.approvalId },
      });

      // Only the requester can cancel
      if (existing.requesterId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the requester can cancel this approval",
        });
      }

      await ctx.prisma.approvalRequest.delete({
        where: { id: input.approvalId },
      });

      // Check if there are other pending approvals for this task
      const remaining = await ctx.prisma.approvalRequest.count({
        where: { taskId: existing.taskId, status: "PENDING" },
      });

      if (remaining === 0) {
        await ctx.prisma.task.update({
          where: { id: existing.taskId },
          data: { isApproval: false, approvalStatus: null },
        });
      }

      return { success: true };
    }),

  listForTask: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.approvalRequest.findMany({
        where: { taskId: input.taskId },
        orderBy: { createdAt: "desc" },
      });
    }),

  listPending: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.approvalRequest.findMany({
      where: {
        approverId: ctx.session.user.id,
        status: "PENDING",
      },
      include: {
        task: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),
});
