"use client";

import { Button } from "@oocc/ui";
import { useEffect } from "react";

/**
 * Next's App Router route-level error boundary — the last-resort net
 * beneath the per-panel `ErrorBoundary`s (docs/PRD.md §9): those catch a
 * single bad panel without taking the page down; this catches anything
 * that manages to throw outside all of them (a layout-level bug, a crash
 * during initial render before any panel mounts). Renders inside the root
 * layout, so `TopBar`/nav stay usable — the failure is contained to the
 * page body, not the whole app shell.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-paper p-6 text-center">
      <span className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-mutate">
        This page hit an error
      </span>
      <span className="max-w-sm font-body text-[13px] text-ink-soft">{error.message}</span>
      <Button variant="primary" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
