import { Chip } from "@oocc/ui";
import type { Difficulty } from "@/lib/problems/types";

const DIFFICULTY_TONE = { easy: "ok", medium: "warn", hard: "mutate" } as const;
const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export function DifficultyChip({ difficulty }: { difficulty: Difficulty }) {
  return <Chip tone={DIFFICULTY_TONE[difficulty]}>{DIFFICULTY_LABEL[difficulty]}</Chip>;
}
