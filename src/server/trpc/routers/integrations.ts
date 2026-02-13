import { z } from "zod";
import crypto from "crypto";
import { router, protectedProcedure } from "../trpc";

export const integrationsRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.integration.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: "desc" },
      });
    }),

  get: protectedProcedure
    .input(z.object({ workspaceId: z.string(), type: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.integration.findUnique({
        where: {
          workspaceId_type: {
            workspaceId: input.workspaceId,
            type: input.type,
          },
        },
      });
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        type: z.string(),
        name: z.string(),
        config: z.any().optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.integration.upsert({
        where: {
          workspaceId_type: {
            workspaceId: input.workspaceId,
            type: input.type,
          },
        },
        create: {
          workspaceId: input.workspaceId,
          type: input.type,
          name: input.name,
          config: input.config,
          isActive: input.isActive,
          createdById: ctx.session.user.id,
        },
        update: {
          name: input.name,
          config: input.config,
          isActive: input.isActive,
        },
      });
    }),

  toggleActive: protectedProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.integration.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.integration.delete({ where: { id: input.id } });
    }),

  testConnection: protectedProcedure
    .input(z.object({ workspaceId: z.string(), type: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          workspaceId_type: {
            workspaceId: input.workspaceId,
            type: input.type,
          },
        },
      });

      if (!integration) {
        return { success: false, message: "Integration not configured" };
      }

      const config = integration.config as Record<string, string> | null;

      try {
        switch (input.type) {
          case "SLACK": {
            if (!config?.webhookUrl) return { success: false, message: "No webhook URL configured" };
            const res = await fetch(config.webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: "✅ TaskFlow AI connection test successful!" }),
            });
            return res.ok
              ? { success: true, message: "Slack webhook is working" }
              : { success: false, message: `Slack returned ${res.status}` };
          }
          case "GITHUB": {
            if (!config?.apiKey) return { success: false, message: "No GitHub token configured" };
            const res = await fetch("https://api.github.com/user", {
              headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "application/vnd.github+json" },
            });
            if (res.ok) {
              const user = await res.json();
              return { success: true, message: `Connected as ${user.login}` };
            }
            return { success: false, message: `GitHub returned ${res.status}` };
          }
          case "CALENDAR": {
            return { success: true, message: "Calendar feed URL is ready" };
          }
          default:
            return { success: true, message: "Connection configured" };
        }
      } catch (err: any) {
        return { success: false, message: err.message || "Connection failed" };
      }
    }),

  // Slack: Send notification
  sendSlackNotification: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      message: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: { workspaceId_type: { workspaceId: input.workspaceId, type: "SLACK" } },
      });
      if (!integration?.isActive) return { sent: false };
      const config = integration.config as Record<string, string> | null;
      if (!config?.webhookUrl) return { sent: false };

      await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input.message }),
      });
      return { sent: true };
    }),

  // GitHub: Close issue
  closeGithubIssue: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      owner: z.string(),
      repo: z.string(),
      issueNumber: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: { workspaceId_type: { workspaceId: input.workspaceId, type: "GITHUB" } },
      });
      if (!integration?.isActive) return { closed: false };
      const config = integration.config as Record<string, string> | null;
      if (!config?.apiKey) return { closed: false };

      const res = await fetch(
        `https://api.github.com/repos/${input.owner}/${input.repo}/issues/${input.issueNumber}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            Accept: "application/vnd.github+json",
          },
          body: JSON.stringify({ state: "closed" }),
        }
      );
      return { closed: res.ok };
    }),

  generateApiKey: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const apiKey = `tfai_${crypto.randomBytes(32).toString("hex")}`;
      await ctx.prisma.integration.upsert({
        where: {
          workspaceId_type: {
            workspaceId: input.workspaceId,
            type: "zapier",
          },
        },
        create: {
          workspaceId: input.workspaceId,
          type: "zapier",
          name: "Zapier",
          config: { apiKey },
          createdById: ctx.session.user.id,
        },
        update: {
          config: { apiKey },
        },
      });
      return { apiKey };
    }),

  generateCalendarToken: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const token = crypto.randomBytes(24).toString("hex");
      await ctx.prisma.integration.upsert({
        where: {
          workspaceId_type: {
            workspaceId: input.workspaceId,
            type: "CALENDAR",
          },
        },
        create: {
          workspaceId: input.workspaceId,
          type: "CALENDAR",
          name: "Calendar Sync",
          config: { token, userId: ctx.session.user.id },
          createdById: ctx.session.user.id,
        },
        update: {
          config: { token, userId: ctx.session.user.id },
        },
      });
      return { token, feedUrl: `/api/calendar/feed/${token}` };
    }),
});
