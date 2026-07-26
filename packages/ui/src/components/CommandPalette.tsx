"use client";

import { Command } from "cmdk";
import { SearchIcon } from "../icons";
import { cn } from "../lib/cn";

export interface CommandItem {
  id: string;
  label: string;
  group?: string;
  shortcut?: string;
  keywords?: string[];
  onSelect: () => void;
}

export interface CommandPaletteProps {
  /** The command registry. Empty in Phase 0 — see apps/web/lib/commands.ts. */
  commands: CommandItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder?: string;
}

export function CommandPalette({
  commands,
  open,
  onOpenChange,
  placeholder = "Type a command…",
}: CommandPaletteProps) {
  const groups = groupCommands(commands);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      shouldFilter
      loop
      overlayClassName="fixed inset-0 z-50 bg-ink/40"
      contentClassName={cn(
        "fixed left-1/2 top-[20vh] z-50 w-full max-w-lg -translate-x-1/2 rounded-control border border-rule bg-panel shadow-menu",
      )}
    >
      <div className="flex items-center gap-2 border-b border-rule px-3">
        <SearchIcon className="shrink-0 text-ink-soft" />
        <Command.Input
          placeholder={placeholder}
          className="h-11 w-full bg-transparent font-body text-sm text-ink outline-none placeholder:text-ink-soft"
        />
      </div>
      <Command.List className="max-h-80 overflow-y-auto p-1">
        <Command.Empty className="px-3 py-6 text-center font-body text-sm text-ink-soft">
          No matching commands.
        </Command.Empty>
        {groups.map(([groupName, items]) => (
          <Command.Group
            key={groupName}
            heading={groupName}
            className="px-2 py-1.5 [&_[cmdk-group-heading]]:mb-1 [&_[cmdk-group-heading]]:px-1 [&_[cmdk-group-heading]]:font-mono-label [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-ink-soft"
          >
            {items.map((item) => (
              <Command.Item
                key={item.id}
                value={item.label}
                keywords={item.keywords ?? []}
                onSelect={() => {
                  item.onSelect();
                  onOpenChange(false);
                }}
                className="flex cursor-pointer items-center justify-between rounded-control px-2 py-1.5 font-body text-sm text-ink data-[selected=true]:bg-paper data-[selected=true]:text-signal"
              >
                <span>{item.label}</span>
                {item.shortcut ? (
                  <span className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
                    {item.shortcut}
                  </span>
                ) : null}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}

function groupCommands(commands: CommandItem[]): Array<[string, CommandItem[]]> {
  const groups = new Map<string, CommandItem[]>();
  for (const command of commands) {
    const key = command.group ?? "Commands";
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(command);
    } else {
      groups.set(key, [command]);
    }
  }
  return Array.from(groups.entries());
}
