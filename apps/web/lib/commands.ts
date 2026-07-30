"use client";

import type { CommandItem } from "@oocc/ui";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { THEME_IDS, THEME_META } from "@/lib/theme/themes";
import { useMemo } from "react";
import { fetchFixture, FIXTURE_NAMES } from "./fixtures";
import { usePlayerStore } from "./player";

/**
 * The ⌘K command registry (docs/PRD.md §6.4: "Command palette is the
 * primary navigation"). Playback/theme commands act on the player store
 * and the theme store directly — both are external stores, so `onSelect`
 * reaches into them via `.getState()`/`setTheme` rather than needing props
 * threaded down from wherever the palette happens to be mounted.
 */
export function useCommandRegistry(): CommandItem[] {
  const playing = usePlayerStore((state) => state.playing);
  const hasTrace = usePlayerStore((state) => state.trace !== null);
  const { theme, setTheme } = useTheme();

  return useMemo(() => {
    const playback: CommandItem[] = [
      {
        id: "playback.toggle",
        label: playing ? "Pause" : "Play",
        group: "Playback",
        shortcut: "Space",
        onSelect: () => usePlayerStore.getState().togglePlay(),
      },
      {
        id: "playback.step-forward",
        label: "Step forward",
        group: "Playback",
        shortcut: "→",
        onSelect: () => usePlayerStore.getState().stepForward(),
      },
      {
        id: "playback.step-backward",
        label: "Step backward",
        group: "Playback",
        shortcut: "←",
        onSelect: () => usePlayerStore.getState().stepBackward(),
      },
      {
        id: "playback.jump-start",
        label: "Jump to start",
        group: "Playback",
        shortcut: "Home",
        onSelect: () => usePlayerStore.getState().jumpToStart(),
      },
      {
        id: "playback.jump-end",
        label: "Jump to end",
        group: "Playback",
        shortcut: "End",
        onSelect: () => usePlayerStore.getState().jumpToEnd(),
      },
      {
        id: "playback.speed-up",
        label: "Increase speed",
        group: "Playback",
        shortcut: ".",
        onSelect: () => usePlayerStore.getState().cycleSpeed(1),
      },
      {
        id: "playback.speed-down",
        label: "Decrease speed",
        group: "Playback",
        shortcut: ",",
        onSelect: () => usePlayerStore.getState().cycleSpeed(-1),
      },
    ];

    const appearance: CommandItem[] = THEME_IDS.filter((id) => id !== theme).map((id) => ({
      id: `theme.${id}`,
      label: `Switch to ${THEME_META[id].label}`,
      group: "Appearance",
      onSelect: () => setTheme(id),
    }));

    // Deliberately dev-only (unlike `fetchFixture` itself, which works
    // fine in production now — see its own docstring): "Load fixture: X"
    // for all eighteen internal fixture names is a debug convenience for
    // developers, not something a real visitor needs in the command
    // palette alongside playback/theme commands.
    const fixtures: CommandItem[] =
      process.env.NODE_ENV === "production"
        ? []
        : FIXTURE_NAMES.map((name) => ({
            id: `fixture.${name}`,
            label: `Load fixture: ${name}`,
            group: "Fixtures",
            keywords: ["fixture", "load", "trace", name],
            onSelect: () => {
              void fetchFixture(name).then((bundle) => usePlayerStore.getState().loadTrace(bundle));
            },
          }));

    return hasTrace ? [...playback, ...appearance, ...fixtures] : [...appearance, ...fixtures];
  }, [playing, hasTrace, theme, setTheme]);
}
