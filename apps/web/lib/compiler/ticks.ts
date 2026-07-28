import type { TickCategory, TickInfo } from "@/lib/player/ticks";
import { CHANNEL_COUNT } from "@/lib/player/channels";
import type { BytecodeChunk, OpCode, VmStep } from "./types";

/**
 * One channel per global/local name, in the order the compiler's constant
 * pool first names them — the same "one stable color per identifier"
 * convention `lib/player/channels.ts` establishes for the main product,
 * reimplemented here rather than imported because it operates on a
 * `Trace`'s frame locals, not this VM's flat name table.
 */
export function buildCompilerChannels(chunk: BytecodeChunk): Map<string, number> {
  const channels = new Map<string, number>();
  chunk.names.forEach((name, i) => channels.set(name, (i % CHANNEL_COUNT) + 1));
  return channels;
}

const WRITE_OPS: ReadonlySet<OpCode> = new Set(["SET_GLOBAL", "SET_LOCAL", "DEFINE_GLOBAL"]);
const COMPARISON_OPS: ReadonlySet<OpCode> = new Set([
  "EQUAL",
  "NOT_EQUAL",
  "GREATER",
  "GREATER_EQUAL",
  "LESS",
  "LESS_EQUAL",
]);
const CONTROL_OPS: ReadonlySet<OpCode> = new Set(["JUMP", "JUMP_IF_FALSE", "LOOP"]);

function categoryFor(opcode: OpCode): TickCategory {
  if (opcode === "PRINT") return "stdout";
  if (opcode === "HALT") return "return";
  if (CONTROL_OPS.has(opcode)) return "call";
  if (COMPARISON_OPS.has(opcode)) return "comparison";
  if (WRITE_OPS.has(opcode)) return "assignment";
  return "comparison";
}

/**
 * Adapts VM steps into the ribbon's `TickInfo[]` transport (docs/PRD.md
 * §7: "reuse the player and the ribbon... adapting VM steps into the same
 * transport interface"). `depth` is always 0 — this VM has no call
 * frames, so the ribbon renders flat rather than a recursion "mountain
 * range," which is correct for what it's tracing.
 */
export function computeVmTicks(
  steps: readonly VmStep[],
  chunk: BytecodeChunk,
  channels: ReadonlyMap<string, number>,
): TickInfo[] {
  const instructionsByPc = new Map(chunk.instructions.map((instr) => [instr.pc, instr]));

  return steps.map((step) => {
    const category = categoryFor(step.opcode);
    if (category !== "assignment") return { category, depth: 0 };

    const instruction = instructionsByPc.get(step.pc);
    // Only the GLOBAL variants' operand indexes `names[]` — SET_LOCAL's
    // operand is a bare stack slot with no name preserved in this JSON, so
    // a local write ticks in the ribbon's neutral fallback color rather
    // than a fabricated one.
    if (instruction?.opcode !== "SET_GLOBAL" && instruction?.opcode !== "DEFINE_GLOBAL") {
      return { category, depth: 0 };
    }
    const nameIndex = instruction.operands[0];
    const name = nameIndex !== undefined ? chunk.names[nameIndex] : undefined;
    const channel = name !== undefined ? channels.get(name) : undefined;
    return { category, channel, depth: 0 };
  });
}
