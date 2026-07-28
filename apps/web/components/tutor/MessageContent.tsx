"use client";

import type { ChannelAssignment } from "@/lib/player";
import { Fragment } from "react";

const BACKTICK_SPAN_SOURCE = /`([^`]+)`/g;

/**
 * Renders a tutor message's prose with every backtick-quoted identifier
 * set in JetBrains Mono, channel-colored when it's a real variable name
 * from this trace (docs/PRD.md Phase 3 frontend spec item 2) — this is
 * what makes a reference to `mid` in a sentence read as the *same* mid
 * that's colored in the array panel and the editor gutter, not a plain
 * word. Gemini reliably backtick-quotes identifiers when asked to (the
 * system prompt requests it); anything not in backticks stays as plain
 * body text.
 */
export function MessageContent({ text, channels }: { text: string; channels: ChannelAssignment }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  const backtickSpan = new RegExp(BACKTICK_SPAN_SOURCE);
  while ((match = backtickSpan.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>);
    }
    const identifier = match[1]!;
    const channel = channels.get(identifier);
    parts.push(
      <code
        key={key++}
        className="rounded-control px-1 py-0.5 font-editor text-[13px]"
        style={{
          color: channel ? `var(--color-ch-${channel})` : "var(--color-ink)",
          backgroundColor: channel
            ? `color-mix(in srgb, var(--color-ch-${channel}) 12%, transparent)`
            : "var(--color-paper)",
        }}
      >
        {identifier}
      </code>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
  }

  return <span className="whitespace-pre-wrap font-body text-[13px] leading-relaxed text-ink">{parts}</span>;
}
