import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  posted: unknown[] = [];
  static instances: FakeWorker[] = [];

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(data: unknown) {
    this.posted.push(data);
  }

  terminate() {}

  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe("compiler client", () => {
  const originalWorker = globalThis.Worker;

  beforeEach(() => {
    FakeWorker.instances = [];
    // @ts-expect-error -- test stub, narrower than the real Worker type
    globalThis.Worker = FakeWorker;
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.Worker = originalWorker;
  });

  it("routes progress messages to listeners without touching pending compiles", async () => {
    const { compileInWorker, onCompilerLoadStage } = await import("./client");

    const stages: string[] = [];
    const unsubscribe = onCompilerLoadStage((stage) => stages.push(stage));

    const resultPromise = compileInWorker("let x = 1;");
    const worker = FakeWorker.instances[0]!;

    worker.emit({ type: "progress", stage: "loading-script" });
    worker.emit({ type: "progress", stage: "initializing-wasm" });
    worker.emit({ type: "progress", stage: "ready" });

    expect(stages).toEqual(["loading-script", "initializing-wasm", "ready"]);

    worker.emit({
      id: 0,
      ok: true,
      result: { tokens: [], ast: null, bytecode: null, trace: null, error: null },
      timings: { lex: 0, parse: 0, compile: 0, run: 0 },
    });

    const response = await resultPromise;
    expect(response.timings.lex).toBe(0);
    unsubscribe();
  });

  it("rejects the pending request on a worker failure without affecting progress listeners", async () => {
    const { compileInWorker } = await import("./client");

    const resultPromise = compileInWorker("bad source");
    const worker = FakeWorker.instances[0]!;
    worker.emit({ id: 0, ok: false, error: "boom" });

    await expect(resultPromise).rejects.toThrow("boom");
  });
});
