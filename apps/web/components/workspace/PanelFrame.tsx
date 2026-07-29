"use client";

import type { Panel as PlanPanelNode, PanelType } from "@oocc/contracts";
import { CloseIcon, ErrorBoundary, IconButton } from "@oocc/ui";
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
 * Wraps one mounted panel with a small floating control bar (retype /
 * remove / maximize) — absolutely positioned over the panel's own chrome
 * so it never breaks the h-full flex chain every panel already needs
 * (CLAUDE.md's layout gotcha): the wrapper itself is `flex h-full
 * min-h-0 flex-col`, passing 100% of its box straight to the panel.
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
      <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1">
        <select
          aria-label="Panel type"
          value={panel.type}
          onChange={(e) => onRetype(e.target.value as PanelType)}
          className="h-6 rounded-control border border-rule bg-panel px-1 font-mono-label text-[10px] uppercase tracking-[0.04em] text-ink-soft"
        >
          {availableTypes.map((type) => (
            <option key={type} value={type}>
              {PANEL_LABELS[type]}
            </option>
          ))}
        </select>
        <IconButton aria-label={maximized ? "Restore panel" : "Maximize panel"} onClick={onToggleMaximize} active={maximized}>
          <span aria-hidden className="text-[10px]">
            {maximized ? "⤡" : "⤢"}
          </span>
        </IconButton>
        <IconButton aria-label="Remove panel" onClick={onRemove}>
          <CloseIcon />
        </IconButton>
      </div>
      <ErrorBoundary title={PANEL_LABELS[panel.type]}>
        {/* eslint-disable-next-line react-hooks/static-components -- see the resolvePanelComponent call above */}
        <Component panel={panel} />
      </ErrorBoundary>
    </div>
  );
}
