"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ReactNode } from "react";

export interface StaggerProps {
  className?: string;
  children?: ReactNode;
}

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

// Opacity only — no `y` offset. `app/template.tsx` already slides the
// *whole page* up on mount; giving each `StaggerItem` its own `y` motion
// on top of that was a real, found bug (docs/PRD.md's "elements animating
// while their parent is also animating"): every routed page compounded
// two independent y-axis transforms in the same ~200ms window — the
// page-level slide and each section's own slide — which is also a
// same-element-animates-twice violation of this design system's own
// restraint rule. Only one of the two should own vertical motion;
// Stagger's job is sequencing *when* content reveals, not *how far* it
// moves, so it kept the fade and dropped the offset.
const itemVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2, ease: "easeOut" } },
};

/**
 * Stagger + StaggerItem (docs/PRD.md §6): a page's own header enters,
 * then its panels, 40ms apart — only on first mount, never on re-render.
 * That's automatic here: Framer Motion only plays a component's `initial`
 * → `animate` transition once, when it first mounts, and re-renders of an
 * already-mounted tree don't replay it. Pairing this with `app/template.tsx`
 * (which itself remounts fresh on every route change) is what makes a
 * *navigation* replay the stagger while an in-page state update doesn't.
 */
export function Stagger({ className, children }: StaggerProps) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div className={className} variants={containerVariants} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

export function StaggerItem({ className, children }: StaggerProps) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
