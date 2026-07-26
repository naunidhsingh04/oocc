"use client";

import { CommandPalette, ToastProvider, ToastViewport, TooltipProvider } from "@oocc/ui";
import { useEffect, useState, type ReactNode } from "react";
import { commandRegistry } from "../lib/commands";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

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
        <div className="flex min-h-dvh flex-col bg-paper">
          <TopBar onOpenPalette={() => setPaletteOpen(true)} />
          <main className="flex flex-1 flex-col">{children}</main>
        </div>
        <ToastViewport />
      </ToastProvider>
      <CommandPalette commands={commandRegistry} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </TooltipProvider>
  );
}
