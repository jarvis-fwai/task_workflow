"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PROJECT_COLORS = [
  "#4573D2",
  "#F06A6A",
  "#F8DF72",
  "#63D9EA",
  "#AA62E3",
  "#E8384F",
  "#FD9A00",
  "#7BC86C",
  "#F19DFB",
  "#4ECBC4",
];

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  workspaceId,
}: CreateProjectDialogProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [defaultView, setDefaultView] = useState<"LIST" | "BOARD">("LIST");

  const { data: teams } = trpc.teams.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );
  const [teamId, setTeamId] = useState<string>("");

  const createProject = trpc.projects.create.useMutation({
    onSuccess: (project) => {
      utils.projects.list.invalidate();
      onOpenChange(false);
      setName("");
      router.push(`/projects/${project.id}`);
    },
  });

  const { data: templates } = trpc.templates.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  const createFromTemplate = trpc.templates.createProjectFromTemplate.useMutation({
    onSuccess: (project) => {
      utils.projects.list.invalidate();
      onOpenChange(false);
      setName("");
      router.push(`/projects/${project.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !workspaceId) return;
    if (selectedTemplate) {
      createFromTemplate.mutate({
        templateId: selectedTemplate,
        workspaceId,
        teamId: teamId || undefined,
        name: name.trim(),
      });
    } else {
      createProject.mutate({
        name: name.trim(),
        workspaceId,
        teamId: teamId || undefined,
        color,
        defaultView,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name"
              autoFocus
            />
          </div>

          {templates && templates.length > 0 && (
            <div className="space-y-2">
              <Label>Template (optional)</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Blank project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Blank project</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${
                    color === c
                      ? "scale-110 border-gray-900"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Default view</Label>
            <Select
              value={defaultView}
              onValueChange={(v) => setDefaultView(v as "LIST" | "BOARD")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LIST">List</SelectItem>
                <SelectItem value="BOARD">Board</SelectItem>
                <SelectItem value="TIMELINE">Timeline</SelectItem>
                <SelectItem value="CALENDAR">Calendar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {teams && teams.length > 0 && (
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || createProject.isPending}
              className="bg-[#4573D2] hover:bg-[#3A63B8]"
            >
              {createProject.isPending ? "Creating..." : "Create project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
