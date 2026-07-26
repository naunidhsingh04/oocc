import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  actions?: ReactNode;
  bodyClassName?: string;
}

/** docs/PRD.md §6.2: panels are 0px radius, 1px --rule border, mono uppercase header. */
export function Panel({ title, actions, className, bodyClassName, children, ...props }: PanelProps) {
  return (
    <div className={cn("flex flex-col rounded-panel border border-rule bg-panel", className)} {...props}>
      {title ? (
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-rule px-3">
          <h3 className="truncate font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
            {title}
          </h3>
          {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </div>
  );
}
