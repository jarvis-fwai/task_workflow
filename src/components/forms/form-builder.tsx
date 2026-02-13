"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  GripVertical,
  FileText,
  Link2,
  Copy,
  ExternalLink,
} from "lucide-react";

interface FormField {
  id: string;
  label: string;
  type: "TEXT" | "TEXTAREA" | "SELECT" | "DATE" | "NUMBER";
  required: boolean;
  options?: string[];
}

interface FormBuilderProps {
  projectId: string;
}

export function FormBuilder({ projectId }: FormBuilderProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);

  const utils = trpc.useUtils();
  const { data: forms } = trpc.forms.list.useQuery({ projectId });

  const createForm = trpc.forms.create.useMutation({
    onSuccess: () => {
      utils.forms.list.invalidate({ projectId });
      setShowCreate(false);
      setName("");
      setDescription("");
      setFields([]);
      toast.success("Form created");
    },
  });

  const updateForm = trpc.forms.update.useMutation({
    onSuccess: () => {
      utils.forms.list.invalidate({ projectId });
      toast.success("Form updated");
    },
  });

  const deleteForm = trpc.forms.delete.useMutation({
    onSuccess: () => {
      utils.forms.list.invalidate({ projectId });
      toast.success("Form deleted");
    },
  });

  const addField = () => {
    setFields([
      ...fields,
      {
        id: `field_${Date.now()}`,
        label: "",
        type: "TEXT",
        required: false,
      },
    ]);
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleCreate = () => {
    if (!name.trim() || fields.length === 0) return;
    createForm.mutate({ projectId, name, description, fields });
  };

  const copyFormLink = (slug: string) => {
    const url = `${window.location.origin}/forms/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Form link copied to clipboard");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Forms</h3>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-3 w-3" /> New Form
        </Button>
      </div>

      {forms?.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">No forms yet</p>
          <p className="text-xs text-gray-400">
            Create intake forms to collect task requests
          </p>
        </div>
      )}

      {forms?.map((form) => (
        <div
          key={form.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium">{form.name}</span>
              <Badge variant={form.isPublished ? "default" : "secondary"}>
                {form.isPublished ? "Published" : "Draft"}
              </Badge>
            </div>
            {form.description && (
              <p className="mt-1 text-xs text-gray-500">{form.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {form.isPublished && form.publicSlug && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyFormLink(form.publicSlug!)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    window.open(`/forms/${form.publicSlug}`, "_blank")
                  }
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                updateForm.mutate({
                  id: form.id,
                  isPublished: !form.isPublished,
                })
              }
            >
              {form.isPublished ? "Unpublish" : "Publish"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500"
              onClick={() => deleteForm.mutate({ id: form.id })}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Form</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Form Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Bug Report"
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this form..."
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Fields</Label>
                <Button size="sm" variant="outline" onClick={addField}>
                  <Plus className="mr-1 h-3 w-3" /> Add Field
                </Button>
              </div>
              <div className="space-y-3">
                {fields.map((field, i) => (
                  <div
                    key={field.id}
                    className="flex items-start gap-2 rounded border p-2"
                  >
                    <GripVertical className="mt-2 h-4 w-4 text-gray-300" />
                    <div className="flex-1 space-y-2">
                      <Input
                        value={field.label}
                        onChange={(e) =>
                          updateField(i, { label: e.target.value })
                        }
                        placeholder="Field label"
                        className="h-8 text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <Select
                          value={field.type}
                          onValueChange={(val) =>
                            updateField(i, { type: val as FormField["type"] })
                          }
                        >
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TEXT">Text</SelectItem>
                            <SelectItem value="TEXTAREA">Paragraph</SelectItem>
                            <SelectItem value="NUMBER">Number</SelectItem>
                            <SelectItem value="DATE">Date</SelectItem>
                            <SelectItem value="SELECT">Dropdown</SelectItem>
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-1 text-xs">
                          <Switch
                            checked={field.required}
                            onCheckedChange={(v) =>
                              updateField(i, { required: v })
                            }
                            className="scale-75"
                          />
                          Required
                        </label>
                      </div>
                      {field.type === "SELECT" && (
                        <Input
                          placeholder="Options (comma-separated)"
                          className="h-8 text-xs"
                          onChange={(e) =>
                            updateField(i, {
                              options: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeField(i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={handleCreate}
              disabled={!name.trim() || fields.length === 0}
              className="w-full"
            >
              Create Form
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
