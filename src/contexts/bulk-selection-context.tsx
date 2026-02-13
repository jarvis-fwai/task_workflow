"use client";

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";

interface BulkSelectionContextType {
  selectedTaskIds: Set<string>;
  toggle: (id: string) => void;
  toggleWithShift: (id: string, allIds: string[], shiftKey: boolean) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  count: number;
}

const BulkSelectionContext = createContext<BulkSelectionContextType | null>(null);

export function BulkSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const lastSelectedRef = useRef<string | null>(null);

  const toggle = useCallback((id: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    lastSelectedRef.current = id;
  }, []);

  const toggleWithShift = useCallback((id: string, allIds: string[], shiftKey: boolean) => {
    if (shiftKey && lastSelectedRef.current) {
      const lastIdx = allIds.indexOf(lastSelectedRef.current);
      const currentIdx = allIds.indexOf(id);
      if (lastIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(lastIdx, currentIdx);
        const end = Math.max(lastIdx, currentIdx);
        const rangeIds = allIds.slice(start, end + 1);
        setSelectedTaskIds((prev) => {
          const next = new Set(prev);
          rangeIds.forEach((rid) => next.add(rid));
          return next;
        });
        lastSelectedRef.current = id;
        return;
      }
    }
    toggle(id);
  }, [toggle]);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedTaskIds((prev) => {
      // If all are already selected, deselect all
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(ids);
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTaskIds(new Set());
    lastSelectedRef.current = null;
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedTaskIds.has(id),
    [selectedTaskIds]
  );

  return (
    <BulkSelectionContext.Provider
      value={{
        selectedTaskIds,
        toggle,
        toggleWithShift,
        selectAll,
        clearSelection,
        isSelected,
        count: selectedTaskIds.size,
      }}
    >
      {children}
    </BulkSelectionContext.Provider>
  );
}

export function useBulkSelection() {
  const ctx = useContext(BulkSelectionContext);
  if (!ctx)
    throw new Error("useBulkSelection must be used within BulkSelectionProvider");
  return ctx;
}
