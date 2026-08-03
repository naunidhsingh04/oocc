"use client";

import type { Panel as PlanPanelNode, PanelType } from "@oocc/contracts";
import { cn, ErrorBoundary, IconButton } from "@oocc/ui";
import { useEffect, useRef, useState } from "react";
import { PANEL_LABELS, resolvePanelComponent } from "./panelRegistry";

interface PanelFrameProps {
  panel: PlanPanelNode;
  availableTypes: PanelType[];
  maximized: boolean;
  onRemove: () => void;
  onRetype: (type: PanelType) => void;
  onToggleMaximize: () => void;
}

/**
 * The panel's own "⋯" menu (change type / maximize / remove) — one small
 * icon button, not a permanently-visible `<select>` plus two more icon
 * buttons competing for the same top-right corner every panel's own
 * header actions already use (see e.g. ArrayPanel's Bars/Cells toggle,
 * which had to move to a *second row* specifically to dodge that
 * collision — found live, not hypothetical). Built as a plain local
 * popover (same click-outside pattern as SettingsPanel.tsx) rather than a
 * native `<select>` kept hidden and opened programmatically:
 * `<select>.showPicker()` isn't reliable across browsers, and this menu
 * needs a "Maximize"/"Remove" row alongside the type list anyway, which a
 * native select can't express.
 */
function PanelMenu({
  panel,
  availableTypes,
  maximized,
  onRemove,
  onRetype,
  onToggleMaximize,
}: PanelFrameProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <IconButton aria-label="Panel options" onClick={() => setOpen((v) => !v)} active={open}>
        <span aria-hidden className="text-[13px] leading-none">
          ⋯
        </span>
      </IconButton>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+4px)] z-panel-controls w-40 rounded-panel border border-rule bg-panel py-1 shadow-menu">
          <button
            type="button"
            onClick={() => {
              onToggleMaximize();
              setOpen(false);
            }}
            className="flex w-full items-center px-2.5 py-1.5 text-left font-body text-[12px] text-ink hover:bg-raised"
          >
            {maximized ? "Restore" : "Maximize"}
          </button>
          <div className="my-1 border-t border-rule" />
          <div className="px-2.5 py-1 font-mono-label text-[10px] uppercase tracking-[0.06em] text-ink-soft">
            Change type
          </div>
          <div className="max-h-48 overflow-y-auto">
            {availableTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  onRetype(type);
                  setOpen(false);
                }}
                aria-current={type === panel.type ? "true" : undefined}
                className={cn(
                  "flex w-full items-center px-2.5 py-1.5 text-left font-body text-[12px] hover:bg-raised",
                  type === panel.type ? "text-signal" : "text-ink",
                )}
              >
                {PANEL_LABELS[type]}
              </button>
            ))}
          </div>
          <div className="my-1 border-t border-rule" />
          <button
            type="button"
            onClick={() => {
              onRemove();
              setOpen(false);
            }}
            className="flex w-full items-center px-2.5 py-1.5 text-left font-body text-[12px] text-mutate hover:bg-raised"
          >
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Wraps one mounted panel with its options menu — absolutely positioned
 * over the panel's own chrome so it never breaks the h-full flex chain
 * every panel already needs (CLAUDE.md's layout gotcha): the wrapper
 * itself is `flex h-full min-h-0 flex-col`, passing 100% of its box
 * straight to the panel.
 */
export function PanelFrame({ panel, availableTypes, maximized, onRemove, onRetype, onToggleMaximize }: PanelFrameProps) {
  // resolvePanelComponent is a lookup into the static PANEL_REGISTRY map
  // (panelRegistry.ts) — it never fabricates a new component, just returns
  // one of a fixed set of stable references, so this isn't the "component
  // defined during render" case react-compiler's static-components rule
  // guards against; it just can't prove that through a dynamic lookup
  // (flagged at the JSX usage below, not here).
  const Component = resolvePanelComponent(panel.type);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="absolute right-1.5 top-1.5 z-panel-controls">
        <PanelMenu
          panel={panel}
          availableTypes={availableTypes}
          maximized={maximized}
          onRemove={onRemove}
          onRetype={onRetype}
          onToggleMaximize={onToggleMaximize}
        />
      </div>
      <ErrorBoundary title={PANEL_LABELS[panel.type]}>
        {/* eslint-disable-next-line react-hooks/static-components -- see the resolvePanelComponent call above */}
        <Component panel={panel} />
      </ErrorBoundary>
    </div>
  );
}
