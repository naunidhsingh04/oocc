"""Twenty programs, each with one known, deliberately-planted bug matching
one of insight_scanner's seven detectors (docs/PRD.md §4.3's table).
`expected_kind` is a human label of what a correct scan should find — the
eval doesn't require it to be the *only* finding, just present among them.

`step_limit` overrides the tracer's default (100k) only for the three
runaway-loop programs, which must actually hit a step cap to produce
`status: "step_limit"` — no reason to burn 100k full-snapshot steps in eval
CI when a few thousand demonstrates the same thing.
"""

from __future__ import annotations

from dataclasses import dataclass

EVAL_STEP_LIMIT_RUNAWAY = 5_000


@dataclass(frozen=True)
class EvalCase:
    filename: str
    expected_kind: str
    step_limit: int | None = None


EVAL_CASES: list[EvalCase] = [
    EvalCase("r1_off_condition.py", "runaway_loop", step_limit=EVAL_STEP_LIMIT_RUNAWAY),
    EvalCase("r2_ever_incrementing.py", "runaway_loop", step_limit=EVAL_STEP_LIMIT_RUNAWAY),
    EvalCase("r3_wrong_comparison.py", "runaway_loop", step_limit=EVAL_STEP_LIMIT_RUNAWAY),
    EvalCase("o1_index_out_of_range.py", "off_by_one"),
    EvalCase("o2_key_error.py", "off_by_one"),
    EvalCase("o3_off_by_one_slice.py", "off_by_one"),
    EvalCase("m1_remove_while_iterating.py", "mutation_during_iteration"),
    EvalCase("m2_append_while_iterating.py", "mutation_during_iteration"),
    EvalCase("m3_pop_while_iterating.py", "mutation_during_iteration"),
    EvalCase("a1_in_check_in_loop.py", "accidental_quadratic"),
    EvalCase("a2_insert_zero_in_loop.py", "accidental_quadratic"),
    EvalCase("a3_membership_in_while.py", "accidental_quadratic"),
    EvalCase("s1_list_variable.py", "shadowed_builtin"),
    EvalCase("s2_id_parameter.py", "shadowed_builtin"),
    EvalCase("s3_for_loop_target.py", "shadowed_builtin"),
    EvalCase("d1_unused_temp.py", "dead_variable"),
    EvalCase("d2_unused_flag.py", "dead_variable"),
    EvalCase("d3_unused_loop_accumulator.py", "dead_variable"),
    EvalCase("rr1_naive_fib.py", "redundant_recomputation"),
    EvalCase("rr2_repeated_helper_calls.py", "redundant_recomputation"),
]

assert len(EVAL_CASES) == 20
