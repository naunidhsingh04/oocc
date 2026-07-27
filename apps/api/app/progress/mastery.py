"""Mastery model — deterministic core, no LLM (CLAUDE.md: this repo's
existing convention for `digest`, `structure_detector`,
`complexity_analyst`'s core, and every `insight_scanner` detector; the
same discipline applies here). A pure function of one submission's signals
plus the learner's previous mastery, exactly the "deterministic core,
thoroughly unit tested" house style used by
app/analysis/complexity_analyst.py.

**Inputs, and why each one moves mastery** (brief item 3 lists: attempts,
time to solve, hints used, tutor questions asked about the concept,
insight kinds triggered, and whether the learner scrubbed the trace):

- `passed` is the base signal: correctness is still the primary evidence
  of understanding.
- `attempts` (cumulative, including this one) discounts the reward for
  retries — getting it right on try 4 is weaker evidence than try 1.
- `hints_used` and `tutor_questions` both discount the reward: needing
  help to pass means the unaided understanding is weaker than a bare pass
  suggests, even though the submission is green.
- `insight_kinds` (docs/PRD.md §4.3's insight_scanner output for the run
  behind this submission) is a flat penalty per kind — misconceptions like
  an off-by-one or an accidental O(n²) pattern are down-weighted evidence
  of mastery *regardless* of whether the submission ultimately passed,
  because the insight scanner is deterministic ground truth, not a guess.
- `scrub_ratio` (`steps_viewed / total_steps`, both supplied by the
  frontend's playback telemetry at submission time — see
  `SubmissionSignal`'s docstring for the exact assumption) tracks whether
  the learner actually watched the execution trace or just checked
  "pass"/"fail" and moved on. OOCC's whole thesis is that the trace is
  what builds understanding (docs/PRD.md §1), so a pass with near-zero
  scrubbing is capped well below full credit.

`time_to_solve_s` is accepted but deliberately NOT used in the score:
solve time varies enormously with typing speed, problem difficulty, and
interruptions in a way this repo has no baseline to normalize against yet.
Recording it now (rather than not collecting it) means a future session
can calibrate against real data instead of guessing; using it today would
be exactly the kind of invented behavior CLAUDE.md warns against.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

MASTERY_MIN = 0.0
MASTERY_MAX = 1.0

_PASS_REWARD = 0.30
_FAIL_PENALTY = 0.15
_INSIGHT_PENALTY_PER_KIND = 0.05
_MAX_INSIGHT_PENALTY = 0.25


@dataclass(frozen=True)
class SubmissionSignal:
    """One submission's telemetry, as recorded at grading time
    (app/routers/progress.py). `steps_viewed`/`total_steps` are the
    assumed frontend contract: the trace player counts distinct step
    indices the scrubber visited during this attempt and reports both
    numbers alongside the submission; a value of `total_steps == 0` means
    "no telemetry available" (e.g. an older client), and is treated as
    neutral rather than as "watched nothing."
    """

    passed: bool
    attempts: int = 1
    time_to_solve_s: float | None = None
    hints_used: int = 0
    tutor_questions: int = 0
    insight_kinds: tuple[str, ...] = field(default_factory=tuple)
    steps_viewed: int = 0
    total_steps: int = 0


def _scrub_ratio(signal: SubmissionSignal) -> float:
    if signal.total_steps <= 0:
        return 1.0  # no telemetry: don't penalize what we can't measure
    return min(1.0, signal.steps_viewed / signal.total_steps)


def _scrub_multiplier(signal: SubmissionSignal) -> float:
    """Full credit once at least a fifth of the trace has been scrubbed;
    below that, credit ramps linearly down to half — never zero, since a
    correct answer is still some evidence even unscrubbed."""
    ratio = _scrub_ratio(signal)
    return 0.5 + 0.5 * min(1.0, ratio * 5)


def _engagement_multiplier(signal: SubmissionSignal) -> float:
    retries = max(0, signal.attempts - 1)
    retry_factor = max(0.5, 1 - 0.10 * retries)
    hint_factor = max(0.4, 1 - 0.15 * signal.hints_used)
    tutor_factor = max(0.5, 1 - 0.10 * signal.tutor_questions)
    return retry_factor * hint_factor * tutor_factor


def _insight_penalty(signal: SubmissionSignal) -> float:
    return min(_MAX_INSIGHT_PENALTY, _INSIGHT_PENALTY_PER_KIND * len(signal.insight_kinds))


def compute_mastery_delta(signal: SubmissionSignal) -> float:
    """The raw (unclamped) change in mastery this submission contributes,
    isolated from the previous mastery value so it's trivial to unit test
    on its own."""
    if signal.passed:
        reward = _PASS_REWARD * _engagement_multiplier(signal) * _scrub_multiplier(signal)
        return reward - _insight_penalty(signal)
    return -_FAIL_PENALTY - _insight_penalty(signal)


def update_mastery(previous_mastery: float, signal: SubmissionSignal) -> float:
    delta = compute_mastery_delta(signal)
    return max(MASTERY_MIN, min(MASTERY_MAX, previous_mastery + delta))


# Spaced repetition. We adapt the shape of SM-2 (an interval that grows as
# mastery grows, shrinks sharply on a poor showing) to a continuous
# mastery score in [0, 1] rather than SM-2's discrete 0-5 "quality of
# recall" grade: mastery here is already a continuous aggregate of
# attempts/hints/engagement/scrubbing, not a single quiz answer's grade,
# so translating it into a discrete quality bucket first would throw away
# information for no benefit. The bucket boundaries below are a reasoned
# default (tight review while a concept is shaky, monthly once it's
# solid), not calibrated against real usage data yet — see the module
# docstring's note on `time_to_solve_s` for the same caveat applied here.
_REVIEW_INTERVALS_DAYS: list[tuple[float, float]] = [
    (0.30, 1.0),
    (0.60, 3.0),
    (0.80, 7.0),
    (0.95, 14.0),
    (1.01, 30.0),  # 1.01 so mastery == 1.0 lands here, not falls through
]


def review_interval_days(mastery: float) -> float:
    for threshold, interval in _REVIEW_INTERVALS_DAYS:
        if mastery < threshold:
            return interval
    return _REVIEW_INTERVALS_DAYS[-1][1]


def schedule_next_review(mastery: float, *, now: datetime) -> datetime:
    return now + timedelta(days=review_interval_days(mastery))
