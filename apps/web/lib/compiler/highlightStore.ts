import { create } from "zustand";

interface HighlightState {
  /** Transient — signal-dim styling. Cleared on pointer-leave. */
  hoverAstId: number | null;
  /** Persistent until changed — full signal styling. Cleared on click-away. */
  selectedAstId: number | null;
  setHover: (astId: number | null) => void;
  setSelected: (astId: number | null) => void;
}

/**
 * One shared target for cross-highlighting across all five compiler-explorer
 * panes (docs/PRD.md §7: "hovering an opcode lights up its AST node, its
 * token range, and the exact source characters, and every other direction
 * works too"). Every pane derives its own highlight purely from `astId`
 * equality against these two fields — none of them talk to each other
 * directly, which is what makes "every other direction works too" free:
 * add a sixth pane and it only needs to read/write astId too.
 */
export const useCompilerHighlight = create<HighlightState>()((set) => ({
  hoverAstId: null,
  selectedAstId: null,
  setHover: (astId) => set({ hoverAstId: astId }),
  setSelected: (astId) => set({ selectedAstId: astId }),
}));
