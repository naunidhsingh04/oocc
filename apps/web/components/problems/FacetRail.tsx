import type { Difficulty, ProblemStatus } from "@/lib/problems/types";
import type { ProblemListState } from "@/lib/problems/listState";
import { cn } from "@oocc/ui";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const STATUSES: ProblemStatus[] = ["solved", "attempted", "todo"];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export interface FacetRailProps {
  state: ProblemListState;
  onChange: (next: ProblemListState) => void;
  tags: string[];
  counts: { total: number; filtered: number };
}

function FacetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-rule px-3 py-3">
      <div className="mb-2 font-body text-[12px] font-semibold text-ink-soft">{title}</div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function FacetCheckbox({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-0.5 font-body text-[13px] text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className={cn("h-3.5 w-3.5 accent-signal", "rounded-[2px]")}
      />
      {label}
    </label>
  );
}

/** Faceted filters, left rail (docs/PRD.md Phase 4 frontend brief). Every
 * change writes straight through `onChange` -> the page's URL-synced
 * state — this component holds no state of its own. */
export function FacetRail({ state, onChange, tags, counts }: FacetRailProps) {
  return (
    <aside className="w-48 shrink-0 overflow-y-auto border-r border-rule bg-panel">
      <div className="border-b border-rule px-3 py-2.5 font-body text-[13px] font-medium text-ink-soft">
        {counts.filtered} of {counts.total} problems
      </div>
      <FacetGroup title="Difficulty">
        {DIFFICULTIES.map((d) => (
          <FacetCheckbox
            key={d}
            checked={state.difficulty.includes(d)}
            label={d}
            onToggle={() => onChange({ ...state, difficulty: toggle(state.difficulty, d) })}
          />
        ))}
      </FacetGroup>
      <FacetGroup title="Status">
        {STATUSES.map((s) => (
          <FacetCheckbox
            key={s}
            checked={state.status.includes(s)}
            label={s}
            onToggle={() => onChange({ ...state, status: toggle(state.status, s) })}
          />
        ))}
      </FacetGroup>
      <FacetGroup title="Tags">
        {tags.map((t) => (
          <FacetCheckbox
            key={t}
            checked={state.tags.includes(t)}
            label={t}
            onToggle={() => onChange({ ...state, tags: toggle(state.tags, t) })}
          />
        ))}
      </FacetGroup>
    </aside>
  );
}
