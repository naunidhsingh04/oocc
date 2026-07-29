"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { cn } from "@oocc/ui";
import { findEnclosingNodeId } from "@/lib/compiler/astIndex";
import { useCompilerHighlight } from "@/lib/compiler/highlightStore";
import type { AstNode, Token } from "@/lib/compiler/types";

export interface TokensPaneProps {
  tokens: Token[];
  ast: AstNode | null;
}

/** Tokens as typed chips, virtualized (docs/PRD.md §7) — one row per token. */
export function TokensPane({ tokens, ast }: TokensPaneProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const hoverAstId = useCompilerHighlight((s) => s.hoverAstId);
  const selectedAstId = useCompilerHighlight((s) => s.selectedAstId);
  const setHover = useCompilerHighlight((s) => s.setHover);
  const setSelected = useCompilerHighlight((s) => s.setSelected);
  const reduceMotion = useReducedMotion();

  const virtualizer = useVirtualizer({
    count: tokens.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 12,
  });

  function astIdFor(token: Token): number | null {
    if (!ast) return null;
    return findEnclosingNodeId(ast, Math.min(token.start, Math.max(token.end - 1, token.start)));
  }

  if (tokens.length === 0) {
    return <div className="p-4 font-mono-label text-[12px] text-ink-soft">No tokens yet.</div>;
  }

  return (
    <div ref={parentRef} className="h-full overflow-y-auto px-2 py-2" data-testid="compiler-tokens-pane">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((row) => {
          const token = tokens[row.index]!;
          const astId = astIdFor(token);
          const isSelected = astId !== null && astId === selectedAstId;
          const isHovered = astId !== null && astId === hoverAstId;
          // Content-derived key (not the virtualizer's own index-only
          // key) — a keystroke that shifts token contents at this row
          // position reads as a new element mounting, so it fades/slides
          // in instead of silently swapping text underneath the reader.
          const contentKey = `${token.type}:${token.start}:${token.end}`;
          return (
            <div
              key={row.key}
              className="absolute left-0 top-0 w-full"
              style={{ height: row.size, transform: `translateY(${row.start}px)` }}
            >
              <motion.div
                key={contentKey}
                initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: reduceMotion ? 0.01 : 0.16, ease: "easeOut" }}
                className={cn(
                  "flex h-full cursor-pointer items-center gap-3 rounded-control px-3 font-mono-label text-[12px] transition-colors duration-150",
                  isSelected && "bg-[color-mix(in_srgb,var(--color-signal)_16%,transparent)]",
                  isHovered && !isSelected && "bg-[color-mix(in_srgb,var(--color-signal)_8%,transparent)]",
                )}
                onMouseEnter={() => setHover(astId)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setSelected(astId)}
              >
                <span className="w-28 shrink-0 uppercase tracking-[0.06em] text-ink-soft">{token.type}</span>
                <span className="truncate text-ink">{token.lexeme || "␀"}</span>
                <span className="ml-auto shrink-0 tabular-nums text-ink-soft">
                  {token.line}:{token.column}
                </span>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
