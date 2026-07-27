"""app/problems/grading.py against the real services/executor app over an
in-process ASGI transport (see tests/conftest.py's `executor_client`
fixture and app/executor_client.py's docstring) — grading a submission
really does go through the sandboxed executor, never a bare `exec`."""

from __future__ import annotations

import pytest
from app.executor_client import ExecutorClient
from app.problems.grading import grade_submission

pytestmark = pytest.mark.anyio


async def test_a_correct_submission_passes_every_test(executor_client: ExecutorClient) -> None:
    source = "def solve(a, b):\n    return a + b\n"
    tests = [
        {"args": [1, 2], "expected": 3},
        {"args": [-1, 1], "expected": 0},
        {"args": [0, 0], "expected": 0},
    ]

    result = await grade_submission(source=source, tests=tests, executor=executor_client)

    assert result.passed is True
    assert all(o.passed for o in result.outcomes)


async def test_a_wrong_submission_fails_the_test_it_gets_wrong(
    executor_client: ExecutorClient,
) -> None:
    source = "def solve(a, b):\n    return a - b\n"  # wrong: should be a + b
    tests = [
        {"args": [1, 2], "expected": 3},
        {"args": [5, 5], "expected": 10},
    ]

    result = await grade_submission(source=source, tests=tests, executor=executor_client)

    assert result.passed is False
    assert result.outcomes[0].passed is False
    assert result.outcomes[0].actual == -1


async def test_a_submission_that_raises_fails_gracefully(executor_client: ExecutorClient) -> None:
    source = "def solve(nums):\n    return nums[100]\n"
    tests = [{"args": [[1, 2, 3]], "expected": 1}]

    result = await grade_submission(source=source, tests=tests, executor=executor_client)

    assert result.passed is False
    assert result.outcomes[0].error is not None


async def test_tuples_and_lists_compare_equal_after_normalization(
    executor_client: ExecutorClient,
) -> None:
    source = "def solve():\n    return (1, 2, 3)\n"
    tests = [{"args": [], "expected": [1, 2, 3]}]

    result = await grade_submission(source=source, tests=tests, executor=executor_client)

    assert result.passed is True
