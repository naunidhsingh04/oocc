"use client";

import type { Panel as PlanPanelNode, PanelType, VizPlan } from "@oocc/contracts";
import { ResizableHandle, ResizablePane, ResizableSplit } from "@oocc/ui";
import { useEffect, useRef, useState } from "react";
import { PANEL_LABELS, PANEL_TYPES } from "./panelRegistry";
import { PanelFrame } from "./PanelFrame";
import { usePanelArrangement } from "./usePanelArrangement";

/** Every panel gets at least this much room — enough for a header plus a
 * few rows of real content — or the column scrolls instead of shrinking
 * any panel further (docs/PRD.md §6.4's own mockup panels are never just
 * a title bar; found live, five secondary panels compressed into ~50px
 * slivers with nothing but a header visible was the direct complaint this
 * fixes). */
const MIN_PANEL_HEIGHT_PX = 180;

interface PanelGridProps {
  plan: VizPlan | null;
  /** Identifies the currently loaded run/fixture — arrangement and sizes
   * are persisted per key, and switching keys re-seeds from that run's own
   * plan (see usePanelArrangement). */
  storageKey: string;
  /** docs/PRD.md §9: `NarrowWorkspace`'s "Visual" tab is only ~340px wide
   * after padding — a `"primary+stack"` plan's side-by-side `orientation="horizontal"`
   * split squeezes both panes below their `minSize`, overlapping their own
   * headers. Forces the same flat vertical `PanelStack` the `"meta"`-layout
   * fallback already uses, regardless of the plan's own layout string. */
  forceStacked?: boolean;
}

interface Arrangement {
  availableTypes: PanelType[];
  removePanel: (id: string) => void;
  retypePanel: (id: string, type: PanelType) => void;
  setMaximizedId: (id: string | null) => void;
}

/**
 * The layout engine (docs/PRD.md §4.3 Phase 2 frontend spec item 3): mounts
 * a small default set of panels straight from viz_planner's plan (see
 * usePanelArrangement's `selectDefaultPanels`) via the panel registry, and
 * lets the user add/remove/retype/maximize any panel, persisting the
 * result. `layout: "primary+stack"` renders literally as a primary column
 * plus a stacked column of everything else; any other layout string
 * (today just `"meta"`) renders as one flat stack.
 */
export function PanelGrid({ plan, storageKey, forceStacked = false }: PanelGridProps) {
  const { panels, layout, addPanel, removePanel, retypePanel, resetLayout, maximizedId, setMaximizedId, availableTypes } =
    usePanelArrangement(plan, storageKey);
  const arrangement: Arrangement = { availableTypes, removePanel, retypePanel, setMaximizedId };

  const maximizedPanel = panels.find((p) => p.id === maximizedId);
  if (maximizedPanel) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <PanelFrame
          panel={maximizedPanel}
          availableTypes={availableTypes}
          maximized
          onRemove={() => removePanel(maximizedPanel.id)}
          onRetype={(type) => retypePanel(maximizedPanel.id, type)}
          onToggleMaximize={() => setMaximizedId(null)}
        />
      </div>
    );
  }

  const primary = panels.find((p) => p.role === "primary");
  const rest = panels.filter((p) => p.id !== primary?.id);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-end gap-2 border-b border-rule px-2 py-1">
        <button
          type="button"
          onClick={resetLayout}
          className="rounded-control px-1.5 py-0.5 font-mono-label text-[11px] text-ink-soft hover:bg-raised hover:text-ink"
        >
          Reset layout
        </button>
        <AddPanelControl onAdd={addPanel} />
      </div>
      <div className="min-h-0 flex-1">
        {panels.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono-label text-[12px] text-ink-soft">
            No panels — add one above.
          </div>
        ) : layout === "primary+stack" && primary && !forceStacked ? (
          <ResizableSplit id={`oocc-panel-grid-${storageKey}`} orientation="horizontal">
            <ResizablePane id="primary" defaultSize="45" minSize="20">
              <PanelFrame
                panel={primary}
                availableTypes={availableTypes}
                maximized={false}
                onRemove={() => removePanel(primary.id)}
                onRetype={(type) => retypePanel(primary.id, type)}
                onToggleMaximize={() => setMaximizedId(primary.id)}
              />
            </ResizablePane>
            {rest.length > 0 ? (
              <>
                <ResizableHandle />
                <ResizablePane id="stack" defaultSize="55" minSize="20">
                  <PanelStack panels={rest} splitId={`oocc-panel-stack-${storageKey}`} arrangement={arrangement} />
                </ResizablePane>
              </>
            ) : null}
          </ResizableSplit>
        ) : (
          <PanelStack panels={panels} splitId={`oocc-panel-grid-${storageKey}`} arrangement={arrangement} />
        )}
      </div>
    </div>
  );
}

