"use client";

import { AnimatePresence, motion } from "motion/react";
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
 * pop with motion"). Keyed by index — this stack is a plain array with no
 * stable per-value identity, so index-based keys plus `AnimatePresence`
 * still read correctly: a push adds a new bottom-most... no, top-most
 * (last) key and animates only that cell in; a pop removes the top key
 * and animates only that one out. Reduced-motion is handled globally by
 * packages/ui/src/theme.css's `prefers-reduced-motion` rule, which
 * collapses every animation duration to ~0.
 */
export function StackView({ stack }: StackViewProps) {
  return (
    <div className="flex h-full flex-col-reverse gap-1 overflow-y-auto p-2" data-testid="compiler-stack-view">
      <AnimatePresence initial={false}>
        {stack.map((value, index) => (
          <motion.div
            key={index}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="flex h-8 items-center justify-between rounded-control border border-rule bg-panel px-2 font-mono-label text-[12px] tabular-nums text-ink"
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
