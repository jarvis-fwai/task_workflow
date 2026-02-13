import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Find the integration with this calendar token
  const integrations = await prisma.integration.findMany({
    where: { type: "CALENDAR" },
  });

  const integration = integrations.find((i) => {
    const config = i.config as Record<string, string> | null;
    return config?.token === token;
  });

  if (!integration) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  const config = integration.config as Record<string, string>;

  // Get tasks with due dates for this workspace
  const tasks = await prisma.task.findMany({
    where: {
      workspaceId: integration.workspaceId,
      dueDate: { not: null },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      status: true,
      assignee: { select: { name: true } },
    },
    take: 500,
  });

  // Generate iCal feed
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TaskFlow AI//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:TaskFlow Tasks",
  ];

  for (const task of tasks) {
    if (!task.dueDate) continue;
    const date = task.dueDate.toISOString().split("T")[0]!.replace(/-/g, "");
    const nextDay = new Date(task.dueDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const endDate = nextDay.toISOString().split("T")[0]!.replace(/-/g, "");

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${task.id}@taskflow`);
    lines.push(`DTSTART;VALUE=DATE:${date}`);
    lines.push(`DTEND;VALUE=DATE:${endDate}`);
    lines.push(`SUMMARY:${task.title.replace(/[,;\\]/g, " ")}${task.status === "COMPLETE" ? " ✓" : ""}`);
    if (task.assignee) {
      lines.push(`DESCRIPTION:Assigned to ${task.assignee.name}`);
    }
    lines.push(`DTSTAMP:${now}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="taskflow.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
