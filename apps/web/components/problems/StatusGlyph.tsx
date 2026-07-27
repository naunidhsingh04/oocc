import type { ProblemStatus } from "@/lib/problems/types";

const STATUS_GLYPH: Record<ProblemStatus, { symbol: string; className: string; label: string }> = {
  solved: { symbol: "●", className: "text-ok", label: "Solved" },
  attempted: { symbol: "◐", className: "text-warn", label: "Attempted" },
  todo: { symbol: "○", className: "text-ink-soft", label: "Not started" },
};

/** Inline status glyph for the dense problem table — a single mono
 * character, never a new color (reuses the same ok/warn/neutral tokens
 * every severity indicator in the app already uses). */
export function StatusGlyph({ status }: { status: ProblemStatus }) {
  const glyph = STATUS_GLYPH[status];
  return (
    <span className={`font-mono-label text-[13px] ${glyph.className}`} title={glyph.label} aria-label={glyph.label}>
      {glyph.symbol}
    </span>
  );
}
