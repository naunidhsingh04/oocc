"use client";

import type { Panel as PlanPanelNode, PanelType, VizPlan } from "@oocc/contracts";
import { useEffect, useMemo, useState } from "react";
import { PANEL_TYPES } from "./panelRegistry";

/** How many panels a fresh (never-customized) arrangement mounts by
 * default — everything else the plan suggested is still one click away
 * via "+ Add panel", not gone. A BFS trace's real `viz_planner` output is
 * six panels (graph, array, queue, call_stack, variables, console); all
 * six mounting at once left five of them ~50px slivers of a title bar
 * with no visible body (found live, docs/PRD.md §6.4's own mockup shows
 * three panels total: one primary + a two-up secondary row). */
const DEFAULT_PANEL_COUNT = 3;

/** Ranks *secondary* panel types by how likely they are to be the actual
 * point of a given trace, highest first — used only to choose which two
 * secondaries join the primary panel in a fresh default arrangement.
 * Container types that directly explain an algorithm's mechanism (a BFS's
 * queue, a DFS's stack, a hash map's buckets) rank above the generic
 * `array` binding a plan sometimes emits alongside them (frequently a
 * secondary, less central artifact — e.g. BFS's own `order` list — not
 * the thing worth defaulting to), which ranks above the always-present,
 * debug-oriented `call_stack`/`variables` pair every plan includes
 * regardless of algorithm. `console` sits between those two groups: not
 * algorithm-specific, but broadly more informative by default than a
 * call stack that's one frame deep for an iterative trace. */
const SECONDARY_PANEL_PRIORITY: readonly PanelType[] = [
  "queue",
  "stack",
  "hash_map",
  "linked_list",
  "binary_tree",
  "array_2d",
  "recursion_tree",
  "heap_objects",
  "graph",
  "console",
  "array",
  "call_stack",
  "variables",
  "timeline",
];

function panelPriority(type: PanelType): number {
  const index = SECONDARY_PANEL_PRIORITY.indexOf(type);
  return index === -1 ? SECONDARY_PANEL_PRIORITY.length : index;
}

/** Caps a *freshly seeded* panel list (never a restored/user-customized
 * one — see the two call sites below) to `DEFAULT_PANEL_COUNT`: the
 * primary panel always survives, the highest-priority secondaries fill
 * the remaining slots, original relative order preserved among the kept
 * ones (so a plan's own panel order still reads top-to-bottom sensibly). */
function selectDefaultPanels(panels: PlanPanelNode[]): PlanPanelNode[] {
  if (panels.length <= DEFAULT_PANEL_COUNT) return panels;
  const primary = panels.find((p) => p.role === "primary");
  const secondarySlots = DEFAULT_PANEL_COUNT - (primary ? 1 : 0);
  const secondaries = panels.filter((p) => p.id !== primary?.id);
  const keepIds = new Set(
    [...secondaries]
      .sort((a, b) => panelPriority(a.type) - panelPriority(b.type))
      .slice(0, secondarySlots)
      .map((p) => p.id),
  );
  return panels.filter((p) => p.id === primary?.id || keepIds.has(p.id));
}

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
    const raw = window.sessionStorage.getItem(storageKeyFor(key));
    return raw ? (JSON.parse(raw) as StoredArrangement) : null;
  } catch {
    return null;
  }
}

/**
 * The next `local-N` id, derived from whatever panels are actually
 * present right now rather than a module-level counter. The counter
 * version was a real, shipped bug: `nextLocalId` lives for as long as the
 * JS module does, which is exactly one page load — but the arrangement
 * itself is persisted to `localStorage` and outlives that. Add one panel
 * (`local-1`, counter now at 2), reload the page (fresh module, counter
 * back to 1, but `local-1` is still in the restored arrangement), add
 * another panel, and it's assigned `local-1` again — colliding with the
 * one already there. `react-resizable-panels` throws `Panel ids must be
 * unique; id "local-1" was used more than once`, taking down the whole
 * panel grid (confirmed live: this is exactly the crash a user hit on the
 * deployed site). Scanning the live panel list for the highest existing
 * `local-N` and adding one is stable across reloads because it has no
 * memory of its own to fall out of sync with the thing it's protecting.
 */
