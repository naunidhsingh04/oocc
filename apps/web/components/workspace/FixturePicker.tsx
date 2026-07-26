"use client";

import { usePlayerStore } from "@/lib/player";
import { fetchFixture, FIXTURE_NAMES, isFixtureName } from "@/lib/fixtures";
import { useState } from "react";

/**
 * Dev-only (docs/PRD.md Phase 1 brief): Phase 1 has no backend, so this is
 * how a fixture's trace + source gets into the player store. Phase 2's run
 * API replaces it; nothing here is meant to ship.
 */
export function FixturePicker() {
  const fixtureName = usePlayerStore((state) => state.fixtureName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (process.env.NODE_ENV === "production") return null;

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const { value } = event.target;
    if (!isFixtureName(value)) return;
    setLoading(true);
    setError(null);
    try {
      const bundle = await fetchFixture(value);
      usePlayerStore.getState().loadTrace(bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load fixture");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor="fixture-picker" className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
        Fixture
      </label>
      <select
        id="fixture-picker"
        value={fixtureName ?? ""}
        onChange={handleChange}
        disabled={loading}
        className="h-6 rounded-control border border-rule bg-panel px-1.5 font-mono-label text-[11px] text-ink"
      >
        <option value="" disabled>
          {loading ? "Loading…" : "Choose a fixture…"}
        </option>
        {FIXTURE_NAMES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      {error ? (
        <span role="alert" className="font-mono-label text-[11px] text-mutate">
          {error}
        </span>
      ) : null}
    </div>
  );
}
