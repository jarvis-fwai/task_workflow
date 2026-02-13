"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShortcutBadge } from "@/components/keyboard/shortcut-badge";

const shortcutCategories = [
  {
    name: "Navigation",
    shortcuts: [
      { description: "Search", keys: ["⌘", "K"] },
      { description: "Go to Inbox", keys: ["Tab", "I"] },
      { description: "Go to My Tasks", keys: ["Tab", "M"] },
      { description: "Go to Home", keys: ["Tab", "H"] },
    ],
  },
  {
    name: "Tasks",
    shortcuts: [
      { description: "Quick add task", keys: ["Tab", "Q"] },
      { description: "Open selected task", keys: ["Enter"] },
      { description: "Complete/uncomplete task", keys: ["Space"] },
      { description: "Assign to me", keys: ["Tab", "A"] },
    ],
  },
  {
    name: "General",
    shortcuts: [
      { description: "Close panel/modal", keys: ["Esc"] },
      { description: "Shortcuts reference", keys: ["?"] },
    ],
  },
];

export function KeyboardShortcuts() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const lastKeyRef = useRef<string | null>(null);
  const lastKeyTimeRef = useRef<number>(0);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputFocused =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Escape: dispatch close-panel (always works, even in inputs)
      if (event.key === "Escape") {
        window.dispatchEvent(new CustomEvent("close-panel"));
        return;
      }

      // Skip other shortcuts if user is typing in an input
      if (isInputFocused) return;

      // Tab+Q sequence: dispatch quick-add-task
      if (event.key === "Tab") {
        event.preventDefault();
        lastKeyRef.current = "Tab";
        lastKeyTimeRef.current = Date.now();
        return;
      }

      const now = Date.now();
      const isTabSequence = lastKeyRef.current === "Tab" && now - lastKeyTimeRef.current <= 500;

      if (isTabSequence) {
        const key = event.key.toLowerCase();
        if (key === "q") {
          window.dispatchEvent(new CustomEvent("quick-add-task"));
        } else if (key === "i") {
          window.location.href = "/inbox";
        } else if (key === "m") {
          window.location.href = "/my-tasks";
        } else if (key === "h") {
          window.location.href = "/home";
        } else if (key === "a") {
          window.dispatchEvent(new CustomEvent("assign-to-me"));
        }
        lastKeyRef.current = null;
        lastKeyTimeRef.current = 0;
        return;
      }

      // ?: open shortcuts reference dialog
      if (event.key === "?") {
        setDialogOpen(true);
        return;
      }

      // Reset sequence tracking for any other key
      lastKeyRef.current = null;
      lastKeyTimeRef.current = 0;
    },
    []
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {shortcutCategories.map((category) => (
            <div key={category.name}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {category.name}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <ShortcutBadge keys={shortcut.keys} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
