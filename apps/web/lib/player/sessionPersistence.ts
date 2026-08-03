"use client";

import { fetchFixture, isFixtureName, type FixtureName } from "@/lib/fixtures";
import { useEffect, useRef } from "react";
import { usePlayerStore } from "./store";
import type { LoopScope } from "./types";

/**
 * `/play`'s "fresh start every visit" (docs/PRD.md's own session model):
 * work-in-progress — which fixture is loaded, where playback is scrubbed
 * to, breakpoints, loop scope — survives a refresh or navigating away and
 * back within the same tab, and disappears the moment the tab closes.
 * `sessionStorage` gets this for free (tab-scoped, cleared on close) in a
 * way `localStorage` never would; the API key, theme, and any signed-in
 * session deliberately stay in `localStorage` (see lib/settings/providerKey.ts,
 * lib/theme/ThemeProvider.tsx) since those should persist *across* visits,
 * not just within one.
 *
 * Only `fixtureName` + playback position is persisted, never the trace/
 * analysis/plan themselves — every fixture is a deterministic, byte-stable
 * asset (CLAUDE.md), so refetching it by name on restore reproduces
 * identical results without serializing a multi-MB trace blob (up to 40k
 * steps) into sessionStorage on every step change.
 */
const SESSION_KEY = "oocc.play-session";
const DEFAULT_FIXTURE: FixtureName = "bubble_sort";
const PERSIST_DEBOUNCE_MS = 400;

interface PersistedSession {
  fixtureName: FixtureName;
  currentStep: number;
  breakpoints: number[];
  loopScope: LoopScope | null;
}

function readSession(): PersistedSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    if (!parsed.fixtureName || !isFixtureName(parsed.fixtureName)) return null;
    return {
      fixtureName: parsed.fixtureName,
      currentStep: typeof parsed.currentStep === "number" ? parsed.currentStep : 0,
      breakpoints: Array.isArray(parsed.breakpoints) ? parsed.breakpoints : [],
      loopScope: parsed.loopScope ?? null,
    };
  } catch {
    return null;
  }
}

function writeSession(session: PersistedSession): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage full/disabled (private browsing) — losing session restore
    // isn't worth surfacing an error over.
  }
}

/**
 * Mounted once by `Workspace` (client-only, matching `WorkspaceLoader`'s
 * `ssr: false` boundary — this reads `sessionStorage` only inside effects,
 * never during render, so there's nothing for hydration to mismatch
 * against). On mount: restore the last fixture + playback position from
 * this tab's session, or load the default example if this is a fresh
 * session (a new tab, or the previous one was closed). After that, any
 * change to fixture/step/breakpoints/loop-scope is debounced and written
 * back — debounced because `currentStep` changes up to 60fps during
 * playback/scrubbing, and writing to `sessionStorage` on every one of
 * those frames would be a real perf hit for no benefit (nobody needs the
 * exact mid-scrub frame restored, just roughly where they left off).
 */
export function useSessionPersistence(): void {
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const session = readSession();
    const fixtureName = session?.fixtureName ?? DEFAULT_FIXTURE;

    fetchFixture(fixtureName)
      .then((bundle) => {
        usePlayerStore.getState().loadTrace(bundle);
        if (session) {
          const stepCount = bundle.trace.steps.length;
          usePlayerStore.setState({
            currentStep: Math.min(Math.max(session.currentStep, 0), Math.max(stepCount - 1, 0)),
            breakpoints: new Set(session.breakpoints),
            loopScope: session.loopScope,
          });
        }
      })
      .catch(() => {
        // No local dev server for the fixture asset, or a corrupted
        // session pointing at a since-renamed fixture — leave the
        // workspace in its empty "choose a fixture" state rather than
        // throwing during mount.
      });
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = usePlayerStore.subscribe((state, prevState) => {
      if (
        state.fixtureName === prevState.fixtureName &&
        state.currentStep === prevState.currentStep &&
        state.breakpoints === prevState.breakpoints &&
        state.loopScope === prevState.loopScope
      ) {
        return;
      }
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        const current = usePlayerStore.getState();
        // A trace loaded from somewhere other than the fixture picker
        // (a problem's run, a curriculum article's embedded trace) can
        // carry a `fixtureName` that isn't a restorable `FixtureName` at
        // all (see FixturePicker.tsx's own comment on this) — nothing to
        // persist in that case, next visit just falls back to the default.
        if (!current.fixtureName || !isFixtureName(current.fixtureName)) return;
        writeSession({
          fixtureName: current.fixtureName,
          currentStep: current.currentStep,
          breakpoints: [...current.breakpoints],
          loopScope: current.loopScope,
        });
      }, PERSIST_DEBOUNCE_MS);
    });

    return () => {
      if (timeout) clearTimeout(timeout);
      unsubscribe();
    };
  }, []);
}
