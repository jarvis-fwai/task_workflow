import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const formsRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.form.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "desc" },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.form.findUniqueOrThrow({
        where: { id: input.id },
        include: { project: true },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        fields: z.array(
          z.object({
            id: z.string(),
            label: z.string(),
            type: z.enum(["TEXT", "TEXTAREA", "SELECT", "DATE", "NUMBER"]),
            required: z.boolean().default(false),
            options: z.array(z.string()).optional(),
            mapToField: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;

      return ctx.prisma.form.create({
        data: {
          name: input.name,
          description: input.description,
          projectId: input.projectId,
          fields: input.fields,
          publicSlug: slug,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        fields: z.any().optional(),
        isPublished: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.form.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.form.delete({ where: { id: input.id } });
    }),

  // Get form by public slug (for public form page - no auth required)
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const form = await ctx.prisma.form.findUnique({
        where: { publicSlug: input.slug },
        include: { project: true },
      });

      if (!form || !form.isPublished) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Form not found" });
      }

      return form;
    }),

  // Submit form (creates a task - public, no auth required)
  submit: publicProcedure
    .input(
      z.object({
        formId: z.string(),
        values: z.record(z.string(), z.any()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const form = await ctx.prisma.form.findUniqueOrThrow({
        where: { id: input.formId },
        include: { project: { select: { id: true, workspaceId: true } } },
      });

      const title =
        (input.values["title"] as string) ||
        `Form submission: ${form.name}`;

      // For public submissions, use the project creator as the task creator
      const project = await ctx.prisma.project.findUniqueOrThrow({
        where: { id: form.project.id },
        select: { createdById: true },
      });

      return ctx.prisma.task.create({
        data: {
          title,
          description: JSON.stringify(input.values),
          workspaceId: form.project.workspaceId,
          createdById: project.createdById,
          taskProjects: {
            create: {
              projectId: form.project.id,
              position: Date.now(),
            },
          },
        },
      });
    }),
});
