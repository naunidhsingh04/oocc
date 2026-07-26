"use client";

import { Group, Panel, Separator, type GroupProps } from "react-resizable-panels";
import { cn } from "../lib/cn";

export type ResizableOrientation = "horizontal" | "vertical";

export interface ResizableSplitProps extends Omit<GroupProps, "orientation"> {
  orientation?: ResizableOrientation;
}

/** A rack of resizable panes, like an instrument's workspace (docs/PRD.md §6.4). */
export function ResizableSplit({ orientation = "horizontal", className, ...props }: ResizableSplitProps) {
  return <Group orientation={orientation} className={cn("flex h-full w-full", className)} {...props} />;
}

export const ResizablePane = Panel;

export interface ResizableHandleProps {
  orientation?: ResizableOrientation;
  className?: string;
}

/** Must be a direct child of ResizableSplit, between two ResizablePane elements. */
export function ResizableHandle({ orientation = "horizontal", className }: ResizableHandleProps) {
  const isHorizontal = orientation === "horizontal";

  return (
    <Separator
      className={cn(
        "group relative shrink-0 bg-transparent outline-none",
        isHorizontal ? "w-2 cursor-col-resize" : "h-2 cursor-row-resize",
        className,
      )}
    >
      <span
        className={cn(
          "absolute bg-rule transition-colors group-hover:bg-signal group-active:bg-signal",
          isHorizontal
            ? "inset-y-0 left-1/2 w-px -translate-x-1/2"
            : "inset-x-0 top-1/2 h-px -translate-y-1/2",
        )}
      />
    </Separator>
  );
}
