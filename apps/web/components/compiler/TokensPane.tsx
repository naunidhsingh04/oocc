"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
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

  const virtualizer = useVirtualizer({
    count: tokens.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 12,
  });

  function astIdFor(token: Token): number | null {
    if (!ast) return null;
    return findEnclosingNodeId(ast, Math.min(token.start, Math.max(token.end - 1, token.start)));
  }

  return (
    <div ref={parentRef} className="h-full overflow-y-auto" data-testid="compiler-tokens-pane">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((row) => {
          const token = tokens[row.index]!;
          const astId = astIdFor(token);
          const isSelected = astId !== null && astId === selectedAstId;
          const isHovered = astId !== null && astId === hoverAstId;
          return (
            <div
              key={row.key}
              className={cn(
                "absolute left-0 top-0 flex w-full cursor-pointer items-center gap-2 border-b border-rule px-2 font-mono-label text-[11px]",
                isSelected && "bg-[color-mix(in_srgb,var(--color-signal)_16%,transparent)]",
                isHovered && !isSelected && "bg-[color-mix(in_srgb,var(--color-signal)_8%,transparent)]",
              )}
              style={{ height: row.size, transform: `translateY(${row.start}px)` }}
              onMouseEnter={() => setHover(astId)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setSelected(astId)}
            >
              <span className="w-28 shrink-0 uppercase tracking-[0.06em] text-ink-soft">{token.type}</span>
              <span className="truncate text-ink">{token.lexeme || "␀"}</span>
              <span className="ml-auto shrink-0 tabular-nums text-ink-soft">
                {token.line}:{token.column}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
