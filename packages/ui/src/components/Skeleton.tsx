import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

/**
 * A loading placeholder shaped like the content it stands in for (docs/PRD.md
 * §6: "skeleton shapes that match the real content, with a soft shimmer —
 * never a bare spinner"). The shimmer is a plain CSS `background-position`
 * sweep (`@keyframes oocc-shimmer`, packages/ui/src/theme.css) so it's
 * caught by the global `prefers-reduced-motion` rule automatically, same as
 * every other CSS-driven transition in this design system.
 */
export function Skeleton({ className, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-control bg-raised", className)}
      style={{
        backgroundImage:
          "linear-gradient(100deg, transparent 30%, var(--color-panel) 50%, transparent 70%)",
        backgroundSize: "200% 100%",
        animation: "oocc-shimmer 1.6s ease-in-out infinite",
        ...style,
      }}
      {...props}
    />
  );
}
