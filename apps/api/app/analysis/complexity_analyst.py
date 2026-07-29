"""complexity_analyst — deterministic core (docs/PRD.md §4.3). Finds the
primary function's size-bearing parameter by AST analysis, generates inputs
at n = 10, 50, 100, 500, 1000 in four shapes, executes each through the
executor's counters-only mode, and fits the measured counts against seven
candidate growth curves. The one-paragraph explanation and dominant-operation
naming are Phase 3's job (an LLM call over these *already-measured* numbers,
never over guesses) — this module only measures and fits.

Known limitation, accepted deliberately: secondary parameters (anything
other than the size-bearing one) get a name-heuristic default (`target`-like
names get an unreachable sentinel to force worst case; `low`/`high`-like
names get 0/len-1; anything else defaults to 0). This is why complexity
analysis is allowed to come back `None` — see docs/PRD.md §4.3's own
framing: an empirically measured curve when we have one, not a guessed one
when we don't.
"""

from __future__ import annotations

from typing import Any

from app.analysis.ast_inspect import (
    build_harness_source,
    find_primary_function,
    find_size_parameter,
)
from app.analysis.curve_fit import MODELS, fit_curve
from app.executor_client import ExecutorClient

SIZES = [10, 50, 100, 500, 1000]
SHAPES = ["random", "sorted", "reverse", "all_equal"]


async def analyze_complexity(source: str, executor: ExecutorClient) -> dict[str, Any] | None:
    fn = find_primary_function(source)
    if fn is None:
        return None
    size_param = find_size_parameter(fn, source)
    if size_param is None:
        return None

    shapes = SHAPES if size_param.kind == "list_int" else SHAPES[:1]
    samples: list[dict[str, Any]] = []
    worst_at_n: dict[int, int] = {}

    for shape in shapes:
        for n in SIZES:
            harness = build_harness_source(source, fn, size_param, n, shape)
            result = await executor.execute_counters(harness)
            if result["status"] != "ok":
                samples.append(
                    {"n": n, "shape": shape, "step_count": result["step_count"], "timed_out": True}
                )
                break  # larger n will only be slower; stop escalating this shape
            samples.append({"n": n, "shape": shape, "step_count": result["step_count"]})
            worst_at_n[n] = max(worst_at_n.get(n, 0), result["step_count"])

    # Fit against the worst-observed count per n, not every shape pooled
    # together: Big-O is a worst-case bound, and an algorithm with a
    # best-case shortcut (e.g. bubble sort's early exit on an
    # already-sorted input) legitimately runs faster on some shapes without
    # changing its complexity class — averaging that in would corrupt the
    # fit for the shapes that actually exercise the full algorithm. Every
    # raw sample is still returned above for the frontend's scatter plot.
    fit_pairs = sorted(worst_at_n.items())
    if len(fit_pairs) < 2:
        return None

    fits: list[dict[str, object]] = []
    r_squared_by_model: dict[str, float] = {}
    for model_name in MODELS:
        a, b, r_squared = fit_curve(fit_pairs, model_name)
        fits.append({"model": model_name, "r_squared": r_squared, "coefficients": {"a": a, "b": b}})
        r_squared_by_model[model_name] = r_squared
    best_model = max(r_squared_by_model, key=lambda name: r_squared_by_model[name])

    return {
        "parameter": size_param.name,
        "samples": samples,
        "fits": fits,
        "best_fit": best_model,
    }
