"use client";

import { getStateAt, usePlayerStore } from "@/lib/player";
import { computeArrayView, findBindingName, findPrimaryArrayBinding } from "@/lib/panels/arrayDetection";
import { Chip, EmptyState, Panel, Tabs, TabsList, TabsTrigger } from "@oocc/ui";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { VizPanelProps } from "./types";

type ArrayViewMode = "bars" | "cells";
type ArrayViewData = NonNullable<ReturnType<typeof computeArrayView>>;

/** One stable id per array position — swapped (not regenerated) when a
 * swap is detected, so `ArrayView` can key its cells by identity and let
 * `layout` animate the actual cross-row movement instead of redrawing two
 * cells in place. Regenerated wholesale only when the array's own length
 * changes (a genuinely different array, not a swap within one). */
function freshSlotKeys(length: number): string[] {
  return Array.from({ length }, (_, i) => `slot-${i}`);
}

/**
 * The first real panel (docs/PRD.md §4.3): bars/cells modes, a plain-
 * English caption for the current step, distinct treatments for a
 * "comparing" pair vs. a "swapping" pair (with the swap animating as real
 * movement, not an instant redraw), and a brief accent flash + old→new
 * value trail on any element `changed` touched this step. Everything here
 * reads from `changed`/pointers/frame locals generically — nothing knows
 * what quicksort or bubble sort is (see lib/panels/arrayDetection.ts).
 */
export function ArrayPanel({ panel }: VizPanelProps) {
  const [mode, setMode] = useState<ArrayViewMode>("bars");
  const trace = usePlayerStore((state) => state.trace);
  const channels = usePlayerStore((state) => state.channels);
  const currentStep = usePlayerStore((state) => state.currentStep);
  const step = usePlayerStore((state) => getStateAt(state.trace, state.currentStep));
  const prevStep = usePlayerStore((state) => getStateAt(state.trace, Math.max(0, state.currentStep - 1)));

  const autoBinding = useMemo(() => (trace ? findPrimaryArrayBinding(trace) : undefined), [trace]);
  const binding = panel?.binding ?? autoBinding;
  const view = useMemo(() => computeArrayView(step, binding, channels), [step, binding, channels]);
  const prevView = useMemo(
    () => (currentStep > 0 ? computeArrayView(prevStep, binding, channels) : null),
    [prevStep, binding, channels, currentStep],
  );
  const arrayName = useMemo(() => findBindingName(step, binding), [step, binding]);

  // Swap detection is a pure function of `view`/`prevView` — both already
  // derived straight from props via `getStateAt`, needing no state or ref
  // of their own. A real, found-live bug in an earlier version tried to
  // track "the previous step's values" with a piece of state committed
  // mid-render (the same during-render `setState` pattern
  // `usePlayback.ts`'s `prevSteps` uses elsewhere) — but that pattern is
  // only sound for a comparison whose *result* doesn't itself depend on
  // "is this the first render to observe the transition." React
  // re-invokes a component's render body immediately after a mid-render
  // `setState`, before ever committing or painting, and on that second
  // pass the tracked "previous step" had *already* been advanced to the
  // current one by the first pass's own update — so the detection's guard
  // condition was false on exactly the pass that actually committed, and
  // every real swap silently fell through to the generic "N elements
  // changed" caption. Confirmed live via a temporary debug log: the
  // correct swap values were present on the discarded first pass and
  // absent on the committed second pass. `prevView` sidesteps the whole
  // problem — it's recomputed identically no matter how many times render
  // runs for a given commit, so there's nothing to race.
  const swapPair = useMemo<[number, number] | null>(() => {
    if (!view || !prevView || view.changedIndices.size !== 2) return null;
    const [a, b] = [...view.changedIndices] as [number, number];
    if (prevView.values[a] === view.values[b] && prevView.values[b] === view.values[a]) {
      return [a, b];
    }
    return null;
  }, [view, prevView]);

  // Slot identity *does* need to persist and accumulate across many steps
  // (each swap exchanges two ids in place, building on the last swap's
  // result), so it stays as committed state — but the "should I apply an
  // exchange this render" gate now reads `swapPair` above, which is stable
  // across re-invocations of this same commit (unlike the old, self-
  // defeating version), so gating its application by "step changed since
  // last commit" is safe here in a way it wasn't for detection itself.
  const [slotKeys, setSlotKeys] = useState<{ step: number; keys: string[] }>({ step: -1, keys: [] });
  let nextSlotKeys = slotKeys.keys;
  if (view) {
    if (nextSlotKeys.length !== view.values.length) {
      nextSlotKeys = freshSlotKeys(view.values.length);
    } else if (swapPair && slotKeys.step !== currentStep) {
      const [a, b] = swapPair;
      nextSlotKeys = nextSlotKeys.slice();
      [nextSlotKeys[a], nextSlotKeys[b]] = [nextSlotKeys[b]!, nextSlotKeys[a]!];
    }
    if (slotKeys.step !== currentStep || nextSlotKeys !== slotKeys.keys) {
      setSlotKeys({ step: currentStep, keys: nextSlotKeys });
    }
  }

  const comparing =
    view && view.pointers.length === 2 && view.pointers[0]!.index !== view.pointers[1]!.index
      ? ([view.pointers[0]!.index, view.pointers[1]!.index] as [number, number])
      : null;
  // A pointer pair mid-comparison reads as "comparing" only if this exact
  // step didn't also change those two cells — once it does, it's the swap.
  const isComparingStep = comparing && !swapPair && !view!.changedIndices.has(comparing[0]) && !view!.changedIndices.has(comparing[1]);

  const caption = describeStep({
    arrayName,
    swapPair,
    comparingPair: isComparingStep ? comparing : null,
    changedIndices: view?.changedIndices ?? new Set(),
    values: view?.values ?? [],
  });

  return (
    <Tabs
      value={mode}
      onValueChange={(value) => setMode(value as ArrayViewMode)}
      className="flex h-full flex-col"
    >
      {/* The Bars/Cells toggle used to live in Panel's `actions` slot (the
          title bar's own right edge) — PanelFrame's floating retype/
          maximize/remove controls are absolutely positioned over that
          same top-right corner (see PanelFrame.tsx), so the two collided
          at every width, not just narrow ones (found via a live
          screenshot, not just code review). A second row below the title
          bar has no such collision. */}
      <Panel title="Array" className="min-h-0 flex-1" bodyClassName="flex flex-col gap-2 p-4">
        <TabsList className="shrink-0 gap-2">
          <TabsTrigger value="bars">Bars</TabsTrigger>
          <TabsTrigger value="cells">Cells</TabsTrigger>
        </TabsList>
        {view ? (
          <>
            <p className="min-h-4.5 font-body text-[13px] text-ink-soft" data-testid="array-step-caption">
              {caption}
            </p>
            <ArrayView
              view={view}
              prevView={prevView}
              mode={mode}
              slotKeys={nextSlotKeys}
              swapPair={swapPair}
              comparingPair={isComparingStep ? comparing : null}
            />
          </>
        ) : (
          <EmptyState title="No array in this trace" description="This fixture has no primitive list to visualize." />
        )}
      </Panel>
    </Tabs>
  );
}

