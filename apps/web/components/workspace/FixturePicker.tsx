"use client";

import { usePlayerStore } from "@/lib/player";
import { CPP_FIXTURE_NAMES, fetchFixture, FIXTURE_NAMES, isFixtureName } from "@/lib/fixtures";
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
        // A trace can be loaded from somewhere other than this picker now
        // (a problem's fixture-backed run, a curriculum article's
        // embedded trace expanded here) with a `fixtureName` that isn't
        // one of this select's own <option> values — e.g. a problem slug
        // like "binary-search". Falling back to "" instead of passing
        // that straight through avoids the browser silently coercing an
        // unmatched value to whichever <option> happens to be first,
        // which read as this dev-only picker showing the wrong fixture
        // selected.
        value={fixtureName && isFixtureName(fixtureName) ? fixtureName : ""}
        onChange={handleChange}
        disabled={loading}
        className="h-6 max-w-[50vw] truncate rounded-control border border-rule bg-panel px-1.5 font-mono-label text-[11px] text-ink sm:max-w-none"
      >
        <option value="" disabled>
          {loading ? "Loading…" : "Choose a fixture…"}
        </option>
        {FIXTURE_NAMES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <optgroup label="C++ (Phase 4)">
          {CPP_FIXTURE_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </optgroup>
      </select>
      {error ? (
        <span role="alert" className="font-mono-label text-[11px] text-mutate">
          {error}
        </span>
      ) : null}
    </div>
  );
}
