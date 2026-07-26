"use client";

import { Chip, Panel } from "@oocc/ui";
import type { VizPanelProps } from "./types";

/** Anything of unknown panel type renders as this grey opaque chip rather
 * than breaking (docs/PRD.md §3.2's own "opaque" degrade rule, applied at
 * the panel-registry level too). */
export function GenericPanel({ panel }: VizPanelProps) {
  return (
    <Panel title={panel?.type ?? "Unknown"} className="min-h-0 flex-1" bodyClassName="p-4">
      <Chip tone="neutral">{panel?.type ?? "unknown panel type"}</Chip>
    </Panel>
  );
}
