import type { Panel as PlanPanelNode } from "@oocc/contracts";

/**
 * The one interface every viz panel implements (docs/PRD.md §4.3 Phase 2
 * frontend spec): a plan node from viz_planner. Panels are pure functions
 * of trace state — no panel fetches, no panel holds its own playback
 * state, no panel knows what algorithm is running. All step/channel state
 * comes from the shared `usePlayerStore` seam (`@/lib/player`), never a
 * prop, so every panel re-renders consistently off the same scrubber
 * position without prop-drilling it through the layout engine.
 *
 * `panel` itself carries only placement/binding data (`id`, `type`,
 * `binding?`, `role?`, `annotations?`) — never trace data. It's optional so
 * a panel can still be rendered standalone (existing tests, the styleguide)
 * without a real plan; in that case a panel falls back to auto-detecting
 * its own binding generically, exactly like Phase 1's ArrayPanel did.
 */
export interface VizPanelProps {
  panel?: PlanPanelNode;
}
