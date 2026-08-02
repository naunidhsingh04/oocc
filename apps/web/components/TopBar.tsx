"use client";

import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { Button, cn, CloseIcon, CommandIcon, MenuIcon } from "@oocc/ui";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

// docs/PRD.md §9's final design critique: "remove one thing that is not
// carrying information." /styleguide is a real, still-reachable page (an
// internal design-token/component reference) but it's meta-tooling, not
// something a learner using this product needs — promoting it to the
// persistent top-level nav next to Problems/Curriculum/Progress was noise,
// not signal, so it's off this list without deleting the page itself.
const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/play", label: "Playground" },
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
  // Below this, six top-level links plus the logo and the right-side
  // cluster (key/theme/palette) no longer fit a single row at any
  // reasonable font size — found live at 375px, where a horizontally
  // scrollable nav (the previous fix) left five of six links reachable
  // only by discovering you could swipe a ~110px sliver, with zero visual
  // affordance that it scrolled at all. Below `md` this collapses to a
  // menu button instead; `md` and up keeps the always-visible row.
  const isNarrow = useMediaQuery("(max-width: 767px)");
  const [menuOpen, setMenuOpen] = useState(false);

  // Route changes should close the mobile menu, not leave it open over
  // the newly-navigated page.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between gap-4 border-b border-rule bg-panel px-4">
      <div className="flex min-w-0 items-center gap-6">
        <Link href="/" className="shrink-0 font-display text-[17px] font-bold tracking-[-0.02em] text-ink">
          OOCC
        </Link>
        {isNarrow ? null : (
          <nav className="flex items-center gap-1" aria-label="Primary">
            {NAV_LINKS.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative shrink-0 rounded-control px-3 py-2 font-body text-[14px] font-medium transition-colors duration-150",
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
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isNarrow ? null : <SettingsPanel />}
        {isNarrow ? null : <ThemeToggle />}
        {isNarrow ? null : (
          <Button variant="secondary" size="sm" onClick={onOpenPalette}>
            <CommandIcon className="h-3.5 w-3.5" />
            <span className="font-mono-label text-[11px] uppercase tracking-[0.06em]">⌘K</span>
          </Button>
        )}
        {isNarrow ? (
          // 44px minimum tap target (Apple/Google's own guidance) — the
          // desktop IconButton primitive is deliberately a denser 32px,
          // so this is a plain button rather than a className override on
          // IconButton, whose baked-in `h-8 w-8` would otherwise compete
          // with an appended size class at equal CSS specificity with no
          // reliable winner (this repo doesn't pull in a class-merge
          // utility to resolve that safely).
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-control text-ink-soft transition-colors hover:bg-raised hover:text-ink"
          >
            {menuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        ) : null}
      </div>

      <AnimatePresence>
        {isNarrow && menuOpen ? (
          <motion.nav
            aria-label="Primary"
            initial={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.15, ease: "easeOut" }}
            className="absolute inset-x-0 top-full z-dropdown flex flex-col border-b border-rule bg-panel p-2 shadow-menu"
          >
            {NAV_LINKS.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center rounded-control px-3 font-body text-[15px] font-medium transition-colors",
                    active ? "bg-raised text-ink" : "text-ink-soft hover:bg-raised hover:text-ink",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-2 flex items-center justify-between border-t border-rule pt-2">
              <SettingsPanel />
              <ThemeToggle />
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
