import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { usePlayerStore } from "@/lib/player";
import { loadFixture } from "@/lib/player/testHelpers";
import { GraphPanel } from "./GraphPanel";

beforeEach(() => {
  act(() => {
    usePlayerStore.setState({
      trace: null,
      plan: null,
      analysis: null,
      currentStep: 0,
      playing: false,
      breakpoints: new Set(),
      loopScope: null,
      channels: new Map(),
      loopBrackets: [],
      ticks: [],
    });
  });
});

describe("GraphPanel", () => {
  it("renders bfs_graph's nodes without crashing (regression: d3-force mutating link objects)", () => {
    const { trace, source } = loadFixture("bfs_graph");
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "bfs_graph" }));
    act(() => usePlayerStore.getState().jumpTo(30));

    const { getAllByTestId } = render(<GraphPanel />);
    const nodes = getAllByTestId(/graph-node-/);
    expect(nodes.length).toBeGreaterThan(0);
  });

  it("marks visited nodes cumulatively as playback advances", () => {
    const { trace, source } = loadFixture("bfs_graph");
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "bfs_graph" }));
    act(() => usePlayerStore.getState().jumpTo(trace.steps.length - 1));

    const { getAllByTestId } = render(<GraphPanel />);
    const visited = getAllByTestId(/graph-node-/).filter((el) => el.dataset.visited === "true");
    expect(visited.length).toBeGreaterThan(0);
  });
});
