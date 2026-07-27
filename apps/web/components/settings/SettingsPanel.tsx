"use client";

import type { KeyStatus } from "@/lib/settings/store";
import { useSettingsStore } from "@/lib/settings/store";
import { Button, Chip, cn } from "@oocc/ui";
import { useEffect, useRef, useState } from "react";

const STATUS_LABEL: Record<KeyStatus, string> = {
  empty: "No key",
  checking: "Checking…",
  valid: "Key valid",
  invalid: "Key invalid",
};

const STATUS_TONE: Record<KeyStatus, "neutral" | "ok" | "warn" | "signal"> = {
  empty: "neutral",
  checking: "signal",
  valid: "ok",
  invalid: "warn",
};

/**
 * Key setup (docs/PRD.md §4.5, Phase 3 frontend spec item 1): an anchored
 * dropdown from the top bar, not a modal — the app is fully usable with it
 * closed and with no key at all. Validates against the real backend
 * (`POST /api/settings/validate-key`) rather than trusting shape alone,
 * and shows the running session token count so BYO-key cost stays honest
 * and visible, never a surprise.
 */
export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const { providerKey, status, error, sessionTokens, hydrate, setKey, clearKey } = useSettingsStore();

  useEffect(() => {
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  async function handleSave() {
    if (!input.trim()) return;
    await setKey(input);
    setInput("");
  }

  return (
    <div ref={containerRef} className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{
            backgroundColor:
              status === "valid"
                ? "var(--color-ok)"
                : status === "invalid"
                  ? "var(--color-warn)"
                  : "var(--color-ink-soft)",
          }}
        />
        <span className="font-mono-label text-[11px] uppercase tracking-[0.06em]">API key</span>
      </Button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-80 rounded-panel border border-rule bg-panel p-3 shadow-menu">
          <div className="flex items-center justify-between">
            <h3 className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
              Gemini API key
            </h3>
            <Chip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Chip>
          </div>

          <p className="mt-2 font-body text-[12px] leading-snug text-ink-soft">
            Your key is sent with each request as a header and used to call Gemini — the server
            never stores it.
          </p>

          <div className="mt-3 flex gap-1.5">
            <input
              type="password"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleSave();
              }}
              placeholder={providerKey ? "Replace key…" : "Paste your Gemini API key"}
              className="h-8 min-w-0 flex-1 rounded-control border border-rule bg-paper px-2 font-mono-label text-[12px] text-ink outline-none focus:border-signal"
            />
            <Button variant="primary" size="sm" onClick={() => void handleSave()}>
              Save
            </Button>
          </div>

          {status === "invalid" && error ? (
            <p className="mt-1.5 font-mono-label text-[11px] text-warn">{error}</p>
          ) : null}

          <div
            className={cn(
              "mt-3 flex items-center justify-between border-t border-rule pt-2",
              providerKey ? "" : "opacity-50",
            )}
          >
            <span className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
              Session tokens
            </span>
            <span className="font-mono-label text-[12px] text-ink">{sessionTokens.toLocaleString()}</span>
          </div>

          {providerKey ? (
            <button
              type="button"
              onClick={clearKey}
              className="mt-2 font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft underline decoration-dotted hover:text-mutate"
            >
              Remove key
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
