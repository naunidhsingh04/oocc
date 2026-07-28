"use client";

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
 * (`font-mono-label` already is — see packages/ui/src/theme.css).
 */
export function BytecodePane({ bytecode, currentPc }: BytecodePaneProps) {
  const hoverAstId = useCompilerHighlight((s) => s.hoverAstId);
  const selectedAstId = useCompilerHighlight((s) => s.selectedAstId);
  const setHover = useCompilerHighlight((s) => s.setHover);
  const setSelected = useCompilerHighlight((s) => s.setSelected);

  if (!bytecode) {
    return <div className="p-2 font-mono-label text-[11px] text-ink-soft">No bytecode yet.</div>;
  }

  return (
    <div className="h-full overflow-y-auto" data-testid="compiler-bytecode-pane">
      <table className="w-full border-collapse font-mono-label text-[11px]">
        <tbody>
          {bytecode.instructions.map((instr) => {
            const isSelected = instr.astId === selectedAstId;
            const isHovered = instr.astId === hoverAstId;
            const isCurrent = instr.pc === currentPc;
            return (
              <tr
                key={instr.pc}
                className={cn(
                  "cursor-pointer border-b border-rule",
                  isSelected && "bg-[color-mix(in_srgb,var(--color-signal)_16%,transparent)]",
                  isHovered && !isSelected && "bg-[color-mix(in_srgb,var(--color-signal)_8%,transparent)]",
                )}
                onMouseEnter={() => setHover(instr.astId)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setSelected(instr.astId)}
              >
                <td className="w-6 select-none pl-1 text-signal">{isCurrent ? "▸" : ""}</td>
                <td className="px-2 py-0.5 text-right tabular-nums text-ink-soft">{instr.pc}</td>
                <td className="px-2 py-0.5 text-left font-medium text-ink">{instr.opcode}</td>
                <td className="px-2 py-0.5 text-right tabular-nums text-ink-soft">
                  {instr.operands.join(", ")}
                </td>
                <td className="px-2 py-0.5 text-left text-ink-soft">{instr.comment}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
