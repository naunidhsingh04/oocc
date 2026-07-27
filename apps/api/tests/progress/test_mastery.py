"""Pure-function tests for the mastery model (app/progress/mastery.py) —
the same "deterministic core, thoroughly unit tested" house style as
tests/analysis/test_complexity_analyst.py."""

from __future__ import annotations

from datetime import UTC, datetime

from app.progress.mastery import (
    SubmissionSignal,
    review_interval_days,
    schedule_next_review,
    update_mastery,
)


def test_a_clean_pass_increases_mastery() -> None:
    signal = SubmissionSignal(passed=True, steps_viewed=10, total_steps=10)
    new_mastery = update_mastery(0.0, signal)
    assert new_mastery > 0.0


def test_a_fail_decreases_mastery() -> None:
    signal = SubmissionSignal(passed=False)
    new_mastery = update_mastery(0.5, signal)
    assert new_mastery < 0.5


def test_mastery_never_exceeds_one() -> None:
    signal = SubmissionSignal(passed=True, steps_viewed=100, total_steps=100)
    new_mastery = update_mastery(0.99, signal)
    assert new_mastery <= 1.0


def test_mastery_never_drops_below_zero() -> None:
    signal = SubmissionSignal(passed=False, insight_kinds=("infinite_loop", "off_by_one"))
    new_mastery = update_mastery(0.01, signal)
    assert new_mastery >= 0.0


def test_hints_reduce_the_reward_of_a_pass() -> None:
    no_hints = update_mastery(0.0, SubmissionSignal(passed=True, hints_used=0))
    with_hints = update_mastery(0.0, SubmissionSignal(passed=True, hints_used=3))
    assert with_hints < no_hints


def test_tutor_questions_reduce_the_reward_of_a_pass() -> None:
    no_questions = update_mastery(0.0, SubmissionSignal(passed=True, tutor_questions=0))
    with_questions = update_mastery(0.0, SubmissionSignal(passed=True, tutor_questions=4))
    assert with_questions < no_questions


def test_more_attempts_reduce_the_reward_of_a_pass() -> None:
    first_try = update_mastery(0.0, SubmissionSignal(passed=True, attempts=1))
    fourth_try = update_mastery(0.0, SubmissionSignal(passed=True, attempts=4))
    assert fourth_try < first_try


def test_insight_kinds_penalize_regardless_of_pass_fail() -> None:
    clean_pass = update_mastery(0.0, SubmissionSignal(passed=True))
    flagged_pass = update_mastery(0.0, SubmissionSignal(passed=True, insight_kinds=("off_by_one",)))
    assert flagged_pass < clean_pass


def test_skipping_the_trace_caps_reward_even_on_a_pass() -> None:
    watched = update_mastery(0.0, SubmissionSignal(passed=True, steps_viewed=50, total_steps=100))
    skipped = update_mastery(0.0, SubmissionSignal(passed=True, steps_viewed=0, total_steps=100))
    assert skipped < watched
    assert skipped > 0.0  # still some credit for a correct answer


def test_no_telemetry_is_treated_as_neutral_not_penalized() -> None:
    no_telemetry = update_mastery(0.0, SubmissionSignal(passed=True, steps_viewed=0, total_steps=0))
    fully_watched = update_mastery(
        0.0, SubmissionSignal(passed=True, steps_viewed=10, total_steps=10)
    )
    assert no_telemetry == fully_watched


def test_review_interval_grows_with_mastery() -> None:
    assert review_interval_days(0.1) < review_interval_days(0.5)
    assert review_interval_days(0.5) < review_interval_days(0.7)
    assert review_interval_days(0.7) < review_interval_days(0.9)
    assert review_interval_days(0.9) < review_interval_days(1.0)


def test_schedule_next_review_is_in_the_future() -> None:
    now = datetime(2026, 1, 1, tzinfo=UTC)
    next_review = schedule_next_review(0.5, now=now)
    assert next_review > now