function describeStep({
  arrayName,
  swapPair,
  comparingPair,
  changedIndices,
  values,
}: {
  arrayName: string | undefined;
  swapPair: [number, number] | null;
  comparingPair: [number, number] | null;
  changedIndices: ReadonlySet<number>;
  values: Array<string | number>;
}): string {
  const name = arrayName ?? "the array";
  if (swapPair) {
    const [a, b] = swapPair;
    return `Swapping ${name}[${a}] and ${name}[${b}]`;
  }
  if (comparingPair) {
    const [a, b] = comparingPair;
    return `Comparing ${name}[${a}] and ${name}[${b}]`;
  }
  if (changedIndices.size === 1) {
    const [index] = [...changedIndices] as [number];
    return `${name}[${index}] changed to ${values[index]}`;
  }
  if (changedIndices.size > 1) {
    return `${changedIndices.size} elements of ${name} changed`;
  }
  return `No change to ${name} this step`;
}

function ArrayView({
  view,
  prevView,
  mode,
  slotKeys,
  swapPair,
  comparingPair,
}: {
  view: ArrayViewData;
  prevView: ArrayViewData | null;
  mode: ArrayViewMode;
  slotKeys: string[];
  swapPair: [number, number] | null;
  comparingPair: [number, number] | null;
}) {
  const reduceMotion = useReducedMotion();
  const numericValues = view.values.map((v) => (typeof v === "number" ? v : 0));
  const maxValue = Math.max(1, ...numericValues.map((v) => Math.abs(v)));
  const windowFrom = view.window ? Math.min(view.window.fromIndex, view.window.toIndex) : -1;
  const windowTo = view.window ? Math.max(view.window.fromIndex, view.window.toIndex) : -1;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* pt-6 (24px), not the container's own p-4 padding alone (16px) —
          the fading old-value trail below sits at -top-5 (20px) above each
          bar/cell, which the panel's existing padding didn't fully cover,
          letting it clip against the panel edge on the first row's tallest
          bars. Found by checking the actual offset math, not by eyeballing
          a screenshot. */}
      <div className="relative flex flex-1 items-end gap-1 pt-6" data-testid="array-cells">
        {view.values.map((value, index) => {
          const changed = view.changedIndices.has(index);
          const isSwapping = swapPair !== null && (index === swapPair[0] || index === swapPair[1]);
          const isComparing = comparingPair !== null && (index === comparingPair[0] || index === comparingPair[1]);
          const inWindow = index >= windowFrom && index <= windowTo;
          const prevValue = prevView?.values[index];
          const showPrevValue = changed && prevValue !== undefined && prevValue !== value;

          return (
            <motion.div
              key={slotKeys[index] ?? index}
              layout={reduceMotion ? false : "position"}
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
              className="relative flex flex-1 flex-col items-center justify-end"
              style={{
                backgroundColor: inWindow ? "color-mix(in srgb, var(--color-signal) 8%, transparent)" : undefined,
              }}
            >
              {showPrevValue ? (
                <motion.span
                  key={`prev-${index}-${prevValue}`}
                  initial={{ opacity: 0.9, y: 0 }}
                  animate={{ opacity: 0, y: -10 }}
                  transition={{ duration: reduceMotion ? 0.01 : 0.6, ease: "easeOut" }}
                  className="absolute -top-5 font-mono-label text-[11px] text-ink-soft line-through"
                >
                  {prevValue}
                </motion.span>
              ) : null}
              {mode === "bars" ? (
                <motion.div
                  data-testid={`array-bar-${index}`}
                  data-changed={changed}
                  data-comparing={isComparing}
                  data-swapping={isSwapping}
                  // No `layout` prop here: this bar's height is already
                  // explicitly driven by `animate` below. Adding automatic
                  // `layout` FLIP tracking on top of an explicitly animated
                  // size property was a real bug — the two animation
                  // systems raced on every single step (nearly every step
                  // changes a bar's height), which is exactly the kind of
                  // stutter/half-rendered symptom this class of mistake
                  // produces. The *outer* slot wrapper still uses
                  // `layout="position"` for the swap's horizontal move,
                  // which is legitimate: that motion comes from DOM
                  // reordering (the slot-key exchange), not from an
                  // explicit `animate` on that element.
                  className="w-full rounded-t-control"
                  animate={{
                    height: `${(Math.abs(typeof value === "number" ? value : 1) / maxValue) * 100}%`,
                    backgroundColor: isSwapping
                      ? "var(--color-signal)"
                      : changed
                        ? "var(--color-mutate)"
                        : "var(--color-ink-soft)",
                  }}
                  transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: "easeOut" }}
                  style={{
                    minHeight: "4px",
                    outline: isComparing ? "2px solid var(--color-signal)" : undefined,
                    outlineOffset: isComparing ? "2px" : undefined,
                  }}
                />
              ) : (
                <motion.div
                  data-testid={`array-cell-${index}`}
                  data-changed={changed}
                  data-comparing={isComparing}
                  data-swapping={isSwapping}
                  className="flex h-9 w-full items-center justify-center border font-mono-label text-[12px]"
                  animate={{
                    backgroundColor: isSwapping
                      ? "var(--color-signal)"
                      : changed
                        ? "var(--color-mutate)"
                        : "var(--color-panel)",
                    color: isSwapping || changed ? "#fff" : "var(--color-ink)",
                  }}
                  transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: "easeOut" }}
                  style={{
                    borderWidth: isComparing ? "2px" : "1px",
                    borderColor: isComparing ? "var(--color-signal)" : "var(--color-rule)",
                  }}
                >
                  {String(value)}
                </motion.div>
              )}
              {/* A ~400ms accent flash on the cell that just changed — a
                  fresh mount per (index, step) via AnimatePresence/key,
                  since Framer only plays enter animations on mount, which
                  is what makes this replay exactly once per real change
                  rather than looping or replaying on unrelated re-renders. */}
              <AnimatePresence>
                {changed ? (
                  <motion.span
                    key={`flash-${index}-${value}`}
                    aria-hidden
                    initial={{ opacity: reduceMotion ? 0 : 0.55 }}
                    animate={{ opacity: 0 }}
                    // Without an explicit `exit`, AnimatePresence has
                    // nothing to animate toward on unmount and removes the
                    // span immediately — invisible at the default 2
                    // steps/sec (it's already faded by the time the next
                    // step swaps it out), but a real, visible hard cutoff
                    // at higher playback speeds where the next step lands
                    // before this 400ms fade finishes.
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0.01 : 0.4, ease: "easeOut" }}
                    className="pointer-events-none absolute inset-0 rounded-t-control bg-signal"
                  />
                ) : null}
              </AnimatePresence>
              <span className="mt-1 font-mono-label text-[10px] text-ink-soft">{index}</span>
              <PointerMarks pointers={view.pointers} index={index} />
            </motion.div>
          );
        })}
      </div>
      {view.pointers.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-rule pt-2">
          {view.pointers.map((pointer) => (
            <Chip key={pointer.name} channel={pointer.channel as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}>
              {pointer.name} = {pointer.index}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PointerMarks({
  pointers,
  index,
}: {
  pointers: { name: string; index: number; channel: number }[];
  index: number;
}) {
  const here = pointers.filter((p) => p.index === index);
  if (here.length === 0) return null;
  return (
    <div className="mt-0.5 flex gap-0.5">
      {here.map((pointer) => (
        <span
          key={pointer.name}
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: `var(--color-ch-${pointer.channel})` }}
          title={pointer.name}
        />
      ))}
    </div>
  );
}
