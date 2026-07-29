"use client";

import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { Button, cn, CommandIcon } from "@oocc/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

// docs/PRD.md §9's final design critique: "remove one thing that is not
// carrying information." /styleguide is a real, still-reachable page (an
// internal design-token/component reference) but it's meta-tooling, not
// something a learner using this product needs — promoting it to the
// persistent top-level nav next to Problems/Curriculum/Progress was noise,
// not signal, so it's off this list without deleting the page itself.
const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/problems", label: "Problems" },
  { href: "/curriculum", label: "Curriculum" },
  { href: "/progress", label: "Progress" },
  { href: "/compiler", label: "Compiler" },
];

export interface TopBarProps {
  onOpenPalette: () => void;
}

/** docs/PRD.md §6.4: a 40px bar — logo, nav, and the ⌘K trigger. */
export function TopBar({ onOpenPalette }: TopBarProps) {
  const pathname = usePathname();

  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-rule bg-panel px-3">
      <div className="flex items-center gap-4">
        <Link href="/" className="font-mono-label text-[13px] uppercase tracking-[0.06em] text-ink">
          OOCC
        </Link>
        <nav className="flex items-center gap-1" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-control px-2 py-1 font-body text-[13px] font-medium transition-colors",
                  active ? "text-signal" : "text-ink-soft hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-1">
        <SettingsPanel />
        <ThemeToggle />
        <Button variant="secondary" size="sm" onClick={onOpenPalette}>
          <CommandIcon className="h-3.5 w-3.5" />
          <span className="font-mono-label text-[11px] uppercase tracking-[0.06em]">⌘K</span>
        </Button>
      </div>
    </header>
  );
}
