"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "../lib/cn";

export const Tabs = RadixTabs.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn("flex items-center gap-4 border-b border-rule", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        "relative py-2 font-body text-sm font-medium text-ink-soft transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-transparent hover:text-ink",
        "data-[state=active]:text-ink data-[state=active]:after:bg-signal",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof RadixTabs.Content>) {
  return <RadixTabs.Content className={cn("pt-3", className)} {...props} />;
}
