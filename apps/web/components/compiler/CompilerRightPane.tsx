"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cn, ErrorBoundary } from "@oocc/ui";
import type { TickInfo } from "@/lib/player/ticks";
import type { AstNode, BytecodeChunk, Token, VmStep } from "@/lib/compiler/types";
import type { useCompilerPlayback } from "@/lib/compiler/usePlayback";
import { AstPane } from "./AstPane";
import { BytecodePane } from "./BytecodePane";
import { TokensPane } from "./TokensPane";
import { VmPane } from "./VmPane";

type TabKey = "tokens" | "ast" | "bytecode" | "run";

// Each tab maps to the pipeline stage that produces what it shows (docs/PRD.md
// §6: "stage colors carried through... the tab labels, and a thin accent
// line on the active pane") — Tokens is lex's output, AST is parse's,
// Bytecode is compile's, and Run is, well, run.
const TABS: ReadonlyArray<{ key: TabKey; label: string; color: string }> = [
  { key: "tokens", label: "Tokens", color: "var(--color-stage-lex)" },
  { key: "ast", label: "AST", color: "var(--color-stage-parse)" },
  { key: "bytecode", label: "Bytecode", color: "var(--color-stage-compile)" },
  { key: "run", label: "Run", color: "var(--color-stage-run)" },
];

export interface CompilerRightPaneProps {
  tokens: Token[];
  ast: AstNode | null;
  bytecode: BytecodeChunk | null;
  vmSteps: readonly VmStep[];
  vmTicks: readonly TickInfo[];
  playback: ReturnType<typeof useCompilerPlayback>;
}

/**
 * The right half of /compiler (docs/PRD.md §7): one tab visible at a
 * time — Tokens / AST / Bytecode / Run — rather than four always-on
 * panes, so a beginner reads one idea at a time instead of a five-pane
 * dashboard. Nothing about the underlying panes changed: same
 * components, same `lib/compiler/highlightStore.ts` cross-highlight
 * target, just one mounted at once. The Run tab is the existing `VmPane`
 * unchanged — its controls/stack/globals/output were already one
 * component, just one of five equally-loud panes before this.
 *
 * Tab switches slide rather than cut; direction follows tab order (left
 * of the previous tab slides in from the left, right slides in from the
 * right) so motion always reads as "moving along a shelf" instead of
 * arbitrary. `useReducedMotion` (not just the global CSS
 * `prefers-reduced-motion` rule, which only catches CSS transitions/
 * animations, not Motion's JS-driven ones) collapses both the tab-switch
 * slide and the underline's spring to an instant cut.
 */
export function CompilerRightPane({ tokens, ast, bytecode, vmSteps, vmTicks, playback }: CompilerRightPaneProps) {
  const [active, setActive] = useState<TabKey>("tokens");
  const reduceMotion = useReducedMotion();

  const activeIndex = TABS.findIndex((t) => t.key === active);
  // Tracks the previous index in state, not a ref, so the direction is
  // derived during render rather than by mutating a ref as a render-time
  // side effect (React Compiler flags the latter — see `usePlayback.ts`'s
  // identical `prevSteps` pattern for the same reasoning).
  const [prevIndex, setPrevIndex] = useState(activeIndex);
  const direction = activeIndex >= prevIndex ? 1 : -1;
  if (prevIndex !== activeIndex) setPrevIndex(activeIndex);

  const slideDistance = reduceMotion ? 0 : 28;
  const duration = reduceMotion ? 0.01 : 0.18;

  const activeTab = TABS[activeIndex]!;

  return (
    <div className="flex h-full flex-col rounded-panel border border-rule bg-panel shadow-raised">
      <div
        role="tablist"
        aria-label="Compiler view"
        className="flex h-11 shrink-0 items-center gap-1 border-b border-rule px-3"
      >
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.key)}
              className={cn(
                "relative rounded-control px-3 py-2 font-body text-[13px] font-semibold transition-colors duration-150",
                "hover:text-ink active:scale-[0.97]",
                !isActive && "text-ink-soft",
              )}
              style={isActive ? { color: tab.color } : undefined}
            >
              {tab.label}
              {isActive ? (
                <motion.span
                  layoutId="compiler-tab-underline"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full"
                  style={{ backgroundColor: tab.color }}
                  transition={{ duration, ease: "easeOut" }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
      {/* A thin accent line names which stage the visible pane belongs to. */}
      <div aria-hidden className="h-0.5 shrink-0" style={{ backgroundColor: activeTab.color }} />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={{ opacity: 0, x: slideDistance * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -slideDistance * direction }}
            transition={{ duration, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <ErrorBoundary title={TABS[activeIndex]!.label}>
              {active === "tokens" ? (
                <TokensPane tokens={tokens} ast={ast} />
              ) : active === "ast" ? (
                <AstPane ast={ast} />
              ) : active === "bytecode" ? (
                <BytecodePane bytecode={bytecode} currentPc={playback.step?.pc} />
              ) : (
                <VmPane
                  steps={vmSteps}
                  ticks={vmTicks}
                  currentStep={playback.currentStep}
                  step={playback.step}
                  playing={playback.playing}
                  lastIndex={playback.lastIndex}
                  jumpTo={playback.jumpTo}
                  stepBy={playback.stepBy}
                  togglePlay={playback.togglePlay}
                />
              )}
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
