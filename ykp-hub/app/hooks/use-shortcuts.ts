"use client";
import { useEffect } from "react";

export interface ShortcutHandlers {
  onTogglePalette?: () => void;
  onEscape?: () => void;
  onBack?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

/**
 * Global keyboard shortcuts. Skips if focus is inside an input/textarea
 * (so typing 'k' in the search box doesn't open the palette).
 */
export function useShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const editable = tag === "input" || tag === "textarea" || target?.isContentEditable;
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+K — palette (always allowed)
      if (isMod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        handlers.onTogglePalette?.();
        return;
      }

      // Skip the rest when typing
      if (editable) return;

      if (e.key === "Escape") {
        handlers.onEscape?.();
        return;
      }
      if (e.key === "ArrowLeft") {
        handlers.onBack?.();
        return;
      }
      if (e.key === "ArrowRight" && handlers.onNext) {
        e.preventDefault();
        handlers.onNext();
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}