import { useSyncExternalStore } from "react";

/**
 * docs/PRD.md §9: "Down to 375px the workspace collapses to a tabbed
 * single column." `useSyncExternalStore` (not a `useState`+`useEffect`
 * pair) so the initial client render already matches the real viewport
 * instead of flashing the desktop layout for one frame before a resize
 * listener fires.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
