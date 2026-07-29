"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_THEME, isThemeId, THEME_STORAGE_KEY, type ThemeId } from "./themes";

interface ThemeContextValue {
  theme: ThemeId;
  /** Same field name `next-themes` used — kept so components that only
   * need "something changed, redraw the canvas" (the ribbon components)
   * didn't need their own effect dependency renamed. */
  resolvedTheme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Reads localStorage synchronously and stamps `data-theme` on `<html>`
 * before hydration — embedded as a raw `<script>` in `app/layout.tsx`, the
 * same job `next-themes`' own injected script used to do for a two-theme
 * light/dark toggle, generalized to five named presets. On a genuinely
 * first visit (nothing stored yet) it falls back to the OS's light/dark
 * signal, landing on Slate or Paper rather than always defaulting to
 * Paper regardless of the visitor's system preference.
 */
export const THEME_NO_FLASH_SCRIPT = `(function(){try{var v=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var valid=${JSON.stringify(["slate", "paper", "midnight", "sepia", "mist"])};if(!v||valid.indexOf(v)===-1){v=window.matchMedia("(prefers-color-scheme: dark)").matches?"slate":"paper";}document.documentElement.setAttribute("data-theme",v);}catch(e){}})();`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  // The inline script (see above) already set the real value on <html>
  // before this ever runs; this just brings React's own state in sync with
  // it post-hydration so `useTheme()` consumers (the picker, the command
  // palette) render the right selection instead of always reading "paper."
  // Syncs React's own state with an external system (localStorage/matchMedia)
  // read once at mount — the same shape the predecessor `next-themes`-based
  // `ThemeToggle` relied on internally.
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(stored)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThemeState(stored);
      return;
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setThemeState(prefersDark ? "slate" : "paper");
  }, []);

  const setTheme = (next: ThemeId) => {
    setThemeState(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme: theme, setTheme }}>{children}</ThemeContext.Provider>
  );
}

// Falls back to a static Paper default rather than throwing when rendered
// outside a `ThemeProvider` — component tests across this codebase mount
// individual components (`TopBar`, `TraceRibbon`, `NarrowWorkspace`, ...)
// without the full app shell, and `next-themes` (what this module replaced)
// was equally permissive about this. `setTheme` becomes a no-op in that case.
const FALLBACK: ThemeContextValue = {
  theme: DEFAULT_THEME,
  resolvedTheme: DEFAULT_THEME,
  setTheme: () => {},
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? FALLBACK;
}
