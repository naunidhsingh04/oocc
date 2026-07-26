"use client";

import type { Panel as PlanPanelNode, PanelType, VizPlan } from "@oocc/contracts";
import { ResizableHandle, ResizablePane, ResizableSplit } from "@oocc/ui";
import { PANEL_LABELS, PANEL_TYPES } from "./panelRegistry";
import { PanelFrame } from "./PanelFrame";
import { usePanelArrangement } from "./usePanelArrangement";

interface PanelGridProps {
  plan: VizPlan | null;
  /** Identifies the currently loaded run/fixture — arrangement and sizes
   * are persisted per key, and switching keys re-seeds from that run's own
   * plan (see usePanelArrangement). */
  storageKey: string;
}

interface Arrangement {
  availableTypes: PanelType[];
  removePanel: (id: string) => void;
  retypePanel: (id: string, type: PanelType) => void;
  setMaximizedId: (id: string | null) => void;
}

/**
 * The layout engine (docs/PRD.md §4.3 Phase 2 frontend spec item 3): mounts
 * panels straight from viz_planner's plan via the panel registry, and lets
 * the user add/remove/retype/maximize any panel, persisting the result.
 * `layout: "primary+stack"` renders literally as a primary column plus a
 * stacked column of everything else; any other layout string (today just
 * `"meta"`) renders as one flat stack — panels butt against shared
 * hairlines either way (PRD §6.2), react-resizable-panels' own handles are
 * the only visual seam.
 */
export function PanelGrid({ plan, storageKey }: PanelGridProps) {
  const { panels, layout, addPanel, removePanel, retypePanel, maximizedId, setMaximizedId, availableTypes } =
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
      <div className="flex items-center justify-end border-b border-rule px-2 py-1">
        <AddPanelControl onAdd={addPanel} />
      </div>
      <div className="min-h-0 flex-1">
        {panels.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono-label text-[12px] text-ink-soft">
            No panels — add one above.
          </div>
        ) : layout === "primary+stack" && primary ? (
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

function PanelStack({
  panels,
  splitId,
  arrangement,
}: {
  panels: PlanPanelNode[];
  splitId: string;
  arrangement: Arrangement;
}) {
  return (
    <ResizableSplit id={splitId} orientation="vertical">
      {panels.map((panel, i) => (
        <FramedPane key={panel.id} panel={panel} isLast={i === panels.length - 1} total={panels.length} arrangement={arrangement} />
      ))}
    </ResizableSplit>
  );
}

function FramedPane({
  panel,
  isLast,
  total,
  arrangement,
}: {
  panel: PlanPanelNode;
  isLast: boolean;
  total: number;
  arrangement: Arrangement;
}) {
  return (
    <>
      <ResizablePane id={panel.id} defaultSize={String(Math.round(100 / total))} minSize="15">
        <PanelFrame
          panel={panel}
          availableTypes={arrangement.availableTypes}
          maximized={false}
          onRemove={() => arrangement.removePanel(panel.id)}
          onRetype={(type) => arrangement.retypePanel(panel.id, type)}
          onToggleMaximize={() => arrangement.setMaximizedId(panel.id)}
        />
      </ResizablePane>
      {!isLast ? <ResizableHandle /> : null}
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
