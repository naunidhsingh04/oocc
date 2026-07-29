"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Route changes cross-fade with a small upward slide (docs/PRD.md §6) —
 * Next's `template.tsx` convention remounts fresh on every navigation
 * (unlike `layout.tsx`, which persists), which is exactly what makes this
 * replay on every route change and *also* what makes a page's own
 * `Stagger`/`StaggerItem` content (`@oocc/ui`) replay its first-mount
 * entrance on navigation, never on an in-page re-render.
 */
export default function Template({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: "easeOut" }}
      className="flex min-h-0 flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
