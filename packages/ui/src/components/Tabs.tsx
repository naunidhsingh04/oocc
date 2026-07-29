"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

export const Tabs = RadixTabs.Root;

/**
 * The active-tab underline slides between triggers (docs/PRD.md §6)
 * instead of jumping — measured off the DOM rather than off Radix's
 * `value` prop, so this works whether a `Tabs` call site is controlled or
 * uncontrolled (most of this app's usages are the latter). A
 * `MutationObserver` on `data-state` catches every selection change
 * (click, arrow-key nav, and Radix's own default-tab-on-mount), and a
 * `ResizeObserver` keeps the underline correctly placed if the tab list's
 * own width changes (e.g. a narrow-viewport reflow).
 */
export function TabsList({ className, children, ...props }: React.ComponentProps<typeof RadixTabs.List>) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    function measure() {
      const active = list?.querySelector<HTMLElement>('[data-state="active"]');
      if (!active || !list) {
        setRect(null);
        return;
      }
      setRect({ left: active.offsetLeft, width: active.offsetWidth });
    }

    measure();
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(list, { attributes: true, attributeFilter: ["data-state"], subtree: true });
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(list);
    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, [children]);

  return (
    <RadixTabs.List
      ref={listRef}
      className={cn("relative flex items-center gap-4 border-b border-rule", className)}
      {...props}
    >
      {children}
      {rect ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-px h-0.5 rounded-full bg-signal transition-[transform,width] duration-150 ease-out"
          style={{ width: rect.width, transform: `translateX(${rect.left}px)` }}
        />
      ) : null}
    </RadixTabs.List>
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        "relative py-2 font-body text-sm font-medium text-ink-soft transition-colors duration-150 hover:text-ink",
        "data-[state=active]:text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof RadixTabs.Content>) {
  return <RadixTabs.Content className={cn("pt-3", className)} {...props} />;
}
