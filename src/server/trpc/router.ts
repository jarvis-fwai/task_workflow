import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { workspacesRouter } from "./routers/workspaces";
import { teamsRouter } from "./routers/teams";
import { projectsRouter } from "./routers/projects";
import { sectionsRouter } from "./routers/sections";
import { tasksRouter } from "./routers/tasks";
import { commentsRouter } from "./routers/comments";
import { portfoliosRouter } from "./routers/portfolios";
import { goalsRouter } from "./routers/goals";
import { notificationsRouter } from "./routers/notifications";
import { aiRouter } from "./routers/ai";
import { searchRouter } from "./routers/search";
import { attachmentsRouter } from "./routers/attachments";
import { customFieldsRouter } from "./routers/customFields";
import { rulesRouter } from "./routers/rules";
import { formsRouter } from "./routers/forms";
import { templatesRouter } from "./routers/templates";
import { reportingRouter } from "./routers/reporting";
import { recentsRouter } from "./routers/recents";
import { reactionsRouter } from "./routers/reactions";
import { viewsRouter } from "./routers/views";
import { savedReportsRouter } from "./routers/savedReports";
import { dashboardsRouter } from "./routers/dashboards";
import { approvalsRouter } from "./routers/approvals";
import { workloadRouter } from "./routers/workload";
import { integrationsRouter } from "./routers/integrations";
import { annotationsRouter } from "./routers/annotations";
import { presenceRouter } from "./routers/presence";

export const appRouter = router({
  auth: authRouter,
  workspaces: workspacesRouter,
  teams: teamsRouter,
  projects: projectsRouter,
  sections: sectionsRouter,
  tasks: tasksRouter,
  comments: commentsRouter,
  portfolios: portfoliosRouter,
  goals: goalsRouter,
  notifications: notificationsRouter,
  ai: aiRouter,
  search: searchRouter,
  attachments: attachmentsRouter,
  customFields: customFieldsRouter,
  rules: rulesRouter,
  forms: formsRouter,
  templates: templatesRouter,
  reporting: reportingRouter,
  recents: recentsRouter,
  reactions: reactionsRouter,
  views: viewsRouter,
  savedReports: savedReportsRouter,
  dashboards: dashboardsRouter,
  approvals: approvalsRouter,
  workload: workloadRouter,
  integrations: integrationsRouter,
  annotations: annotationsRouter,
  presence: presenceRouter,
});

export type AppRouter = typeof appRouter;
