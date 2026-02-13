"use client";

import { createContext, useContext, useCallback, useRef } from "react";
import { toast } from "sonner";

interface UndoEntry {
  id: string;
  label: string;
  undoFn: () => void | Promise<void>;
  timestamp: number;
}

interface UndoContextValue {
  pushUndo: (label: string, undoFn: () => void | Promise<void>) => void;
}

const UndoContext = createContext<UndoContextValue>({
  pushUndo: () => {},
});

const MAX_UNDO_STACK = 5;
const AUTO_DISMISS_MS = 10000;

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const stackRef = useRef<UndoEntry[]>([]);

  const pushUndo = useCallback((label: string, undoFn: () => void | Promise<void>) => {
    const id = `undo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: UndoEntry = { id, label, undoFn, timestamp: Date.now() };

    // Maintain stack of last 5
    stackRef.current = [entry, ...stackRef.current].slice(0, MAX_UNDO_STACK);

    toast(label, {
      id,
      action: {
        label: "Undo",
        onClick: async () => {
          try {
            await undoFn();
            // Remove from stack
            stackRef.current = stackRef.current.filter((e) => e.id !== id);
            toast.success("Action undone");
          } catch {
            toast.error("Failed to undo action");
          }
        },
      },
      duration: AUTO_DISMISS_MS,
      onDismiss: () => {
        // Remove expired entries from stack
        stackRef.current = stackRef.current.filter((e) => e.id !== id);
      },
    });
  }, []);

  return (
    <UndoContext.Provider value={{ pushUndo }}>
      {children}
    </UndoContext.Provider>
  );
}

export function useUndo() {
  return useContext(UndoContext);
}
