import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayerStore } from "@/lib/player";
import { loadFixture } from "@/lib/player/testHelpers";
import { useTutorStore } from "./store";

function sseResponse(events: Array<Record<string, unknown>>): Response {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

beforeEach(() => {
  const { trace, source } = loadFixture("binary_search");
  act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "binary_search" }));
  act(() => useTutorStore.setState({ messages: [], composerText: "", contextChips: [], streaming: false }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useTutorStore.ask", () => {
  it("streams chunks into the assistant message and finishes with real step chips", async () => {
    const realStep = usePlayerStore.getState().trace!.steps[3]!.i;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          { type: "chunk", text: "mid landed " },
          { type: "chunk", text: "on `4`" },
          { type: "done", step_refs: [realStep], degraded: false, tokens_used: 123 },
        ]),
      ),
    );

    await act(async () => {
      await useTutorStore.getState().ask("why does mid keep landing on 4");
    });

    const messages = useTutorStore.getState().messages;
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "user", content: "why does mid keep landing on 4" });
    expect(messages[1]).toMatchObject({
      role: "assistant",
      content: "mid landed on `4`",
      stepRefs: [realStep],
      degraded: false,
      pending: false,
    });
    expect(useTutorStore.getState().streaming).toBe(false);
  });

  it("degrades to a quiet unavailable message instead of throwing with no key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await act(async () => {
      await useTutorStore.getState().ask("why?");
    });

    const assistant = useTutorStore.getState().messages[1]!;
    expect(assistant.degraded).toBe(true);
    expect(assistant.content).toMatch(/api key/i);
  });

  it("clears the composer and attaches context chips into the outgoing question", async () => {
    let capturedBody: string | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        capturedBody = init.body as string;
        return Promise.resolve(sseResponse([{ type: "done", step_refs: [], degraded: false, tokens_used: null }]));
      }),
    );

    act(() => {
      useTutorStore.getState().addContextChip({ id: "c1", label: "lines 1-3", code: "lo, hi = 0, 9" });
      useTutorStore.getState().setComposerText("what does this do?");
    });

    await act(async () => {
      await useTutorStore.getState().ask();
    });

    expect(useTutorStore.getState().composerText).toBe("");
    expect(useTutorStore.getState().contextChips).toEqual([]);
    expect(JSON.parse(capturedBody!).question).toContain("lo, hi = 0, 9");
  });
});
