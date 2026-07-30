"use client";

import { usePlayerStore } from "@/lib/player";
import { Button } from "@oocc/ui";
import { useState } from "react";

/**
 * Shows the stdin the loaded fixture's trace was recorded against
 * (`meta.stdin`). Read-only in Phase 1 — there's no run pipeline yet to
 * re-execute against edited input (docs/PRD.md Phase 2's run API is what
 * makes this live).
 */
export function StdinDrawer() {
  const [open, setOpen] = useState(false);
  const stdin = usePlayerStore((state) => state.trace?.meta.stdin ?? "");

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Stdin
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-dropdown mt-1 w-72 rounded-control border border-rule bg-panel p-2 shadow-menu">
          <div className="mb-1 font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
            Recorded stdin
          </div>
          <textarea
            readOnly
            value={stdin || "(no stdin recorded for this run)"}
            rows={4}
            className="w-full resize-none rounded-control border border-rule bg-paper p-1.5 font-editor text-xs text-ink"
          />
        </div>
      ) : null}
    </div>
  );
}
