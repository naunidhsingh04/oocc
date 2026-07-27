import { create } from "zustand";
import { streamTutorAnswer } from "@/lib/api/client";
import type { TutorTurn } from "@/lib/api/types";
import { usePlayerStore } from "@/lib/player";
import { useSettingsStore } from "@/lib/settings/store";

export interface TutorMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  stepRefs: number[];
  degraded: boolean;
  pending: boolean;
}

export interface ContextChip {
  id: string;
  label: string;
  code: string;
}

export interface PendingSelection {
  label: string;
  code: string;
}

export interface TutorState {
  collapsed: boolean;
  height: number;
  messages: TutorMessage[];
  composerText: string;
  contextChips: ContextChip[];
  streaming: boolean;
  /** The editor's current text selection, live-updated — not yet a chip
   * until the user explicitly attaches it (docs/PRD.md Phase 3 frontend
   * spec item 2: "selecting code ... attaches it as a context chip"). A
   * one-click "attach" affordance, not auto-attach-on-select, so merely
   * clicking around the editor doesn't spam the composer with chips. */
  pendingSelection: PendingSelection | null;

  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setHeight: (height: number) => void;
  setComposerText: (text: string) => void;
  addContextChip: (chip: ContextChip) => void;
  removeContextChip: (id: string) => void;
  setPendingSelection: (selection: PendingSelection | null) => void;
  attachPendingSelection: () => void;
  clearForNewRun: () => void;
  ask: (question?: string) => Promise<void>;
}

let nextMessageId = 1;
let nextChipId = 1;

export function makeContextChipId(): string {
  return `chip${nextChipId++}`;
}

/**
 * The tutor's own state — deliberately separate from `usePlayerStore`
 * (playback) even though `ask` reads/writes across both: the transcript,
 * composer, and streaming status are workspace-panel concerns, not
 * trace-playback ones, and keeping them apart is what lets the tutor
 * panel collapse/reset independently of the trace itself.
 */
export const useTutorStore = create<TutorState>()((set, get) => ({
  collapsed: false,
  height: 260,
  messages: [],
  composerText: "",
  contextChips: [],
  streaming: false,
  pendingSelection: null,

  toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
  setCollapsed: (collapsed) => set({ collapsed }),
  setHeight: (height) => set({ height: Math.max(140, Math.min(640, height)) }),
  setComposerText: (text) => set({ composerText: text }),
  addContextChip: (chip) => set((state) => ({ contextChips: [...state.contextChips, chip] })),
  removeContextChip: (id) =>
    set((state) => ({ contextChips: state.contextChips.filter((chip) => chip.id !== id) })),
  setPendingSelection: (selection) => set({ pendingSelection: selection }),
  attachPendingSelection: () => {
    const selection = get().pendingSelection;
    if (!selection) return;
    set((state) => ({
      contextChips: [...state.contextChips, { id: makeContextChipId(), ...selection }],
      pendingSelection: null,
    }));
  },
  clearForNewRun: () =>
    set({ messages: [], composerText: "", contextChips: [], streaming: false, pendingSelection: null }),

  ask: async (question) => {
    const text = (question ?? get().composerText).trim();
    if (!text || get().streaming) return;

    const { trace, sourceCode, currentStep } = usePlayerStore.getState();
    if (!trace) return;
    const providerKey = useSettingsStore.getState().providerKey;

    const chips = get().contextChips;
    const composedQuestion =
      chips.length > 0
        ? `${text}\n\nSelected code the user attached as context:\n${chips
            .map((chip) => `${chip.label}:\n${chip.code}`)
            .join("\n---\n")}`
        : text;

    const history: TutorTurn[] = get().messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const userMessageId = `m${nextMessageId++}`;
    const assistantMessageId = `m${nextMessageId++}`;
    set((state) => ({
      messages: [
        ...state.messages,
        { id: userMessageId, role: "user", content: text, stepRefs: [], degraded: false, pending: false },
        { id: assistantMessageId, role: "assistant", content: "", stepRefs: [], degraded: false, pending: true },
      ],
      composerText: "",
      contextChips: [],
      streaming: true,
    }));

    function updateAssistant(patch: Partial<TutorMessage>) {
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === assistantMessageId ? { ...message, ...patch } : message,
        ),
      }));
    }

    for await (const event of streamTutorAnswer({
      trace,
      source: sourceCode,
      currentStep,
      question: composedQuestion,
      history,
      providerKey,
    })) {
      if (event.type === "unavailable") {
        updateAssistant({
          content: "Add a Gemini API key in settings to ask the tutor — every other surface still works without one.",
          pending: false,
          degraded: true,
        });
        set({ streaming: false });
        return;
      }
      if (event.type === "chunk") {
        set((state) => ({
          messages: state.messages.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: message.content + event.text }
              : message,
          ),
        }));
      }
      if (event.type === "done") {
        useSettingsStore.getState().addTokens(event.tokens_used);
        updateAssistant({ stepRefs: event.step_refs, degraded: event.degraded, pending: false });
        set({ streaming: false });
      }
    }
  },
}));
