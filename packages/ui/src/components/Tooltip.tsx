"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export const TooltipProvider = RadixTooltip.Provider;

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}

export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  return (
    <RadixTooltip.Root delayDuration={200}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 rounded-control border border-rule bg-panel px-2.5 py-1.5 font-body text-[12px] font-medium text-ink shadow-menu",
          )}
        >
          {content}
          <RadixTooltip.Arrow className="fill-panel" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
