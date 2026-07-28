"use client";

import { CPP_FIXTURE_NAMES, FIXTURE_NAMES, type FixtureName, isFixtureName } from "@/lib/fixtures";

export interface CompareFixtureSelectProps {
  id: string;
  /** Omit to render only the `<select>` with an aria-label (e.g. inside a panel header that already shows the run label). */
  label?: string;
  value: FixtureName;
  onChange: (name: FixtureName) => void;
  disabled?: boolean;
}

/**
 * A per-side fixture dropdown for Compare View — mirrors
 * `components/workspace/FixturePicker.tsx`'s dev-only pattern (same
 * fixture-loading transport, `lib/fixtures.ts`'s `fetchFixture`), but two of
 * these exist on this page independently (one per run) instead of one
 * feeding a single global store.
 */
export function CompareFixtureSelect({ id, label, value, onChange, disabled }: CompareFixtureSelectProps) {
  return (
    <div className="flex items-center gap-1.5">
      {label ? (
        <label htmlFor={id} className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
          {label}
        </label>
      ) : null}
      <select
        id={id}
        aria-label={label ? undefined : "Fixture"}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value;
          if (isFixtureName(next)) onChange(next);
        }}
        className="h-6 rounded-control border border-rule bg-panel px-1.5 font-mono-label text-[11px] text-ink"
      >
        {FIXTURE_NAMES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <optgroup label="C++">
          {CPP_FIXTURE_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
