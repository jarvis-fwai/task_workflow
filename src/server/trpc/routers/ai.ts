import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { openai } from "../../ai/openai-client";
import { TRPCError } from "@trpc/server";

function generateMockResponse(message: string, taskContext: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("priority") || lower.includes("what should i work on")) {
    if (taskContext) {
      return `Based on your current tasks, here's my suggestion:\n\n${taskContext}\n\n**Recommendation:** Focus on overdue tasks first, then upcoming deadlines. Break large tasks into smaller subtasks if they feel overwhelming.`;
    }
    return "You don't have any tasks assigned yet. Head to **My Tasks** to see your work, or ask your project manager to assign tasks to you.";
  }
  if (lower.includes("dark mode") || lower.includes("theme")) {
    return "To enable dark mode:\n1. Go to **Settings** → **Display** tab\n2. Select **Dark** from the theme options\n3. The change applies immediately!";
  }
  if (lower.includes("2fa") || lower.includes("two-factor")) {
    return "To set up 2FA:\n1. Go to **Settings** → **Security** tab\n2. Click **Enable Two-Factor Authentication**\n3. Scan the QR code with your authenticator app\n4. Enter the verification code to confirm\n5. Save your backup codes in a safe place!";
  }
  if (lower.includes("overdue")) {
    if (taskContext.includes("OVERDUE")) {
      return `Here are your overdue tasks:\n\n${taskContext}\n\nI recommend addressing these as soon as possible. Consider updating deadlines if they're no longer realistic.`;
    }
    return "Great news — you don't have any overdue tasks! Keep up the good work. 🎉";
  }
  return `I can help you with:\n- **Task prioritization** — "What should I work on?"\n- **Navigation** — "Where do I find settings?"\n- **Feature guidance** — "How do I enable dark mode?"\n- **Project insights** — "Show me my overdue tasks"\n\nWhat would you like help with?`;
}

const TASKFLOW_SITE_MAP = `
TaskFlow AI Site Structure:
- /home — Dashboard with task overview, projects, goals widgets
- /my-tasks — Your personal task list (upcoming, overdue, completed)
- /inbox — Notifications inbox
- /goals — Goals tracking and management
- /portfolios — Portfolio management
- /reporting — Reports and analytics dashboards
- /workload — Team workload visualization
- /settings — User settings with these tabs:
  - Profile tab: name, email, job title, department, bio, profile picture/avatar upload
  - Notifications tab: in-app notifications, email notifications, task assigned, task completed, new comment, @mentions, due date approaching, status updates, follower notifications
  - Security tab: change password, two-factor authentication (2FA) setup with QR code and backup codes, account deletion
  - Display tab: theme (light/dark/system), sidebar color, compact mode, language selection (English, Español, Français, Deutsch, 日本語)
- /admin — Admin console: workspace settings, member management, security policies, data export
- /integrations — Third-party integrations (Slack, GitHub, Jira, Figma, Google Drive, Zapier)
- /projects/:id — Individual project views (List, Board, Timeline, Calendar, Overview, Dashboard, Workflow, Files, Messages)
`;

