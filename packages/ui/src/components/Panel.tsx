import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  actions?: ReactNode;
  bodyClassName?: string;
}

/** docs/PRD.md §6: 8px radius, a soft shadow rather than a hard hairline
 * carrying the panel's edge, a proper UI typeface header (sentence case,
 * real weight) rather than mono-uppercase — the "instrument" reading mono
 * labels gave every panel is exactly what the new warmer direction retires. */
export function Panel({ title, actions, className, bodyClassName, children, ...props }: PanelProps) {
  return (
    <div
      className={cn("flex flex-col rounded-panel border border-rule bg-panel shadow-card", className)}
      {...props}
    >
      {title ? (
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-rule px-3.5">
          <h3 className="truncate font-body text-[13px] font-semibold text-ink-soft">{title}</h3>
          {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </div>
  );
}
