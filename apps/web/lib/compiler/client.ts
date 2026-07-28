import type { PipelineResult, StageTimings } from "./types";

export interface CompileResponse {
  result: PipelineResult;
  timings: StageTimings;
}

interface PendingRequest {
  resolve: (value: CompileResponse) => void;
  reject: (reason: unknown) => void;
}

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, PendingRequest>();

/** Created on first `compile()` call, not at module load — "lazy-load the WASM module in a worker" per the brief. */
function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker("/compiler/compilerWorker.js");
  worker.onmessage = (event: MessageEvent) => {
    const { id, ok, result, timings, error } = event.data as {
      id: number;
      ok: boolean;
      result?: PipelineResult;
      timings?: StageTimings;
      error?: string;
    };
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    if (ok && result && timings) {
      request.resolve({ result, timings });
    } else {
      request.reject(new Error(error ?? "compiler worker failed"));
    }
  };
  return worker;
}

/**
 * Compiles `source` in the worker and resolves with the pipeline result
 * plus approximate per-stage timings. Never throws for a program error
 * (lex/parse/runtime failures come back as a normal `PipelineResult` with
 * an `error` field) — only rejects if the worker itself fails to load or
 * crashes.
 */
export function compileInWorker(source: string): Promise<CompileResponse> {
  const id = nextId++;
  const instance = getWorker();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    instance.postMessage({ id, source });
  });
}

/** Test-only escape hatch: forces a fresh worker on the next call. */
export function _resetCompilerWorkerForTests(): void {
  worker?.terminate();
  worker = null;
  pending.clear();
}
