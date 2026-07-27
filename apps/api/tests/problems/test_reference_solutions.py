"""CI gate for apps/api/scripts/seed_problems.py (brief item 4): every one
of the 40 seeded problems' `reference_solution` is `exec`'d in a fresh
namespace and every one of its `tests` is run against the resulting
`solve` function. If a reference solution is wrong, this test fails and
CI fails — the problem is never seeded on the strength of a hand-written
claim alone.

This is the one place in the codebase that `exec`s a string of Python
source in-process. It's safe here specifically because every source string
is authored by us and reviewed in this PR, not user input — see
app/problems/grading.py's docstring for why an actual learner's submission
never takes this path and goes through services/executor instead.
"""

from __future__ import annotations

import pytest
from scripts.seed_problems import PROBLEMS

MIN_TESTS_PER_PROBLEM = 8


def _run_solution(reference_solution: str, args: list[object]) -> object:
    namespace: dict[str, object] = {}
    exec(reference_solution, namespace)  # noqa: S102 — see module docstring
    solve = namespace["solve"]
    return solve(*args)  # type: ignore[operator]


def test_exactly_forty_problems_seeded() -> None:
    assert len(PROBLEMS) == 40


def test_every_slug_is_unique() -> None:
    slugs = [p["slug"] for p in PROBLEMS]
    assert len(slugs) == len(set(slugs))


@pytest.mark.parametrize("problem", PROBLEMS, ids=[str(p["slug"]) for p in PROBLEMS])
def test_problem_has_at_least_eight_tests(problem: dict[str, object]) -> None:
    tests = problem["tests"]
    assert isinstance(tests, list)
    assert len(tests) >= MIN_TESTS_PER_PROBLEM, (
        f"{problem['slug']} has {len(tests)} tests, need >= {MIN_TESTS_PER_PROBLEM}"
    )


@pytest.mark.parametrize("problem", PROBLEMS, ids=[str(p["slug"]) for p in PROBLEMS])
def test_reference_solution_passes_its_own_tests(problem: dict[str, object]) -> None:
    reference_solution = problem["reference_solution"]
    assert isinstance(reference_solution, str)
    tests = problem["tests"]
    assert isinstance(tests, list)

    for i, test in enumerate(tests):
        actual = _run_solution(reference_solution, list(test["args"]))
        assert actual == test["expected"], (
            f"{problem['slug']} test #{i}: solve(*{test['args']}) == {actual!r}, "
            f"expected {test['expected']!r}"
        )
