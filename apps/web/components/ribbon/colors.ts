export interface RibbonColors {
  paper: string;
  rule: string;
  inkSoft: string;
  signal: string;
  signalMuted: string;
  mutate: string;
  channels: readonly string[];
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.trim().replace("#", "");
  const full = clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean;
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int) || full.length !== 6) return hex;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Canvas fillStyle can't resolve `var(--color-*)` itself, so this reads the
 * computed value of every token the ribbon needs, once per draw (called
 * only on resize/theme change, never per animation frame).
 */
export function readRibbonColors(element: Element): RibbonColors {
  const style = getComputedStyle(element);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;

  const signal = read("--color-signal", "#1b4de4");

  return {
    paper: read("--color-paper", "#edf0f3"),
    rule: read("--color-rule", "#d2d9e0"),
    inkSoft: read("--color-ink-soft", "#5a6572"),
    signal,
    signalMuted: hexToRgba(signal, 0.4),
    mutate: read("--color-mutate", "#d6006e"),
    channels: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => read(`--color-ch-${n}`, signal)),
  };
}
