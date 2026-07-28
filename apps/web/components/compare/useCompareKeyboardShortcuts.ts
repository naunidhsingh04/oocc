import { useEffect } from "react";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export interface CompareKeyboardActions {
  stepBy: (delta: number) => void;
  togglePlay: () => void;
  cycleSpeed: (direction: 1 | -1) => void;
  scrubA: (pos: number) => void;
  lastIndexA: number;
}

/**
 * Same shortcut set as the main workspace's `useKeyboardShortcuts`
 * (docs/PRD.md §6.3/§9's keyboard-operable-end-to-end quality floor):
 * arrows step both playheads, space plays/pauses, `,`/`.` change speed,
 * Home/End jump both to their ends. Takes each action individually (rather
 * than one options object) so the effect's dependency array can list them
 * precisely — `useComparePlayback`'s actions are `useCallback`-stable
 * unless their own inputs change, so this only re-binds the listener when
 * something real changed, and never reads a stale closure over one that
 * did.
 */
export function useCompareKeyboardShortcuts({
  stepBy,
  togglePlay,
  cycleSpeed,
  scrubA,
  lastIndexA,
}: CompareKeyboardActions): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          stepBy(event.shiftKey ? 10 : 1);
          break;
        case "ArrowLeft":
          event.preventDefault();
          stepBy(event.shiftKey ? -10 : -1);
          break;
        case " ":
          event.preventDefault();
          togglePlay();
          break;
        case ",":
          cycleSpeed(-1);
          break;
        case ".":
          cycleSpeed(1);
          break;
        case "Home":
          event.preventDefault();
          scrubA(0);
          break;
        case "End":
          event.preventDefault();
          scrubA(lastIndexA);
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stepBy, togglePlay, cycleSpeed, scrubA, lastIndexA]);
}
