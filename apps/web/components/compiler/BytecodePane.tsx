"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@oocc/ui";
import { useCompilerHighlight } from "@/lib/compiler/highlightStore";
import type { BytecodeChunk } from "@/lib/compiler/types";

export interface BytecodePaneProps {
  bytecode: BytecodeChunk | null;
  /** The VM's current pc, if playback has started — drawn as an indicator on the listing. */
  currentPc?: number | undefined;
}

/**
 * A real disassembly listing (docs/PRD.md §7): pc column, mnemonic,
 * operands, comment, right-aligned numbers, IBM Plex Mono
 * (`font-mono-label` already is — see packages/ui/src/theme.css). The
 * current-pc marker is a single `motion.span` sharing one `layoutId`
 * across renders — Motion animates it from its old row to its new one
 * (a FLIP transform) rather than it just appearing in a new place, which
 * is what makes stepping read as "a indicator travels down the listing."
 */
export function BytecodePane({ bytecode, currentPc }: BytecodePaneProps) {
  const hoverAstId = useCompilerHighlight((s) => s.hoverAstId);
  const selectedAstId = useCompilerHighlight((s) => s.selectedAstId);
  const setHover = useCompilerHighlight((s) => s.setHover);
  const setSelected = useCompilerHighlight((s) => s.setSelected);
  const reduceMotion = useReducedMotion();

  if (!bytecode) {
    return <div className="p-4 font-mono-label text-[12px] text-ink-soft">No bytecode yet.</div>;
  }

  return (
    <div className="h-full overflow-y-auto px-2 py-2" data-testid="compiler-bytecode-pane">
      <table className="w-full border-collapse font-mono-label text-[12px]">
        <tbody>
          <AnimatePresence initial={false}>
            {bytecode.instructions.map((instr) => {
              const isSelected = instr.astId === selectedAstId;
              const isHovered = instr.astId === hoverAstId;
              const isCurrent = instr.pc === currentPc;
              return (
                <motion.tr
                  key={instr.pc}
                  layout
                  initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: reduceMotion ? 0.01 : 0.16, ease: "easeOut" }}
                  className={cn(
                    "cursor-pointer transition-colors duration-150",
                    isSelected && "bg-[color-mix(in_srgb,var(--color-signal)_16%,transparent)]",
                    isHovered && !isSelected && "bg-[color-mix(in_srgb,var(--color-signal)_8%,transparent)]",
                  )}
                  onMouseEnter={() => setHover(instr.astId)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setSelected(instr.astId)}
                >
                  <td className="relative w-6 select-none pl-1">
                    {isCurrent ? (
                      <motion.span
                        layoutId="compiler-pc-indicator"
                        transition={
                          reduceMotion
                            ? { type: "tween", duration: 0.01 }
                            : { type: "spring", stiffness: 500, damping: 32 }
                        }
                        className="absolute inset-y-0 left-1 flex items-center text-signal"
                      >
                        ▸
                      </motion.span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-ink-soft">{instr.pc}</td>
                  <td className="px-2 py-1.5 text-left font-medium text-ink">{instr.opcode}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-ink-soft">
                    {instr.operands.join(", ")}
                  </td>
                  <td className="px-2 py-1.5 text-left text-ink-soft">{instr.comment}</td>
                </motion.tr>
              );
            })}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
