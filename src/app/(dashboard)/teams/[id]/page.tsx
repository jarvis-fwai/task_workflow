"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FolderOpen, Plus, Crown, User } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: team, isLoading } = trpc.teams.get.useQuery({ id });

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-32 w-full" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Team not found</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#4573D2]">
          <Users className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-[#1e1f21]">{team.name}</h1>
          {team.description && (
            <p className="text-sm text-muted-foreground">{team.description}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Members ({team.members?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {team.members?.map((member: any) => (
                <div key={member.id} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-[#4573D2] text-xs text-white">
                      {member.user?.name
                        ?.split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{member.user?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.user?.email}
                    </p>
                  </div>
                  {member.role === "LEAD" && (
                    <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700">
                      <Crown className="h-3 w-3" /> Lead
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-4 w-4" />
              Projects ({team.projects?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {team.projects?.map((project: any) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"
                >
                  <div
                    className="h-4 w-4 rounded"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="text-sm font-medium">{project.name}</span>
                </Link>
              ))}
              {(!team.projects || team.projects.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  No projects in this team yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
