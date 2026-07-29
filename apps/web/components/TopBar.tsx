"use client";

import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { Button, cn, CommandIcon } from "@oocc/ui";
import { motion, useReducedMotion } from "motion/react";
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

/**
 * docs/PRD.md §6: a header with real presence — the logo carries weight,
 * the active nav item gets a sliding underline (not just a color swap),
 * and the bar itself has enough vertical room to not read as a dense
 * toolbar. Taller than the original 40px bar this replaces.
 */
export function TopBar({ onOpenPalette }: TopBarProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-rule bg-panel px-4">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-display text-[17px] font-bold tracking-[-0.02em] text-ink">
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
                  "relative rounded-control px-3 py-2 font-body text-[14px] font-medium transition-colors duration-150",
                  active ? "text-ink" : "text-ink-soft hover:text-ink",
                )}
              >
                {link.label}
                {active ? (
                  <motion.span
                    layoutId="topbar-nav-underline"
                    className="absolute inset-x-3 -bottom-[3px] h-0.5 rounded-full bg-signal"
                    transition={{ duration: reduceMotion ? 0.01 : 0.18, ease: "easeOut" }}
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-2">
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
