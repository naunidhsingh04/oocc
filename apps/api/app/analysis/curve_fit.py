"""Least-squares curve fitting for complexity_analyst — no numpy: this is a
single-variable linear regression (step_count against f(n) for each
candidate model), which has a closed-form two-line solution. docs/PRD.md
§4.3: fit against 1, log n, n, n log n, n^2, n^3, 2^n and report every R².
"""

from __future__ import annotations

import math
from collections.abc import Callable

MODELS: dict[str, Callable[[int], float]] = {
    "constant": lambda n: 1.0,
    "log_n": lambda n: math.log2(n) if n > 1 else 0.0,
    "n": lambda n: float(n),
    "n_log_n": lambda n: n * math.log2(n) if n > 1 else 0.0,
    "n_squared": lambda n: float(n) ** 2,
    "n_cubed": lambda n: float(n) ** 3,
    "exponential": lambda n: 2.0**n,
}

# A model that can't even be evaluated/squared without overflowing float64
# against *this* data (2^1000 alone is ~1e301; squaring it in sum-of-squares
# overflows) is definitionally a catastrophic fit for that data — score it
# as the worst possible fit instead of crashing the whole analysis over one
# candidate model.
_WORST_FIT = (0.0, 0.0, -1.0)


def fit_curve(samples: list[tuple[int, int]], model_name: str) -> tuple[float, float, float]:
    """samples: (n, step_count) pairs. Returns (a, b, r_squared) for
    step_count ~= a*f(n) + b."""
    f = MODELS[model_name]
    ys = [float(count) for _, count in samples]
    count = len(ys)
    if count < 2:
        return 0.0, ys[0] if ys else 0.0, 0.0

    try:
        xs = [f(n) for n, _ in samples]
        mean_x = sum(xs) / count
        mean_y = sum(ys) / count
        s_xx = sum((x - mean_x) ** 2 for x in xs)
        s_xy = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys, strict=True))

        if s_xx == 0:
            a, b = 0.0, mean_y
        else:
            a = s_xy / s_xx
            b = mean_y - a * mean_x

        ss_res = sum((y - (a * x + b)) ** 2 for x, y in zip(xs, ys, strict=True))
        ss_tot = sum((y - mean_y) ** 2 for y in ys)
    except OverflowError:
        return _WORST_FIT

    if ss_tot == 0:
        r_squared = 1.0 if ss_res == 0 else 0.0
    else:
        r_squared = 1.0 - ss_res / ss_tot
    return a, b, r_squared
