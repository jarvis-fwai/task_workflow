import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const commentsRouter = router({
  list: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.comment.findMany({
        where: { taskId: input.taskId },
        include: { author: true },
        orderBy: { createdAt: "asc" },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        body: z.string().min(1),
        videoUrl: z.string().optional(),
        videoDuration: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.create({
        data: {
          taskId: input.taskId,
          authorId: ctx.session.user.id,
          body: input.body,
          ...(input.videoUrl && { videoUrl: input.videoUrl }),
          ...(input.videoDuration !== undefined && { videoDuration: input.videoDuration }),
        },
        include: { author: true },
      });

      // Notify task followers about the comment
      try {
        const task = await ctx.prisma.task.findUnique({
          where: { id: input.taskId },
          select: { title: true },
        });
        const followers = await ctx.prisma.taskFollower.findMany({
          where: { taskId: input.taskId },
          select: { userId: true },
        });
        for (const f of followers) {
          if (f.userId !== ctx.session.user.id) {
            await ctx.prisma.notification.create({
              data: {
                userId: f.userId,
                type: "COMMENT_ADDED",
                message: `${comment.author.name} commented on "${task?.title}"`,
                resourceId: input.taskId,
                resourceType: "task",
                actorId: ctx.session.user.id,
              },
            });
          }
        }
      } catch {
        // Don't fail comment creation
      }

      return comment;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        body: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.comment.update({
        where: { id: input.id, authorId: ctx.session.user.id },
        data: { body: input.body },
        include: { author: true },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.comment.delete({
        where: { id: input.id },
      });
    }),
});
