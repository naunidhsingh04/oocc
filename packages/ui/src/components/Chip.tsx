import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type ChipChannel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type ChipTone = "neutral" | "signal" | "mutate" | "ok" | "warn";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** Binds to a trace channel color (1-8) instead of a semantic tone. */
  channel?: ChipChannel;
  tone?: ChipTone;
}

const toneClasses: Record<ChipTone, string> = {
  neutral: "border-rule text-ink-soft",
  signal: "border-signal text-signal",
  mutate: "border-mutate text-mutate",
  ok: "border-ok text-ok",
  warn: "border-warn text-warn",
};

export function Chip({ className, channel, tone = "neutral", style, children, ...props }: ChipProps) {
  const channelStyle: CSSProperties | undefined = channel
    ? { borderColor: `var(--color-ch-${channel})`, color: `var(--color-ch-${channel})`, ...style }
    : style;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-control border px-1.5 py-0.5 font-mono-label text-[11px]",
        !channel && toneClasses[tone],
        className,
      )}
      style={channelStyle}
      {...props}
    >
      {channel ? (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: `var(--color-ch-${channel})` }}
        />
      ) : null}
      {children}
    </span>
  );
}
