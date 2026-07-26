import type { ComplexityReport, CurveModel, InputShape } from "@oocc/contracts";

export interface ScatterPoint {
  n: number;
  stepCount: number;
  shape: InputShape;
}

export interface CurvePoint {
  n: number;
  value: number;
}

const MODEL_LABELS: Record<CurveModel, string> = {
  constant: "O(1)",
  log_n: "O(log n)",
  n: "O(n)",
  n_log_n: "O(n log n)",
  n_squared: "O(n²)",
  n_cubed: "O(n³)",
  exponential: "O(2ⁿ)",
};

export function modelLabel(model: CurveModel): string {
  return MODEL_LABELS[model];
}

function evaluate(model: CurveModel, n: number): number {
  switch (model) {
    case "constant":
      return 1;
    case "log_n":
      return n > 1 ? Math.log2(n) : 0;
    case "n":
      return n;
    case "n_log_n":
      return n > 1 ? n * Math.log2(n) : 0;
    case "n_squared":
      return n ** 2;
    case "n_cubed":
      return n ** 3;
    case "exponential":
      return 2 ** n;
  }
}

export function scatterPoints(report: ComplexityReport): ScatterPoint[] {
  return report.samples
    .filter((s) => !s.timed_out)
    .map((s) => ({ n: s.n, stepCount: s.step_count, shape: s.shape }));
}

/** The fitted curve, sampled at every distinct `n` actually measured, using
 * the winning model's own (a, b) coefficients from `step_count ~= a*f(n)+b`. */
export function fittedCurvePoints(report: ComplexityReport): CurvePoint[] {
  const fit = report.fits.find((f) => f.model === report.best_fit);
  if (!fit) return [];
  const ns = [...new Set(report.samples.filter((s) => !s.timed_out).map((s) => s.n))].sort((a, b) => a - b);
  return ns.map((n) => ({ n, value: fit.coefficients.a * evaluate(report.best_fit, n) + fit.coefficients.b }));
}

export function bestFitRSquared(report: ComplexityReport): number {
  return report.fits.find((f) => f.model === report.best_fit)?.r_squared ?? 0;
}

/**
 * A plain-language callout when the measured fit doesn't land cleanly —
 * either the winning model itself fits poorly (R² < 0.9, no clean pattern
 * at all), or the runner-up model is close enough (within 0.02 R²) that
 * calling one model "the" answer overstates the confidence. Both are
 * measured facts about the fit itself, not a guess about what the user
 * expected.
 */
export function complexityContradiction(report: ComplexityReport): string | null {
  const sorted = [...report.fits].sort((a, b) => b.r_squared - a.r_squared);
  const best = sorted[0];
  const runnerUp = sorted[1];
  if (!best) return null;

  if (best.r_squared < 0.9) {
    return `No model fits cleanly (best R² = ${best.r_squared.toFixed(3)} for ${modelLabel(best.model)}) — the measured growth is noisier than any single curve explains.`;
  }
  if (runnerUp && best.r_squared - runnerUp.r_squared < 0.02) {
    return `${modelLabel(best.model)} and ${modelLabel(runnerUp.model)} fit almost equally well (R² ${best.r_squared.toFixed(3)} vs ${runnerUp.r_squared.toFixed(3)}) — treat the winner as a close call, not a certainty.`;
  }
  return null;
}
