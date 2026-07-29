import { useEffect, useMemo, useRef, useState } from "react";
import { buildAstIndex, buildInstructionIndex } from "./astIndex";
import { type CompilerLoadStage, compileInWorker, onCompilerLoadStage } from "./client";
import { buildCompilerChannels, computeVmTicks } from "./ticks";
import type { PipelineResult, StageTimings } from "./types";

const DEBOUNCE_MS = 200;

export interface PipelineView {
  source: string;
  setSource: (source: string) => void;
  result: PipelineResult | null;
  timings: StageTimings | null;
  compiling: boolean;
  /** Real WASM-load progress (docs/PRD.md §9), null once the module has
   * loaded once this session — only the very first compile pays this
   * cost, so this never flickers back on for later keystrokes. */
  loadStage: CompilerLoadStage | null;
  astIndex: ReturnType<typeof buildAstIndex> | null;
  instructionIndex: ReturnType<typeof buildInstructionIndex> | null;
  channels: Map<string, number>;
  vmTicks: ReturnType<typeof computeVmTicks>;
}

/**
 * Owns the compiler explorer's source text and recompiles on a 200ms
 * keystroke debounce (docs/PRD.md §7: "recompile on a 200ms keystroke
 * debounce, because the whole point is that editing feels live"),
 * lazy-loading the WASM worker on the very first compile.
 */
export function usePipeline(initialSource: string): PipelineView {
  const [source, setSource] = useState(initialSource);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [timings, setTimings] = useState<StageTimings | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [loadStage, setLoadStage] = useState<CompilerLoadStage | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    return onCompilerLoadStage((stage) => {
      setLoadStage(stage === "ready" ? null : stage);
    });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // `compiling` synchronizes with the debounce timer/worker below, an
    // external system this effect owns end to end — there's no event to
    // subscribe to instead.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompiling(true);
    const seq = ++requestSeq.current;

    debounceRef.current = setTimeout(() => {
      void compileInWorker(source).then((response) => {
        if (requestSeq.current !== seq) return; // a newer keystroke already superseded this
        setResult(response.result);
        setTimings(response.timings);
        setCompiling(false);
      });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [source]);

  const astIndex = useMemo(() => (result?.ast ? buildAstIndex(result.ast) : null), [result]);
  const instructionIndex = useMemo(
    () => (result?.bytecode ? buildInstructionIndex(result.bytecode) : null),
    [result],
  );
  const channels = useMemo(
    () => (result?.bytecode ? buildCompilerChannels(result.bytecode) : new Map<string, number>()),
    [result],
  );
  const vmTicks = useMemo(
    () => (result?.trace && result.bytecode ? computeVmTicks(result.trace, result.bytecode, channels) : []),
    [result, channels],
  );

  return { source, setSource, result, timings, compiling, loadStage, astIndex, instructionIndex, channels, vmTicks };
}
