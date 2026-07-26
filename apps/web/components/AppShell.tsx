"use client";

import { CommandPalette, ToastProvider, ToastViewport, TooltipProvider } from "@oocc/ui";
import { useEffect, useState, type ReactNode } from "react";
import { useCommandRegistry } from "../lib/commands";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const commandRegistry = useCommandRegistry();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isCommandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isCommandK) return;
      event.preventDefault();
      setPaletteOpen((open) => !open);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <TooltipProvider>
      <ToastProvider>
        <div className="flex h-dvh flex-col bg-paper">
          <TopBar onOpenPalette={() => setPaletteOpen(true)} />
          {/*
            A fixed h-dvh (not min-h-dvh) is what makes every `h-full`
            further down the tree resolve: percentage heights need a
            definite ancestor, and a `min-height`-only root can't provide
            one. overflow-y-auto keeps content-heavy routes (e.g.
            /styleguide) scrollable instead of clipping — the workspace
            itself never needs it, since its regions manage their own
            internal scrolling.
          */}
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
        </div>
        <ToastViewport />
      </ToastProvider>
      <CommandPalette commands={commandRegistry} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </TooltipProvider>
  );
}