function nextLocalPanelId(panels: PlanPanelNode[]): string {
  let max = 0;
  for (const p of panels) {
    const match = /^local-(\d+)$/.exec(p.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `local-${max + 1}`;
}

/**
 * Repairs an already-corrupted stored arrangement, not just prevents new
 * corruption. A browser that hit the collision bug above *before* this fix
 * shipped has a real duplicate-id arrangement sitting in its own
 * `localStorage` right now — restoring it verbatim reproduces the exact
 * same crash on load, with no `addPanel` call involved at all.
 * `nextLocalPanelId` alone doesn't fix that: it only guards ids handed out
 * *after* this ran. Any panel whose id has already appeared earlier in the
 * list gets reassigned a fresh one instead.
 */
function dedupePanelIds(panels: PlanPanelNode[]): PlanPanelNode[] {
  const seen = new Set<string>();
  let maxLocal = 0;
  for (const p of panels) {
    const match = /^local-(\d+)$/.exec(p.id);
    if (match) maxLocal = Math.max(maxLocal, Number(match[1]));
  }
  let changed = false;
  const result = panels.map((p) => {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      return p;
    }
    changed = true;
    maxLocal += 1;
    const freshId = `local-${maxLocal}`;
    seen.add(freshId);
    return { ...p, id: freshId };
  });
  return changed ? result : panels;
}

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

  // Deliberately seed with `seedPlan.panels` alone, never `loadStored(...)`,
  // even though that means ignoring a real saved arrangement for one
  // frame — a real hydration bug found auditing this hook (not
  // hypothetical): `loadStored`'s own `typeof window === "undefined"`
  // guard means this lazy initializer produced *different* panel lists
  // between the server (always `seedPlan.panels`, no `window`) and the
  // client's first render (`window` exists during hydration too, so it
  // read a previously-saved arrangement immediately) — differing panel
  // *count and types*, not just an attribute, exactly the shape of
  // mismatch that fails hydration hardest. The `useEffect` below already
  // ran on every mount (not just `storageKey` changes) and corrects to
  // the real stored value right after — it just used to be redundant
  // with the initializer instead of being the *only* source of the real
  // value.
  const [panels, setPanels] = useState<PlanPanelNode[]>(() =>
    dedupePanelIds(selectDefaultPanels(seedPlan.panels)),
  );
  const [maximizedId, setMaximizedId] = useState<string | null>(null);

  // Re-seed whenever the underlying run changes, not on every plan object
  // identity change (a fixture reload creates a new plan object each time).
  // A `key`-prop remount would be the react-compiler-preferred shape for
  // this, but this hook is shared across pages that don't all want a full
  // subtree remount on every run switch. Also the one and only place
  // `loadStored` (a real localStorage read) ever runs now — always
  // client-only, always after mount, never during render.
  useEffect(() => {
    const stored = loadStored(storageKey);
    // A restored arrangement is whatever the user actually left it as
    // (including having added panels back past the default cap) — only a
    // genuinely fresh seed from the plan gets capped.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPanels(dedupePanelIds(stored?.panels ?? selectDefaultPanels(seedPlan.panels)));
    setMaximizedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(storageKeyFor(storageKey), JSON.stringify({ panels } satisfies StoredArrangement));
  }, [panels, storageKey]);

  const addPanel = (type: PanelType) => {
    setPanels((prev) => [...prev, { id: nextLocalPanelId(prev), type, role: "secondary" }]);
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

  /** Back to the smart default set of panels (see `selectDefaultPanels`)
   * — undoes any add/remove/retype customization for this run. Pane
   * *sizes* within the grid aren't independently persisted (only which
   * panels exist is — see the sessionStorage write above), so resetting
   * this array is the whole of "reset layout" for this panel grid. */
  const resetLayout = () => {
    setPanels(dedupePanelIds(selectDefaultPanels(seedPlan.panels)));
    setMaximizedId(null);
  };

  const availableTypes = useMemo(() => PANEL_TYPES, []);

  return {
    panels,
    layout: seedPlan.layout,
    addPanel,
    removePanel,
    retypePanel,
    resetLayout,
    maximizedId,
    setMaximizedId,
    availableTypes,
  };
}
