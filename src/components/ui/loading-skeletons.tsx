"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function TaskListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="px-6 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-4 border-b pb-2">
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-24" />
        <div className="flex-1" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
      {/* Section */}
      <div className="mb-2 flex items-center gap-2">
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-6" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-gray-50 py-2.5">
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3.5 flex-1 max-w-[200px]" style={{ maxWidth: `${120 + Math.random() * 150}px` }} />
          <div className="flex-1" />
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function BoardSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto px-6 py-4">
      {Array.from({ length: columns }).map((_, col) => (
        <div key={col} className="w-72 flex-shrink-0">
          <div className="mb-3 flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-6" />
          </div>
          {Array.from({ length: 2 + Math.floor(Math.random() * 3) }).map((_, row) => (
            <div key={row} className="mb-2 rounded-lg border bg-white p-3 shadow-sm">
              <Skeleton className="mb-2 h-4 w-full max-w-[180px]" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="px-6 py-4">
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-7 w-7" />
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-7 w-7" />
      </div>
      <div className="grid grid-cols-7 gap-px rounded-lg border bg-gray-200">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-white p-2">
            <Skeleton className="mx-auto h-3 w-8" />
          </div>
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="min-h-[80px] bg-white p-2">
            <Skeleton className="mb-1 h-3 w-4" />
            {Math.random() > 0.7 && <Skeleton className="h-4 w-full rounded" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function InboxSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-1 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg p-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      {/* Greeting */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      {/* Cards */}
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-white p-5">
            <Skeleton className="mb-3 h-5 w-32" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TaskDetailSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-6 w-3/4" />
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
      <Skeleton className="mt-6 h-24 w-full" />
    </div>
  );
}
