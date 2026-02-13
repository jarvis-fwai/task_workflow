"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LayoutTemplate, Plus, Trash2, FolderPlus } from "lucide-react";

interface TemplateGalleryProps {
  workspaceId: string;
}

export function TemplateGallery({ workspaceId }: TemplateGalleryProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");

  const { data: templates } = trpc.templates.list.useQuery({ workspaceId });
  const utils = trpc.useUtils();

  const createFromTemplate = trpc.templates.createProjectFromTemplate.useMutation({
    onSuccess: (project) => {
      toast.success("Project created from template");
      setCreateOpen(false);
      setSelectedTemplate(null);
      setProjectName("");
      router.push(`/projects/${project.id}`);
    },
  });

  const deleteTemplate = trpc.templates.delete.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate({ workspaceId });
      toast.success("Template deleted");
    },
  });

  const handleCreate = () => {
    if (!selectedTemplate || !projectName.trim()) return;
    createFromTemplate.mutate({
      templateId: selectedTemplate,
      workspaceId,
      name: projectName,
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Project Templates</h3>

      {templates?.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <LayoutTemplate className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">No templates yet</p>
          <p className="text-xs text-gray-400">
            Save a project as a template from its settings menu
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {templates?.map((template) => (
          <div
            key={template.id}
            className="group rounded-lg border p-4 hover:border-blue-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-medium">{template.name}</h4>
                {template.description && (
                  <p className="mt-1 text-xs text-gray-500">
                    {template.description}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100"
                onClick={() => deleteTemplate.mutate({ id: template.id })}
              >
                <Trash2 className="h-3 w-3 text-red-400" />
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => {
                setSelectedTemplate(template.id);
                setProjectName(template.name);
                setCreateOpen(true);
              }}
            >
              <FolderPlus className="mr-1 h-3 w-3" /> Use Template
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project from Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Project Name</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My new project"
              />
            </div>
            <Button onClick={handleCreate} disabled={!projectName.trim()} className="w-full">
              Create Project
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