/**
 * A vertical stack of resizable panels, each held to `MIN_PANEL_HEIGHT_PX`
 * or more. `react-resizable-panels` sizes its group to 100% of its own
 * container by default, which is exactly the bug this replaces: five
 * panels squeezed into whatever height the container happened to have,
 * each shrinking well under a usable size with no floor. Instead, the
 * group is given an explicit pixel height of
 * `max(measured container height, panelCount * MIN_PANEL_HEIGHT_PX)` — so
 * it still fills the available space when there's room for everyone, but
 * grows *past* 100% (and the wrapping `overflow-y-auto` scrolls) the
 * moment there isn't. Each pane's own `minSize` is computed against that
 * same group height, so it always resolves to exactly the pixel floor
 * regardless of panel count.
 */
function PanelStack({
  panels,
  splitId,
  arrangement,
}: {
  panels: PlanPanelNode[];
  splitId: string;
  arrangement: Arrangement;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [availableHeight, setAvailableHeight] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (height !== undefined) setAvailableHeight(height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const groupHeight = Math.max(availableHeight, panels.length * MIN_PANEL_HEIGHT_PX);
  const minSizePct = (MIN_PANEL_HEIGHT_PX / groupHeight) * 100;
  const defaultSizePct = 100 / panels.length;

  return (
    <div ref={scrollRef} className="h-full min-h-0 overflow-y-auto">
      <ResizableSplit
        id={splitId}
        orientation="vertical"
        style={{ height: groupHeight, minHeight: groupHeight }}
      >
        {panels.map((panel, i) => (
          <FramedPane
            key={panel.id}
            panel={panel}
            isLast={i === panels.length - 1}
            defaultSize={defaultSizePct}
            minSize={minSizePct}
            arrangement={arrangement}
          />
        ))}
      </ResizableSplit>
    </div>
  );
}

function FramedPane({
  panel,
  isLast,
  defaultSize,
  minSize,
  arrangement,
}: {
  panel: PlanPanelNode;
  isLast: boolean;
  defaultSize: number;
  minSize: number;
  arrangement: Arrangement;
}) {
  return (
    <>
      <ResizablePane id={panel.id} defaultSize={`${defaultSize}%`} minSize={`${minSize}%`}>
        <PanelFrame
          panel={panel}
          availableTypes={arrangement.availableTypes}
          maximized={false}
          onRemove={() => arrangement.removePanel(panel.id)}
          onRetype={(type) => arrangement.retypePanel(panel.id, type)}
          onToggleMaximize={() => arrangement.setMaximizedId(panel.id)}
        />
      </ResizablePane>
      {!isLast ? <ResizableHandle orientation="vertical" /> : null}
    </>
  );
}

function AddPanelControl({ onAdd }: { onAdd: (type: PanelType) => void }) {
  return (
    <select
      aria-label="Add panel"
      value=""
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value as PanelType);
        e.target.value = "";
      }}
      className="h-7 rounded-control border border-rule bg-panel px-2 font-mono-label text-[11px] text-ink-soft"
    >
      <option value="" disabled>
        + Add panel
      </option>
      {PANEL_TYPES.map((type) => (
        <option key={type} value={type}>
          {PANEL_LABELS[type]}
        </option>
      ))}
    </select>
  );
}
