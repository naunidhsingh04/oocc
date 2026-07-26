import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex h-full flex-col items-center justify-center gap-2 p-8 text-center", className)}>
      {icon ? <div className="text-ink-soft">{icon}</div> : null}
      <p className="font-body text-sm font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-pretty font-body text-sm text-ink-soft">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
