import { create } from "zustand";
import { validateProviderKey } from "@/lib/api/client";
import {
  clearStoredProviderKey,
  getStoredProviderKey,
  looksLikeAKey,
  setStoredProviderKey,
} from "./providerKey";

export type KeyStatus = "empty" | "checking" | "valid" | "invalid";

export interface SettingsState {
  providerKey: string | null;
  status: KeyStatus;
  error: string | null;
  /** Running total across this browser session (resets on reload) — every
   * validate-key and tutor call reports its own token cost, accumulated
   * here. Never persisted; it's a session number, not a billing record. */
  sessionTokens: number;

  hydrate: () => void;
  setKey: (key: string) => Promise<void>;
  clearKey: () => void;
  addTokens: (count: number | null | undefined) => void;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  providerKey: null,
  status: "empty",
  error: null,
  sessionTokens: 0,

  hydrate: () => {
    const stored = getStoredProviderKey();
    if (stored) {
      set({ providerKey: stored, status: "checking" });
      void get().setKey(stored);
    }
  },

  setKey: async (key: string) => {
    const trimmed = key.trim();
    if (!looksLikeAKey(trimmed)) {
      set({ providerKey: null, status: "invalid", error: "That doesn't look like a key." });
      return;
    }
    set({ status: "checking", error: null });
    const result = await validateProviderKey(trimmed);
    if (result.valid) {
      setStoredProviderKey(trimmed);
      set({ providerKey: trimmed, status: "valid", error: null });
      get().addTokens(result.tokens_used);
    } else {
      set({ status: "invalid", error: result.error ?? "invalid_key" });
    }
  },

  clearKey: () => {
    clearStoredProviderKey();
    set({ providerKey: null, status: "empty", error: null });
  },

  addTokens: (count) => {
    if (typeof count !== "number") return;
    set((state) => ({ sessionTokens: state.sessionTokens + count }));
  },
}));
