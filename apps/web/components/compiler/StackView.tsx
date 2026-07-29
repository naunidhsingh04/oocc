"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { StackValue } from "@/lib/compiler/types";

export interface StackViewProps {
  stack: StackValue[];
}

function formatValue(value: StackValue): string {
  if (value.type === "bool") return value.value ? "true" : "false";
  return String(value.value);
}

/**
 * The VM pane's animated operand stack (docs/PRD.md §7: "cells push and
 * pop with motion") — a real spring, not a tween, so a push/pop reads as
 * a cell physically arriving/leaving rather than fading in place. Keyed
 * by index — this stack is a plain array with no stable per-value
 * identity, so index-based keys plus `AnimatePresence` still read
 * correctly: a push adds a new top (last) key and animates only that
 * cell in; a pop removes the top key and animates only that one out.
 * `useReducedMotion` is checked explicitly here (not left to
 * packages/ui/src/theme.css's global CSS rule, which only catches CSS
 * transitions/animations — Motion's spring is JS-driven and doesn't
 * listen to it) and collapses the spring to an instant snap.
 */
export function StackView({ stack }: StackViewProps) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0.01 }
    : { type: "spring" as const, stiffness: 500, damping: 28, mass: 0.7 };

  return (
    <div className="flex h-full flex-col-reverse gap-1.5 overflow-y-auto p-2" data-testid="compiler-stack-view">
      <AnimatePresence initial={false}>
        {stack.map((value, index) => (
          <motion.div
            key={index}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.9 }}
            transition={transition}
            className="flex h-9 items-center justify-between rounded-control border border-rule bg-panel px-3 font-mono-label text-[12px] tabular-nums text-ink"
          >
            <span className="text-ink-soft">[{index}]</span>
            <span>{formatValue(value)}</span>
          </motion.div>
        ))}
      </AnimatePresence>
      {stack.length === 0 ? (
        <div className="py-2 text-center font-mono-label text-[11px] text-ink-soft">empty</div>
      ) : null}
    </div>
  );
}
