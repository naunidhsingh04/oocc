"use client";

import type { Panel as PlanPanelNode, PanelType, VizPlan } from "@oocc/contracts";
import { useEffect, useMemo, useState } from "react";
import { PANEL_TYPES } from "./panelRegistry";

/** No detected structures and no plan at all (e.g. a fixture whose backend
 * output hasn't loaded) still needs *something* to mount — the two panels
 * every program has regardless of algorithm. */
export const DEFAULT_PLAN: VizPlan = {
  layout: "meta",
  panels: [
    { id: "p1", type: "call_stack", role: "secondary" },
    { id: "p2", type: "variables", role: "secondary" },
  ],
};

interface StoredArrangement {
  panels: PlanPanelNode[];
}

function storageKeyFor(key: string): string {
  return `oocc.panel-arrangement.${key}`;
}

function loadStored(key: string): StoredArrangement | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKeyFor(key));
    return raw ? (JSON.parse(raw) as StoredArrangement) : null;
  } catch {
    return null;
  }
}

let nextLocalId = 1;

/**
 * Owns the mutable, user-editable panel arrangement for one loaded
 * trace: seeded from viz_planner's plan, then add/remove/retype are
 * applied on top and persisted to localStorage keyed by `storageKey`
 * (docs/PRD.md §4.3 Phase 2 frontend spec item 3). Switching to a
 * different fixture/run (a new `storageKey`) re-seeds from that run's
 * own plan plus its own saved arrangement, never bleeding across runs.
 */
export function usePanelArrangement(plan: VizPlan | null, storageKey: string) {
  const seedPlan = plan ?? DEFAULT_PLAN;

  const [panels, setPanels] = useState<PlanPanelNode[]>(() => loadStored(storageKey)?.panels ?? seedPlan.panels);
  const [maximizedId, setMaximizedId] = useState<string | null>(null);

  // Re-seed whenever the underlying run changes, not on every plan object
  // identity change (a fixture reload creates a new plan object each time).
  // A `key`-prop remount would be the react-compiler-preferred shape for
  // this, but this hook is shared across pages that don't all want a full
  // subtree remount on every run switch.
  useEffect(() => {
    const stored = loadStored(storageKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPanels(stored?.panels ?? seedPlan.panels);
    setMaximizedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKeyFor(storageKey), JSON.stringify({ panels } satisfies StoredArrangement));
  }, [panels, storageKey]);

  const addPanel = (type: PanelType) => {
    const id = `local-${nextLocalId++}`;
    setPanels((prev) => [...prev, { id, type, role: "secondary" }]);
  };

  const removePanel = (id: string) => {
    setPanels((prev) => prev.filter((p) => p.id !== id));
    setMaximizedId((current) => (current === id ? null : current));
  };

  const retypePanel = (id: string, type: PanelType) => {
    setPanels((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const rest: PlanPanelNode = { ...p };
        delete rest.binding;
        return { ...rest, type };
      }),
    );
  };

  const availableTypes = useMemo(() => PANEL_TYPES, []);

  return {
    panels,
    layout: seedPlan.layout,
    addPanel,
    removePanel,
    retypePanel,
    maximizedId,
    setMaximizedId,
    availableTypes,
  };
}
