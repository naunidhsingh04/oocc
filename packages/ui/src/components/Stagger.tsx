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

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
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
