"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
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
import { CheckCircle2, FileText, Loader2 } from "lucide-react";

interface FormField {
  id: string;
  label: string;
  type: "TEXT" | "TEXTAREA" | "SELECT" | "DATE" | "NUMBER";
  required: boolean;
  options?: string[];
  mapToField?: string;
}

export default function PublicFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data: form, isLoading, error } = trpc.forms.getBySlug.useQuery(
    { slug },
    { retry: false }
  );

  const submitForm = trpc.forms.submit.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <h1 className="mt-4 text-xl font-semibold text-gray-900">
            Form not found
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            This form may have been unpublished or deleted.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <h1 className="mt-4 text-xl font-semibold text-gray-900">
            Thank you!
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Your submission has been received.
          </p>
        </div>
      </div>
    );
  }

  const fields = (form.fields as unknown as FormField[]) || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate required fields
    for (const field of fields) {
      if (field.required && !values[field.id]) {
        return;
      }
    }
    submitForm.mutate({ formId: form.id, values });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-lg">
        <div className="rounded-lg bg-white p-8 shadow-sm">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
            {form.project?.name}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{form.name}</h1>
          {form.description && (
            <p className="mt-2 text-sm text-gray-600">{form.description}</p>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {fields.map((field) => (
              <div key={field.id}>
                <Label className="text-sm font-medium text-gray-700">
                  {field.label}
                  {field.required && (
                    <span className="ml-1 text-red-500">*</span>
                  )}
                </Label>
                <div className="mt-1.5">
                  {field.type === "TEXT" && (
                    <Input
                      value={values[field.id] || ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [field.id]: e.target.value }))
                      }
                      required={field.required}
                    />
                  )}
                  {field.type === "TEXTAREA" && (
                    <textarea
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      rows={4}
                      value={values[field.id] || ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [field.id]: e.target.value }))
                      }
                      required={field.required}
                    />
                  )}
                  {field.type === "NUMBER" && (
                    <Input
                      type="number"
                      value={values[field.id] || ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [field.id]: e.target.value }))
                      }
                      required={field.required}
                    />
                  )}
                  {field.type === "DATE" && (
                    <Input
                      type="date"
                      value={values[field.id] || ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [field.id]: e.target.value }))
                      }
                      required={field.required}
                    />
                  )}
                  {field.type === "SELECT" && (
                    <Select
                      value={values[field.id] || ""}
                      onValueChange={(val) =>
                        setValues((v) => ({ ...v, [field.id]: val }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            ))}

            <Button
              type="submit"
              className="w-full"
              disabled={submitForm.isPending}
            >
              {submitForm.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Submit
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
