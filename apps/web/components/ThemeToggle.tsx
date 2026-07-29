"use client";

import { cn } from "@oocc/ui";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { THEME_IDS, THEME_META } from "@/lib/theme/themes";

/**
 * The header's theme picker (docs/PRD.md §6): a swatch button showing the
 * active preset, opening a small list of all five swatches. Named
 * `ThemeToggle` still — kept so `TopBar.tsx`'s import didn't need to
 * change — even though it's a five-way picker now, not a light/dark toggle.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const active = THEME_META[theme];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Theme: ${active.label}. Choose a different theme.`}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-control border border-transparent px-2 py-1.5 transition-colors duration-150 hover:border-rule hover:bg-raised active:scale-[0.97]"
      >
        <span
          aria-hidden
          className="h-4 w-4 shrink-0 rounded-full border border-rule"
          style={{ backgroundColor: active.swatchBg }}
        >
          <span
            className="block h-full w-full rounded-full"
            style={{
              background: `radial-gradient(circle at 65% 35%, ${active.swatchAccent} 0 35%, transparent 36%)`,
            }}
          />
        </span>
        <span className="font-body text-[13px] font-medium text-ink-soft">{active.label}</span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="listbox"
            aria-label="Theme"
            initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full z-50 mt-2 w-44 rounded-panel border border-rule bg-panel p-1.5 shadow-menu"
          >
            {THEME_IDS.map((id) => {
              const meta = THEME_META[id];
              const isActive = id === theme;
              return (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    setTheme(id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left font-body text-[13px] transition-colors duration-150",
                    isActive ? "bg-raised text-ink" : "text-ink-soft hover:bg-raised hover:text-ink",
                  )}
                >
                  <span
                    aria-hidden
                    className="h-4 w-4 shrink-0 rounded-full border border-rule"
                    style={{ backgroundColor: meta.swatchBg }}
                  >
                    <span
                      className="block h-full w-full rounded-full"
                      style={{
                        background: `radial-gradient(circle at 65% 35%, ${meta.swatchAccent} 0 35%, transparent 36%)`,
                      }}
                    />
                  </span>
                  {meta.label}
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
