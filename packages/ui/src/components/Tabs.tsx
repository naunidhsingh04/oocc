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
  const [rect, setRect] = useState<{ left: number; width: number; accent: string | null } | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    let triggerResizeObserver: ResizeObserver | null = null;

    function measure() {
      const active = list?.querySelector<HTMLElement>('[data-state="active"]');
      if (!active || !list) {
        setRect(null);
        return;
      }
      // An individual trigger may opt the underline into its own accent
      // color via `style={{ "--tab-accent": ... }}` (docs/PRD.md §6's
      // per-stage tab colors) — falls back to the default signal color.
      const accent = active.style.getPropertyValue("--tab-accent") || null;
      setRect({ left: active.offsetLeft, width: active.offsetWidth, accent });

      // Re-observe per-trigger: a trigger's own width can change (label
      // text change, e.g. dynamic tab counts) without the list's outer
      // box changing, which the list-level ResizeObserver alone misses.
      triggerResizeObserver?.disconnect();
      triggerResizeObserver = new ResizeObserver(measure);
      for (const trigger of list.querySelectorAll<HTMLElement>('[role="tab"]')) {
        triggerResizeObserver.observe(trigger);
      }
    }

    measure();
    // childList/characterData (not just the `data-state` attribute) so a
    // label's text changing, or tabs being added/removed, re-measures too.
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(list, {
      attributes: true,
      attributeFilter: ["data-state"],
      subtree: true,
      childList: true,
      characterData: true,
    });
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(list);
    // Web fonts swapping in after first paint shift measured text widths.
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      triggerResizeObserver?.disconnect();
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
          className={cn(
            "pointer-events-none absolute -bottom-px h-0.5 rounded-full transition-[transform,width] duration-150 ease-out",
            !rect.accent && "bg-signal",
          )}
          style={{
            width: rect.width,
            transform: `translateX(${rect.left}px)`,
            backgroundColor: rect.accent ?? undefined,
          }}
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
