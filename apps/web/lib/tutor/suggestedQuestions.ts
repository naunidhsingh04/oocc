import type { AlgorithmResult } from "@/lib/api/types";
import type { Insight, Step } from "@oocc/contracts";

const MAX_SUGGESTIONS = 4;

/**
 * Generated fresh from the current run and scrubber position — never a
 * hardcoded list (docs/PRD.md Phase 3 frontend spec item 2). Every
 * question is grounded in something real about *this* step (its locals,
 * its event kind, findings that reference it), so the suggestions
 * themselves obey the same "no claim without a real step index" rule the
 * tutor's answers do — asking one is never a shot in the dark.
 */
export function computeSuggestedQuestions(params: {
  step: Step | undefined;
  algorithm: AlgorithmResult | null;
  insights: readonly Insight[];
}): string[] {
  const { step, algorithm, insights } = params;
  if (!step) return [];

  const questions: string[] = [];
  const topFrame = step.stack[step.stack.length - 1];
  const localNames = topFrame ? Object.keys(topFrame.locals) : [];

  if (localNames.length >= 2) {
    questions.push(`What's the relationship between ${localNames[0]} and ${localNames[1]} here?`);
  } else if (localNames.length === 1) {
    questions.push(`Why does ${localNames[0]} have this value?`);
  }

  if (step.event === "call") {
    questions.push(`Why was ${step.func} called at this point?`);
  } else if (step.event === "return") {
    questions.push(`Why does ${step.func} return this value?`);
  }

  const insightsAtThisStep = insights.filter((insight) => insight.step_refs.includes(step.i));
  if (insightsAtThisStep.length > 0) {
    questions.push(`What's the ${insightsAtThisStep[0]!.kind.replaceAll("_", " ")} issue here?`);
  }

  if (algorithm) {
    questions.push(`Why does this step matter for ${algorithm.algorithm}?`);
  }

  if (step.changed.length > 0) {
    questions.push("Why did this value just change?");
  }

  questions.push("What happens next?");

  return [...new Set(questions)].slice(0, MAX_SUGGESTIONS);
}