export const aiRouter = router({
  // AI Chat with full conversation memory and task awareness
  chat: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1).max(5000),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string(),
            })
          )
          .optional(),
        context: z
          .object({
            projectId: z.string().optional(),
            taskId: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch the user's tasks for context
      const workspace = await ctx.prisma.workspace.findFirst({
        where: { members: { some: { userId: ctx.session.user.id } } },
      });

      let taskContext = "";
      let projectContext = "";
      const actions: Array<{ label: string; href: string; type: string }> = [];

      if (workspace) {
        const myTasks = await ctx.prisma.task.findMany({
          where: {
            assigneeId: ctx.session.user.id,
            workspaceId: workspace.id,
            status: "INCOMPLETE",
            parentTaskId: null,
          },
          include: {
            taskProjects: { include: { project: true, section: true } },
          },
          take: 20,
          orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        });

        if (myTasks.length > 0) {
          const now = new Date();
          const sortedByDeadline = [...myTasks]
            .filter((t) => t.dueDate)
            .sort(
              (a, b) =>
                new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
            );

          const overdue = sortedByDeadline.filter(
            (t) => new Date(t.dueDate!) < now
          );
          const upcoming = sortedByDeadline.filter(
            (t) => new Date(t.dueDate!) >= now
          );
          const noDueDate = myTasks.filter((t) => !t.dueDate);

          taskContext = `\n\nUser's current tasks (${myTasks.length} incomplete):`;
          if (overdue.length > 0) {
            taskContext += `\nOVERDUE (${overdue.length}):`;
            overdue.forEach((t) => {
              taskContext += `\n- "${t.title}" (due: ${new Date(t.dueDate!).toLocaleDateString()}, project: ${t.taskProjects[0]?.project?.name || "None"}, id: ${t.id}, projectId: ${t.taskProjects[0]?.project?.id || "none"})`;
            });
          }
          if (upcoming.length > 0) {
            taskContext += `\nUPCOMING (${upcoming.length}):`;
            upcoming.slice(0, 10).forEach((t) => {
              taskContext += `\n- "${t.title}" (due: ${new Date(t.dueDate!).toLocaleDateString()}, project: ${t.taskProjects[0]?.project?.name || "None"}, id: ${t.id}, projectId: ${t.taskProjects[0]?.project?.id || "none"})`;
            });
          }
          if (noDueDate.length > 0) {
            taskContext += `\nNO DUE DATE (${noDueDate.length}):`;
            noDueDate.slice(0, 5).forEach((t) => {
              taskContext += `\n- "${t.title}" (project: ${t.taskProjects[0]?.project?.name || "None"}, id: ${t.id}, projectId: ${t.taskProjects[0]?.project?.id || "none"})`;
            });
          }
        }

        // Get projects
        const projects = await ctx.prisma.project.findMany({
          where: { workspaceId: workspace.id, isArchived: false },
          select: { id: true, name: true },
          take: 10,
        });
        if (projects.length > 0) {
          taskContext += `\n\nUser's projects: ${projects.map((p) => `"${p.name}" (id: ${p.id})`).join(", ")}`;
        }

        // Get goals
        const goals = await ctx.prisma.goal.findMany({
          where: { workspaceId: workspace.id },
          select: { id: true, name: true, status: true },
          take: 10,
        });
        if (goals.length > 0) {
          taskContext += `\n\nUser's goals: ${goals.map((g) => `"${g.name}" (${g.status})`).join(", ")}`;
        }
      }

      // Get specific project context if provided
      if (input.context?.projectId) {
        const project = await ctx.prisma.project.findUnique({
          where: { id: input.context.projectId },
          include: {
            sections: true,
            taskProjects: {
              include: { task: true, section: true },
              take: 20,
            },
          },
        });
        if (project) {
          const tasks = project.taskProjects.map((tp) => tp.task);
          const incomplete = tasks.filter((t) => t.status === "INCOMPLETE");
          const complete = tasks.filter((t) => t.status === "COMPLETE");
          projectContext = `\nCurrently viewing project: "${project.name}"
- Sections: ${project.sections.map((s) => s.name).join(", ")}
- ${incomplete.length} incomplete tasks, ${complete.length} completed
- Tasks: ${incomplete.slice(0, 10).map((t) => `"${t.title}"`).join(", ")}`;
        }
      }

      const systemPrompt = `You are TaskFlow AI, the intelligent assistant built into TaskFlow — a project management application similar to Asana. You have full knowledge of the user's tasks, projects, goals, and the entire site structure.

Your capabilities:
1. **Task Intelligence**: You know the user's tasks, deadlines, and priorities. When they ask about priority tasks or what to work on, analyze their tasks by deadline proximity and provide ordered recommendations.
2. **Navigation Help**: You can guide users to any part of TaskFlow. When relevant, include navigation links in your response using this format: [[link:Page Name:/path]] — these will become clickable buttons.
3. **Site Expertise**: You know every feature of TaskFlow including settings, notifications, 2FA, dark mode, profile, admin, reporting, etc. Guide users step by step.
4. **Memory**: You remember the full conversation history. Reference earlier messages to provide contextual help.
5. **Task Management Advice**: Help with project planning, task breakdown, prioritization, and productivity tips.

${TASKFLOW_SITE_MAP}
${taskContext}
${projectContext}

IMPORTANT RULES:
- When the user asks about their tasks or priorities, list them ordered by deadline (nearest first) and include clickable links: [[link:Task Name:/projects/PROJECT_ID]]
- When the user asks how to do something in TaskFlow (like enable dark mode, change password, enable 2FA, etc.), give step-by-step instructions AND include a navigation link.
- Use [[link:Label:/path]] syntax for ANY page reference so the UI renders clickable navigation buttons.
- Keep responses helpful and concise. Use markdown formatting (bold, bullets, etc.).
- Today's date is: ${new Date().toLocaleDateString()}
- The user's name is: ${ctx.session.user.name || "User"}`;

      // Build conversation messages from history
      const messages: Array<{
        role: "user" | "assistant" | "system";
        content: string;
      }> = [{ role: "system", content: systemPrompt }];

      // Add conversation history (last 20 messages for context window)
      if (input.history && input.history.length > 0) {
        const recentHistory = input.history.slice(-20);
        for (const msg of recentHistory) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }

      // Add the current message
      messages.push({ role: "user", content: input.message });

      // Check if API key is configured
      if (!process.env.OPENAI_API_KEY) {
        // Mock response when no API key
        const mockResponse = generateMockResponse(input.message, taskContext);
        return { response: mockResponse, actions };
      }

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 800,
          temperature: 0.7,
        });

        const response =
          completion.choices[0]?.message?.content ||
          "I couldn't process your request.";

        // Extract navigation actions from [[link:...]] patterns
        const linkPattern = /\[\[link:([^:]+):([^\]]+)\]\]/g;
        let match;
        while ((match = linkPattern.exec(response)) !== null) {
          actions.push({
            label: match[1]!,
            href: match[2]!,
            type: "navigate",
          });
        }

        // Clean the response by replacing [[link:...]] with just the label for display
        const cleanResponse = response.replace(
          /\[\[link:([^:]+):([^\]]+)\]\]/g,
          "**$1**"
        );

        return { response: cleanResponse, actions };
      } catch (error: any) {
        // Fallback to mock on error
        const mockResponse = generateMockResponse(input.message, taskContext);
        return { response: mockResponse + "\n\n*Note: AI service is currently unavailable. This is a helpful placeholder response.*", actions };
      }
    }),

  // Summarize a task's activity and current state
  summarizeTask: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.taskId },
        include: {
          assignee: true,
          subtasks: { include: { assignee: true } },
          comments: {
            include: { author: true },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          taskProjects: { include: { project: true, section: true } },
          tags: { include: { tag: true } },
        },
      });

      const subtaskStatus =
        task.subtasks.length > 0
          ? `${task.subtasks.filter((s) => s.status === "COMPLETE").length}/${task.subtasks.length} subtasks completed`
          : "No subtasks";

      const recentComments = task.comments
        .map(
          (c) =>
            `- ${c.author.name}: ${typeof c.body === "string" ? c.body : JSON.stringify(c.body)}`
        )
        .join("\n");

      const prompt = `Summarize this task concisely in 2-3 sentences:\n\nTask: "${task.title}"\nStatus: ${task.status}\nAssignee: ${task.assignee?.name || "Unassigned"}\nDue: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}\nProject: ${task.taskProjects[0]?.project.name || "None"} / ${task.taskProjects[0]?.section?.name || "None"}\nTags: ${task.tags.map((t) => t.tag.name).join(", ") || "None"}\nSubtasks: ${subtaskStatus}\n${recentComments ? `Recent comments:\n${recentComments}` : "No comments"}\n\nProvide a brief, actionable summary.`;

      if (!process.env.OPENAI_API_KEY) {
        return {
          summary: `**${task.title}** is ${task.status.toLowerCase()} and assigned to ${task.assignee?.name || "nobody"}. ${task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}.` : "No due date set."} ${subtaskStatus}. ${recentComments ? "Has recent activity in comments." : "No recent comments."}`,
        };
      }

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 300,
        });
        return {
          summary:
            completion.choices[0]?.message?.content ||
            "Unable to generate summary.",
        };
      } catch {
        return {
          summary: `**${task.title}** is ${task.status.toLowerCase()} and assigned to ${task.assignee?.name || "nobody"}. ${task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}.` : "No due date set."} ${subtaskStatus}.`,
        };
      }
    }),

  // Generate a project status update
  generateProjectStatus: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUniqueOrThrow({
        where: { id: input.projectId },
        include: {
          sections: true,
          taskProjects: {
            include: {
              task: { include: { assignee: true } },
              section: true,
            },
          },
          statusUpdates: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { author: true },
          },
        },
      });

      const allTasks = project.taskProjects.map((tp) => tp.task);
      const totalTasks = allTasks.length;
      const completedTasks = allTasks.filter(
        (t) => t.status === "COMPLETE"
      ).length;
      const overdueTasks = allTasks.filter(
        (t) =>
          t.status === "INCOMPLETE" &&
          t.dueDate &&
          new Date(t.dueDate) < new Date()
      ).length;

      const sectionBreakdown = project.sections
        .map((s) => {
          const sectionTasks = project.taskProjects.filter(
            (tp) => tp.sectionId === s.id
          );
          const complete = sectionTasks.filter(
            (tp) => tp.task.status === "COMPLETE"
          ).length;
          return `${s.name}: ${complete}/${sectionTasks.length} tasks complete`;
        })
        .join("\n");

      const prompt = `Generate a brief project status update.\n\nProject: "${project.name}"\nTotal Tasks: ${totalTasks}\nCompleted: ${completedTasks} (${totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%)\nOverdue: ${overdueTasks}\nSections:\n${sectionBreakdown}\n\nLast status update: ${project.statusUpdates[0] ? `${project.statusUpdates[0].status} by ${project.statusUpdates[0].author.name}` : "None"}\n\nWrite a status update with:\n1. Overall status assessment (On Track / At Risk / Off Track)\n2. Key highlights (2-3 bullet points)\n3. Blockers or risks\n4. Next steps`;

      const stats = {
        total: totalTasks,
        completed: completedTasks,
        overdue: overdueTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      };

      if (!process.env.OPENAI_API_KEY) {
        const statusLabel = overdueTasks > 2 ? "Off Track 🔴" : overdueTasks > 0 ? "At Risk 🟡" : "On Track 🟢";
        return {
          status: `**${statusLabel}**\n\n**Progress:** ${stats.completionRate}% complete (${completedTasks}/${totalTasks} tasks)\n\n**Highlights:**\n- ${completedTasks} tasks completed\n- ${overdueTasks} overdue tasks\n\n**Section breakdown:**\n${sectionBreakdown}\n\n*Note: AI service not configured. This is an auto-generated summary.*`,
          stats,
        };
      }

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
        });

        return {
          status: completion.choices[0]?.message?.content || "Unable to generate status.",
          stats,
        };
      } catch {
        const statusLabel = overdueTasks > 2 ? "Off Track 🔴" : overdueTasks > 0 ? "At Risk 🟡" : "On Track 🟢";
        return {
          status: `**${statusLabel}** — ${stats.completionRate}% complete. ${overdueTasks} overdue tasks.\n\n${sectionBreakdown}`,
          stats,
        };
      }
    }),

  // Natural language task creation
  parseTaskFromText: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1).max(2000),
        projectId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const prompt = `Parse the following natural language text into structured task data. Extract the task title, description, due date (if mentioned), and priority level.\n\nText: "${input.text}"\n\nRespond ONLY with valid JSON (no markdown, no code fences):\n{"title": "The task title", "description": "Optional description or null", "dueDate": "ISO date string or null", "priority": "high" | "medium" | "low" | null, "subtasks": ["subtask 1"] or []}`;

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 300,
        });

        const text = completion.choices[0]?.message?.content;
        if (!text) throw new Error("No response");

        const parsed = JSON.parse(text);
        return {
          title: parsed.title || input.text,
          description: parsed.description || null,
          dueDate: parsed.dueDate || null,
          priority: parsed.priority || null,
          subtasks: parsed.subtasks || [],
        };
      } catch {
        return {
          title: input.text,
          description: null,
          dueDate: null,
          priority: null,
          subtasks: [],
        };
      }
    }),

  // Smart task prioritization suggestions
  suggestPriorities: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tasks = await ctx.prisma.task.findMany({
        where: {
          assigneeId: ctx.session.user.id,
          workspaceId: input.workspaceId,
          status: "INCOMPLETE",
          parentTaskId: null,
        },
        include: {
          taskProjects: { include: { project: true } },
        },
        take: 15,
        orderBy: { createdAt: "desc" },
      });

      if (tasks.length === 0) {
        return { suggestions: "You have no incomplete tasks! Great work." };
      }

      const taskList = tasks
        .map(
          (t, i) =>
            `${i + 1}. "${t.title}" - Due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "No date"} - Project: ${t.taskProjects[0]?.project.name || "None"}`
        )
        .join("\n");

      const prompt = `As a productivity expert, analyze these tasks and suggest a prioritized order with brief reasoning. Group them into: Do Today, Do This Week, Schedule Later.\n\nTasks:\n${taskList}\n\nProvide actionable prioritization advice. Keep it concise.`;

      if (!process.env.OPENAI_API_KEY) {
        // Simple heuristic-based prioritization
        const now = new Date();
        const doToday = tasks.filter((t) => t.dueDate && new Date(t.dueDate) <= new Date(now.getTime() + 86400000));
        const thisWeek = tasks.filter((t) => t.dueDate && new Date(t.dueDate) > new Date(now.getTime() + 86400000) && new Date(t.dueDate) <= new Date(now.getTime() + 7 * 86400000));
        const later = tasks.filter((t) => !t.dueDate || new Date(t.dueDate) > new Date(now.getTime() + 7 * 86400000));

        let suggestions = "**Do Today:**\n";
        suggestions += doToday.length ? doToday.map((t) => `- ${t.title}`).join("\n") : "- No urgent tasks";
        suggestions += "\n\n**Do This Week:**\n";
        suggestions += thisWeek.length ? thisWeek.map((t) => `- ${t.title}`).join("\n") : "- No tasks due this week";
        suggestions += "\n\n**Schedule Later:**\n";
        suggestions += later.length ? later.map((t) => `- ${t.title}`).join("\n") : "- Nothing to defer";
        suggestions += "\n\n*Auto-prioritized by due date. Configure an AI key for smarter suggestions.*";
        return { suggestions };
      }

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
        });

        return {
          suggestions: completion.choices[0]?.message?.content || "Unable to generate suggestions.",
        };
      } catch {
        return { suggestions: "AI service temporarily unavailable. Please try again later." };
      }
    }),
});
