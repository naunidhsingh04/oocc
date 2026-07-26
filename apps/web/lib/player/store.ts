import type { Analysis, Trace, VizPlan } from "@oocc/contracts";
import { create } from "zustand";
import { buildChannelAssignment, type ChannelAssignment } from "./channels";
import { getStateAt } from "./getStateAt";
import { computeLoopBrackets, type LoopBracket } from "./loops";
import { computeStepTicks, type TickInfo } from "./ticks";
import { SPEED_STEPS, type LoopScope } from "./types";

export interface PlayerState {
  trace: Trace | null;
  sourceCode: string;
  fixtureName: string | null;
  /** viz_planner's panel plan (PRD §4.3) — null until a run/fixture provides one; the layout engine falls back to a minimal default plan when null (see components/workspace/panelRegistry.ts). */
  plan: VizPlan | null;
  /** structure_detector + insight_scanner + complexity_analyst output — null until a run/fixture provides one. */
  analysis: Analysis | null;

  currentStep: number;
  playing: boolean;
  speed: number;
  breakpoints: ReadonlySet<number>;
  loopScope: LoopScope | null;

  /** Computed once per `loadTrace` — docs/PRD.md §6.3: bin once, never per frame. */
  channels: ChannelAssignment;
  loopBrackets: LoopBracket[];
  ticks: TickInfo[];

  loadTrace: (params: {
    trace: Trace;
    source: string;
    name: string;
    plan?: VizPlan | null;
    analysis?: Analysis | null;
  }) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  jumpBy: (delta: number) => void;
  jumpTo: (index: number) => void;
  jumpToStart: () => void;
  jumpToEnd: () => void;
  setSpeed: (speed: number) => void;
  cycleSpeed: (direction: 1 | -1) => void;
  toggleBreakpoint: (line: number) => void;
  setLoopScope: (scope: LoopScope | null) => void;
  /** Advances up to `n` steps, honoring loop scope, breakpoints, and end-of-trace. Called by the rAF driver only. */
  advanceBy: (n: number) => void;
}

function clamp(i: number, max: number): number {
  if (max < 0) return 0;
  return Math.min(Math.max(i, 0), max);
}

export const usePlayerStore = create<PlayerState>()((set, get) => ({
  trace: null,
  sourceCode: "",
  fixtureName: null,
  plan: null,
  analysis: null,

  currentStep: 0,
  playing: false,
  speed: 1,
  breakpoints: new Set<number>(),
  loopScope: null,

  channels: new Map(),
  loopBrackets: [],
  ticks: [],

  loadTrace: ({ trace, source, name, plan = null, analysis = null }) => {
    const channels = buildChannelAssignment(trace);
    set({
      trace,
      sourceCode: source,
      fixtureName: name,
      plan,
      analysis,
      currentStep: 0,
      playing: false,
      breakpoints: new Set<number>(),
      loopScope: null,
      channels,
      loopBrackets: computeLoopBrackets(trace),
      ticks: computeStepTicks(trace, channels),
    });
  },

  play: () => {
    if (!get().trace) return;
    set({ playing: true });
  },
  pause: () => set({ playing: false }),
  togglePlay: () => {
    if (!get().trace) return;
    set((state) => ({ playing: !state.playing }));
  },

  stepForward: () => get().jumpBy(1),
  stepBackward: () => get().jumpBy(-1),

  jumpBy: (delta) => {
    const { trace, currentStep } = get();
    if (!trace) return;
    set({ currentStep: clamp(currentStep + delta, trace.steps.length - 1), playing: false });
  },

  jumpTo: (index) => {
    const { trace } = get();
    if (!trace) return;
    set({ currentStep: clamp(index, trace.steps.length - 1), playing: false });
  },

  jumpToStart: () => get().jumpTo(0),
  jumpToEnd: () => {
    const { trace } = get();
    if (!trace) return;
    get().jumpTo(trace.steps.length - 1);
  },

  setSpeed: (speed) => set({ speed }),
  cycleSpeed: (direction) => {
    const { speed } = get();
    const currentIndex = SPEED_STEPS.findIndex((s) => s === speed);
    const baseIndex = currentIndex === -1 ? SPEED_STEPS.findIndex((s) => s >= speed) : currentIndex;
    const nextIndex = clamp((baseIndex === -1 ? 0 : baseIndex) + direction, SPEED_STEPS.length - 1);
    set({ speed: SPEED_STEPS[nextIndex]! });
  },

  toggleBreakpoint: (line) => {
    set((state) => {
      const next = new Set(state.breakpoints);
      if (next.has(line)) {
        next.delete(line);
      } else {
        next.add(line);
      }
      return { breakpoints: next };
    });
  },

  setLoopScope: (scope) => set({ loopScope: scope }),

  advanceBy: (n) => {
    set((state) => {
      const { trace } = state;
      if (!trace || n <= 0) return state;
      const lastIndex = trace.steps.length - 1;
      let i = state.currentStep;
      let stillPlaying = true;

      for (let step = 0; step < n && stillPlaying; step += 1) {
        let next: number;
        if (state.loopScope && i >= state.loopScope.end) {
          next = state.loopScope.start;
        } else {
          next = i + 1;
        }
        if (next > lastIndex) {
          next = lastIndex;
          stillPlaying = false;
        }
        i = next;
        const line = getStateAt(trace, i)?.line;
        if (line !== undefined && state.breakpoints.has(line)) {
          stillPlaying = false;
        }
      }

      return { currentStep: i, playing: stillPlaying };
    });
  },
}));

/** The single seam every panel reads through — never index `trace.steps` directly. */
export function useStepAt(index: number) {
  return usePlayerStore((state) => getStateAt(state.trace, index));
}

export function useCurrentStepView() {
  return usePlayerStore((state) => getStateAt(state.trace, state.currentStep));
}
