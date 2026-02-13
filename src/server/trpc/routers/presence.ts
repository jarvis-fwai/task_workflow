import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const presenceRouter = router({
  report: protectedProcedure
    .input(z.object({ location: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.userPresence.upsert({
        where: { userId: ctx.session.user.id },
        create: {
          userId: ctx.session.user.id,
          location: input.location,
          lastSeen: new Date(),
        },
        update: {
          location: input.location,
          lastSeen: new Date(),
        },
      });
      return { ok: true };
    }),

  get: protectedProcedure
    .input(z.object({ location: z.string() }))
    .query(async ({ ctx, input }) => {
      const staleThreshold = new Date(Date.now() - 60_000); // 60s staleness
      const viewers = await ctx.prisma.userPresence.findMany({
        where: {
          location: input.location,
          lastSeen: { gte: staleThreshold },
          userId: { not: ctx.session.user.id },
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });
      return viewers;
    }),

  clear: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ctx.prisma.userPresence.deleteMany({
        where: { userId: ctx.session.user.id },
      });
      return { ok: true };
    }),
});
