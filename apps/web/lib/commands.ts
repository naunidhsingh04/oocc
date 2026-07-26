import type { CommandItem } from "@oocc/ui";

/**
 * The ⌘K command registry. Phase 0 wires the palette end-to-end (see
 * components/AppShell.tsx) but ships no commands — later phases (run,
 * switch language, jump to step, open tutor, ...) push entries here.
 */
export const commandRegistry: CommandItem[] = [];
