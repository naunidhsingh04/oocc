"use client";

import { IconButton, MoonIcon, SunIcon } from "@oocc/ui";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes only knows the resolved theme after the client mounts;
  // rendering a neutral placeholder until then avoids a hydration mismatch.
  // This mount-detection effect has no external system to synchronize with
  // other than "has React committed the client render yet" — there's no
  // subscription to move this into.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <IconButton
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted ? isDark ? <SunIcon /> : <MoonIcon /> : <span className="h-4 w-4" />}
    </IconButton>
  );
}
